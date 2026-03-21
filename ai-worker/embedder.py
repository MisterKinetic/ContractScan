"""
ContractScan — Week 2
Stage 3: Semantic Chunking (clause boundary detection)
Stage 4: Embedding generation → PGVector
"""

import os
import uuid
from pathlib import Path

import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from loguru import logger

load_dotenv(Path(__file__).parent.parent / ".env")

# =============================================
# DATABASE
# =============================================

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "contractscan"),
        user=os.getenv("DB_USER", "contractscan"),
        password=os.getenv("DB_PASSWORD", "password"),
    )

# =============================================
# STAGE 3 — SEMANTIC CHUNKING
# =============================================

class ClauseChunker:
    """
    Splits a contract into clause-level chunks.
    Detects clause boundaries by looking for numbered headings
    and ALL CAPS section headers — common in legal documents.
    Uses 20% overlap between chunks to avoid losing context.
    """

    OVERLAP_RATIO = 0.20

    def is_clause_boundary(self, text: str) -> bool:
        """
        Returns True if this text block looks like a clause header.
        Examples that qualify:
          "1. SERVICES"
          "SECTION 3: PAYMENT TERMS"
          "Article IV — Confidentiality"
        """
        text = text.strip()

        # Numbered clause: starts with digit(s) followed by . or )
        import re
        if re.match(r'^\d+[\.\)]\s+[A-Z]', text):
            return True

        # ALL CAPS heading (at least 3 words or one long word)
        words = text.split()
        if len(words) >= 1 and text == text.upper() and len(text) > 4:
            return True

        # "SECTION X" or "ARTICLE X" pattern
        if re.match(r'^(SECTION|ARTICLE|CLAUSE)\s+[\dIVXivx]+', text, re.IGNORECASE):
            return True

        return False

    def chunk(self, blocks: list[dict]) -> list[dict]:
        """
        Groups bbox blocks into clause-level chunks.
        Each chunk has: text, start_bbox_id, end_bbox_id, chunk_index
        """
        chunks = []
        current_chunk_blocks = []
        chunk_index = 0

        for block in blocks:
            text = block['raw_text'].strip()
            if not text:
                continue

            # If this block looks like a new clause header and we already
            # have content, save the current chunk and start a new one
            if self.is_clause_boundary(text) and current_chunk_blocks:
                chunk_text = "\n".join(b['raw_text'] for b in current_chunk_blocks)

                # Add 20% overlap — include last few blocks in next chunk too
                overlap_count = max(1, int(len(current_chunk_blocks) * self.OVERLAP_RATIO))

                chunks.append({
                    "chunk_index": chunk_index,
                    "raw_text": chunk_text,
                    "start_bbox_id": current_chunk_blocks[0]['id'],
                    "end_bbox_id": current_chunk_blocks[-1]['id'],
                })
                chunk_index += 1

                # Keep last N blocks as overlap for next chunk
                current_chunk_blocks = current_chunk_blocks[-overlap_count:]

            current_chunk_blocks.append(block)

        # Don't forget the last chunk
        if current_chunk_blocks:
            chunk_text = "\n".join(b['raw_text'] for b in current_chunk_blocks)
            chunks.append({
                "chunk_index": chunk_index,
                "raw_text": chunk_text,
                "start_bbox_id": current_chunk_blocks[0]['id'],
                "end_bbox_id": current_chunk_blocks[-1]['id'],
            })

        logger.info(f"Created {len(chunks)} clause chunks from {len(blocks)} blocks")
        return chunks

    def save_chunks(self, conn, contract_id: str, chunks: list[dict]) -> list[dict]:
        """Save chunks to DB and return them with their new IDs."""
        saved = []
        with conn.cursor() as cur:
            for chunk in chunks:
                chunk_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO clause_chunks
                        (id, contract_id, chunk_index, raw_text, anonymized_text,
                         start_bbox_id, end_bbox_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        chunk_id,
                        contract_id,
                        chunk['chunk_index'],
                        chunk['raw_text'],
                        chunk['raw_text'],  # anonymized_text same for now
                        chunk['start_bbox_id'],
                        chunk['end_bbox_id'],
                    ),
                )
                saved.append({**chunk, "id": chunk_id})
        conn.commit()
        logger.info(f"Saved {len(saved)} chunks for contract {contract_id}")
        return saved


# =============================================
# STAGE 4 — EMBEDDINGS
# =============================================

class EmbeddingGenerator:
    """
    Generates vector embeddings for each clause chunk.
    Uses sentence-transformers locally — no API call, no cost.
    Stores vectors in PGVector for semantic search later.
    """

    MODEL_NAME = "all-mpnet-base-v2"  # 768 dimensions, good quality

    def __init__(self):
        logger.info(f"Loading embedding model {self.MODEL_NAME}...")
        self.model = SentenceTransformer(self.MODEL_NAME)
        logger.info("Embedding model loaded.")

    def embed_chunks(self, conn, contract_id: str, chunks: list[dict]):
        """Generate and store embeddings for all chunks."""
        texts = [c['raw_text'] for c in chunks]

        logger.info(f"Generating embeddings for {len(texts)} chunks...")
        embeddings = self.model.encode(texts, show_progress_bar=True)

        with conn.cursor() as cur:
            for chunk, embedding in zip(chunks, embeddings):
                vector_str = "[" + ",".join(str(round(float(v), 6)) for v in embedding) + "]"
                cur.execute(
                    """
                    INSERT INTO clause_embeddings
                        (clause_chunk_id, embedding, model_used)
                    VALUES (%s, %s::vector, %s)
                    """,
                    (chunk['id'], vector_str, self.MODEL_NAME),
                )
        conn.commit()
        logger.info(f"Saved {len(chunks)} embeddings for contract {contract_id}")


# =============================================
# PIPELINE RUNNER
# =============================================

def run_week2_pipeline(contract_id: str):
    """
    Runs Stage 3 (chunking) + Stage 4 (embeddings).
    Reads bbox_coords already saved by Week 1 pipeline.
    """
    logger.info(f"=== Starting Week 2 pipeline for contract {contract_id} ===")

    conn = get_db_connection()

    try:
        # Load bbox blocks from database (saved in Week 1)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, page_number, raw_text, block_index
                FROM bbox_coords
                WHERE contract_id = %s
                ORDER BY page_number, block_index
                """,
                (contract_id,),
            )
            blocks = [
                {"id": str(row[0]), "page_number": row[1],
                 "raw_text": row[2], "block_index": row[3]}
                for row in cur.fetchall()
            ]

        logger.info(f"Loaded {len(blocks)} blocks from database")

        # Stage 3: chunk
        chunker = ClauseChunker()
        chunks = chunker.chunk(blocks)
        saved_chunks = chunker.save_chunks(conn, contract_id, chunks)

        # Stage 4: embed
        embedder = EmbeddingGenerator()
        embedder.embed_chunks(conn, contract_id, saved_chunks)

        logger.info("=== Week 2 pipeline complete ===")
        logger.info(f"  Chunks created: {len(saved_chunks)}")
        logger.info(f"  Embeddings stored: {len(saved_chunks)}")

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise
    finally:
        conn.close()


# =============================================
# ENTRYPOINT
# =============================================

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ContractScan Week 2 — Chunking + Embeddings")
    parser.add_argument("--contract-id", required=True, help="Contract UUID from Week 1")
    args = parser.parse_args()

    run_week2_pipeline(args.contract_id)
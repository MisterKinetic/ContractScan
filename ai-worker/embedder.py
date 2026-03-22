"""
ContractScan — Week 2
Stage 3: Semantic Chunking (clause boundary detection)
Stage 4: Embedding generation → PGVector
"""

import os
import re
import uuid
from pathlib import Path

import psycopg2
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from loguru import logger

load_dotenv(Path(__file__).parent.parent / ".env")

def publish_progress(contract_id: str, stage: str, message: str, percent: int):
    try:
        import redis
        import json
        r = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379))
        )
        payload = json.dumps({
            "contractId": contract_id,
            "stage": stage,
            "message": message,
            "percent": percent
        })
        r.publish(f"progress:{contract_id}", payload)
    except Exception as e:
        logger.warning(f"Could not publish progress: {e}")



def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "contractscan"),
        user=os.getenv("DB_USER", "contractscan"),
        password=os.getenv("DB_PASSWORD", "password"),
    )

class ClauseChunker:
    OVERLAP_RATIO = 0.10

    def is_clause_boundary(self, text: str) -> bool:
        text = text.strip()
        if len(text) < 8:
            return False
        if re.match(r'^\d+$', text):
            return False
        if re.match(r'^\d+[\.\)]\s+[A-Z]', text):
            return True
        words = text.split()
        if len(words) >= 1 and text == text.upper() and len(text) > 4:
            return True
        if re.match(r'^(SECTION|ARTICLE|CLAUSE)\s+[\dIVXivx]+', text, re.IGNORECASE):
            return True
        return False

    def chunk(self, blocks: list[dict]) -> list[dict]:
        chunks = []
        current_chunk_blocks = []
        chunk_index = 0
        MAX_BLOCKS_PER_CHUNK = 8

        for block in blocks:
            text = block['raw_text'].strip()
            if not text:
                continue

            is_boundary = self.is_clause_boundary(text) and current_chunk_blocks
            is_too_long = len(current_chunk_blocks) >= MAX_BLOCKS_PER_CHUNK

            if is_boundary or is_too_long:
                chunk_text = "\n".join(b['raw_text'] for b in current_chunk_blocks)
                overlap_count = max(1, int(len(current_chunk_blocks) * self.OVERLAP_RATIO))

                chunks.append({
                    "chunk_index": chunk_index,
                    "raw_text": chunk_text,
                    "start_bbox_id": current_chunk_blocks[0]['id'],
                    "end_bbox_id": current_chunk_blocks[-1]['id'],
                    "bbox_ids": [b['id'] for b in current_chunk_blocks],
                })
                chunk_index += 1
                current_chunk_blocks = current_chunk_blocks[-overlap_count:]

            current_chunk_blocks.append(block)

        if current_chunk_blocks:
            chunk_text = "\n".join(b['raw_text'] for b in current_chunk_blocks)
            chunks.append({
                "chunk_index": chunk_index,
                "raw_text": chunk_text,
                "start_bbox_id": current_chunk_blocks[0]['id'],
                "end_bbox_id": current_chunk_blocks[-1]['id'],
                "bbox_ids": [b['id'] for b in current_chunk_blocks],
            })

        logger.info(f"Created {len(chunks)} clause chunks from {len(blocks)} blocks")
        return chunks

    def save_chunks(self, conn, contract_id: str, chunks: list[dict]) -> list[dict]:
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
                        chunk['raw_text'],
                        chunk['start_bbox_id'],
                        chunk['end_bbox_id'],
                    ),
                )
                for bbox_id in chunk.get('bbox_ids', []):
                    cur.execute(
                        """
                        INSERT INTO chunk_bbox_map (clause_chunk_id, bbox_coord_id)
                        VALUES (%s, %s)
                        """,
                        (chunk_id, bbox_id),
                    )
                saved.append({**chunk, "id": chunk_id})
        conn.commit()
        logger.info(f"Saved {len(saved)} chunks for contract {contract_id}")
        return saved


class EmbeddingGenerator:
    MODEL_NAME = "all-mpnet-base-v2"

    def __init__(self):
        logger.info(f"Loading embedding model {self.MODEL_NAME}...")
        self.model = SentenceTransformer(self.MODEL_NAME)
        logger.info("Embedding model loaded.")

    def embed_chunks(self, conn, contract_id: str, chunks: list[dict]):
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


def run_week2_pipeline(contract_id: str):
    logger.info(f"=== Starting Week 2 pipeline for contract {contract_id} ===")
    conn = get_db_connection()

    try:
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
        publish_progress(contract_id, "chunking", "Detecting clause boundaries...", 45)

        chunker = ClauseChunker()
        chunks = chunker.chunk(blocks)
        saved_chunks = chunker.save_chunks(conn, contract_id, chunks)
        publish_progress(contract_id, "embedding", "Generating semantic embeddings...", 60)

        embedder = EmbeddingGenerator()
        embedder.embed_chunks(conn, contract_id, saved_chunks)
        publish_progress(contract_id, "stage2_done", "Embeddings stored", 70)

        logger.info("=== Week 2 pipeline complete ===")
        logger.info(f"  Chunks created: {len(saved_chunks)}")
        logger.info(f"  Embeddings stored: {len(saved_chunks)}")

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ContractScan Week 2 — Chunking + Embeddings")
    parser.add_argument("--contract-id", required=True, help="Contract UUID from Week 1")
    args = parser.parse_args()

    run_week2_pipeline(args.contract_id)
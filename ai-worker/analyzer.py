"""
ContractScan — Week 3 (Optimized)
Stage 5: RAG Retrieval
Stage 6: LLM Analysis (Ollama local) — parallel processing
Stage 7: Coordinate Mapping
"""

import os
import json
import re
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2
import psycopg2.pool
import httpx
from dotenv import load_dotenv
from loguru import logger

load_dotenv(Path(__file__).parent.parent / ".env")

connection_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", 5432),
    dbname=os.getenv("DB_NAME", "contractscan"),
    user=os.getenv("DB_USER", "contractscan"),
    password=os.getenv("DB_PASSWORD", "password"),
)

def get_conn():
    return connection_pool.getconn()

def release_conn(conn):
    connection_pool.putconn(conn)

class RAGRetriever:
    def get_similar_chunks(self, conn, chunk_id: str, contract_id: str, top_k: int = 2) -> list[str]:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cc.raw_text
                FROM clause_embeddings ce
                JOIN clause_chunks cc ON cc.id = ce.clause_chunk_id
                ORDER BY ce.embedding <=> (
                    SELECT embedding FROM clause_embeddings
                    WHERE clause_chunk_id = %s
                    LIMIT 1
                )
                LIMIT %s
                """,
                (chunk_id, top_k + 1),
            )
            rows = cur.fetchall()
            return [row[0] for row in rows if row[0]][:top_k]

class LLMAnalyzer:
    OLLAMA_URL = "http://localhost:11434/api/generate"
    MODEL = "qwen2.5:7b"
    _client = httpx.Client(timeout=60.0)

    def build_prompt(self, chunk_text: str) -> str:
        return f"""You are an expert legal analyst reviewing contracts for freelancers and small businesses.
Analyze this contract clause carefully and respond ONLY with a valid JSON object.

Clause to analyze:
{chunk_text[:600]}

Classification rules:
- RED: Clause is seriously unfair or dangerous. Examples: unlimited IP assignment, worldwide non-compete, no payment on termination, unlimited liability, forced arbitration waiving all rights, unilateral contract changes
- YELLOW: Clause needs review, slightly one-sided but not dangerous. Examples: short payment terms, vague scope, standard arbitration, moderate non-compete
- GREEN: Clause is fair and standard. Examples: reasonable confidentiality, mutual termination notice, standard IP for deliverables only, clear payment terms

Be decisive. Most contracts have a mix of red, yellow, and green clauses.
If a clause clearly protects only one party heavily — it is RED.
If a clause is standard boilerplate that is fair to both parties — it is GREEN.

Respond with exactly this JSON:
{{"risk_level":"red or yellow or green","clause_type":"ip_ownership or non_compete or liability or payment or termination or confidentiality or other","plain_english":"explain in 1-2 simple sentences what this means for the freelancer","suggestion":"specific fairer alternative wording if red or yellow, null if green","confidence":0.0}}"""

    def analyze(self, chunk_text: str) -> dict | None:
        try:
            response = self._client.post(
                self.OLLAMA_URL,
                json={
                    "model": self.MODEL,
                    "prompt": self.build_prompt(chunk_text),
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 300,
                    },
                },
            )
            response.raise_for_status()
            raw = response.json()["response"].strip()
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            return None
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return None

class CoordinateMapper:
    def save_finding(self, conn, contract_id, chunk_id, bbox_id, analysis):
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO legal_findings
                    (contract_id, clause_chunk_id, bbox_coord_id,
                     risk_level, clause_type, plain_english_text,
                     suggested_alternative, llm_model_used, confidence_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    contract_id,
                    chunk_id,
                    bbox_id,
                    analysis.get("risk_level", "green"),
                    analysis.get("clause_type", "other"),
                    analysis.get("plain_english", ""),
                    analysis.get("suggestion"),
                    LLMAnalyzer.MODEL,
                    analysis.get("confidence", 0.5),
                ),
            )
        conn.commit()

def process_chunk(chunk: dict, contract_id: str) -> dict:
    conn = get_conn()
    analyzer = LLMAnalyzer()
    mapper = CoordinateMapper()

    try:
        analysis = analyzer.analyze(chunk["raw_text"])

        if analysis is None:
            return {"status": "failed", "chunk_index": chunk["chunk_index"]}

        mapper.save_finding(
            conn,
            contract_id,
            chunk["id"],
            chunk["start_bbox_id"],
            analysis,
        )

        return {
            "status": "ok",
            "chunk_index": chunk["chunk_index"],
            "risk_level": analysis.get("risk_level"),
            "clause_type": analysis.get("clause_type"),
        }

    except Exception as e:
        logger.error(f"Chunk {chunk['chunk_index']} failed: {e}")
        return {"status": "failed", "chunk_index": chunk["chunk_index"]}
    finally:
        release_conn(conn)

def run_week3_pipeline(contract_id: str, max_workers: int = 4):
    logger.info(f"=== Starting Week 3 pipeline (parallel, {max_workers} workers) ===")
    start_time = time.time()

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM legal_findings WHERE contract_id = %s",
            (contract_id,)
        )
    conn.commit()
    release_conn(conn)

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, chunk_index, raw_text, start_bbox_id
            FROM clause_chunks
            WHERE contract_id = %s
            ORDER BY chunk_index
            """,
            (contract_id,),
        )
        chunks = [
            {
                "id": str(row[0]),
                "chunk_index": row[1],
                "raw_text": row[2],
                "start_bbox_id": str(row[3]) if row[3] else None,
            }
            for row in cur.fetchall()
        ]
    release_conn(conn)

    logger.info(f"Analyzing {len(chunks)} chunks with {max_workers} parallel workers...")

    results = {"red": 0, "yellow": 0, "green": 0, "failed": 0}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_chunk, chunk, contract_id): chunk
            for chunk in chunks
        }

        for future in as_completed(futures):
            result = future.result()
            if result["status"] == "failed":
                results["failed"] += 1
            else:
                risk = result.get("risk_level", "unknown")
                results[risk] = results.get(risk, 0) + 1
                logger.info(
                    f"  ✓ Chunk {result['chunk_index']+1}/{len(chunks)}: "
                    f"{risk} — {result.get('clause_type')}"
                )

    elapsed = round(time.time() - start_time, 1)

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE contracts SET status = 'complete', processing_completed_at = NOW() WHERE id = %s",
            (contract_id,),
        )
    conn.commit()
    release_conn(conn)

    logger.info(f"=== Week 3 complete in {elapsed} seconds ===")
    logger.info(f"  Red flags: {results['red']}")
    logger.info(f"  Cautions:  {results['yellow']}")
    logger.info(f"  Fair:      {results['green']}")
    logger.info(f"  Failed:    {results['failed']}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract-id", required=True)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    run_week3_pipeline(args.contract_id, args.workers)

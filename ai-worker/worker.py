"""
ContractScan — AI Worker
Week 1 Implementation: Stage 1 (PII Redaction) + Stage 2 (PDF Parsing)

Run: python worker.py --pdf path/to/contract.pdf --contract-id <uuid>

This script is intentionally runnable standalone (no Java backend needed)
so you can test the pipeline before wiring up Spring Boot.
"""

import os
import sys
import uuid
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

import fitz  # PyMuPDF
import spacy
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from loguru import logger

load_dotenv(Path(__file__).parent.parent / ".env")

def publish_progress(contract_id: str, stage: str, message: str, percent: int):
    """Push progress update to Redis so Spring Boot can forward to WebSocket."""
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

# =============================================
# DATA CLASSES
# =============================================

@dataclass
class BBoxBlock:
    """One text block extracted from the PDF with its coordinates."""
    page_number: int
    x: float
    y: float
    width: float
    height: float
    raw_text: str
    block_index: int


@dataclass
class RedactionResult:
    """Result of Stage 1 PII redaction."""
    anonymized_text: str
    token_map: dict[str, str]  # {"{{PERSON_1}}": "John Smith", ...}


# =============================================
# DATABASE CONNECTION
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
# STAGE 1 — PII REDACTION
# =============================================

class PIIRedactor:
    """
    Replaces named entities with consistent tokens before any text
    leaves the server. Builds a mapping table for later restoration.

    Uses spaCy's en_core_web_lg model for NER.
    Entity types detected: PERSON, ORG, GPE (locations)

    Example:
        Input:  "John Smith agrees that Acme Corp will pay..."
        Output: "{{PERSON_1}} agrees that {{ORG_1}} will pay..."
        Map:    {"{{PERSON_1}}": "John Smith", "{{ORG_1}}": "Acme Corp"}
    """

    ENTITY_TYPES = {"PERSON", "ORG", "GPE"}

    def __init__(self):
        logger.info("Loading spaCy model en_core_web_lg...")
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            logger.error(
                "spaCy model not found. Run: python -m spacy download en_core_web_lg"
            )
            sys.exit(1)
        logger.info("spaCy model loaded.")

    def redact(self, text: str) -> RedactionResult:
        """
        Redact PII from text. Returns anonymized text and the token map.
        Tokens are consistent — same entity always gets the same token.
        """
        doc = self.nlp(text)

        counters = {t: 0 for t in self.ENTITY_TYPES}
        # value_to_token ensures "John Smith" always maps to the same {{PERSON_1}}
        value_to_token: dict[str, str] = {}
        token_map: dict[str, str] = {}

        result_text = text

        # Process entities in reverse order so string positions don't shift
        entities = [ent for ent in doc.ents if ent.label_ in self.ENTITY_TYPES]
        entities_sorted = sorted(entities, key=lambda e: e.start_char, reverse=True)

        for ent in entities_sorted:
            original = ent.text.strip()
            if not original:
                continue

            if original not in value_to_token:
                counters[ent.label_] += 1
                token = f"{{{{{ent.label_}_{counters[ent.label_]}}}}}"
                value_to_token[original] = token
                token_map[token] = original

            replacement = value_to_token[original]
            result_text = (
                result_text[: ent.start_char]
                + replacement
                + result_text[ent.end_char :]
            )

        return RedactionResult(anonymized_text=result_text, token_map=token_map)

    def save_token_map(self, conn, contract_id: str, token_map: dict[str, str]):
        """Persist the token → real value mapping to the database."""
        if not token_map:
            return

        with conn.cursor() as cur:
            for token, real_value in token_map.items():
                # Determine entity type from token format e.g. {{PERSON_1}}
                entity_type = token.strip("{}").split("_")[0]
                cur.execute(
                    """
                    INSERT INTO pii_token_map (contract_id, token, real_value, entity_type)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (contract_id, token, real_value, entity_type),
                )
        conn.commit()
        logger.info(f"Saved {len(token_map)} PII tokens for contract {contract_id}")


# =============================================
# STAGE 2 — PDF PARSING
# =============================================

class PDFParser:
    def parse(self, pdf_path: str) -> tuple[list[BBoxBlock], int]:
        logger.info(f"Parsing PDF: {pdf_path}")
        doc = fitz.open(pdf_path)
        blocks: list[BBoxBlock] = []
        block_index = 0

        for page_num in range(len(doc)):
            page = doc[page_num]
            raw_blocks = page.get_text("blocks")

            for raw in raw_blocks:
                x0, y0, x1, y1, text, _, block_type = raw

                if block_type != 0:
                    continue

                text = text.strip()
                if not text:
                    continue

                blocks.append(BBoxBlock(
                    page_number=page_num + 1,
                    x=round(x0, 2),
                    y=round(y0, 2),
                    width=round(x1 - x0, 2),
                    height=round(y1 - y0, 2),
                    raw_text=text,
                    block_index=block_index,
                ))
                block_index += 1

        doc.close()
        logger.info(f"Extracted {len(blocks)} text blocks from {page_num + 1} pages")
        return blocks, page_num + 1

    def save_blocks(self, conn, contract_id: str, blocks: list[BBoxBlock]):
        with conn.cursor() as cur:
            for block in blocks:
                cur.execute(
                    """
                    INSERT INTO bbox_coords
                        (contract_id, page_number, x, y, width, height, raw_text, block_index)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        contract_id,
                        block.page_number,
                        block.x,
                        block.y,
                        block.width,
                        block.height,
                        block.raw_text,
                        block.block_index,
                    ),
                )
        conn.commit()
        logger.info(f"Saved {len(blocks)} bbox blocks for contract {contract_id}")


# =============================================
# PIPELINE RUNNER
# =============================================

def run_week1_pipeline(pdf_path: str, contract_id: str):
    """
    Runs Stage 1 (PII redaction) + Stage 2 (PDF parsing).
    After this runs, the database has:
    - bbox_coords rows for every text block
    - pii_token_map rows for every detected entity
    The contract status is updated to 'processing'.
    """
    logger.info(f"=== Starting Week 1 pipeline for contract {contract_id} ===")
    publish_progress(contract_id, "parsing", "Parsing PDF structure...", 10)

    conn = get_db_connection()

    try:
        # Update contract status
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE contracts SET status = 'processing', processing_started_at = NOW() WHERE id = %s",
                (contract_id,)
            )
        conn.commit()

        # Stage 2: Parse PDF (we do this BEFORE redaction so we have raw text + coords)
        parser = PDFParser()
        blocks, page_count = parser.parse(pdf_path)
        parser.save_blocks(conn, contract_id, blocks)
        publish_progress(contract_id, "pii", "Redacting personal information...", 25)

        # Update page count
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE contracts SET page_count = %s WHERE id = %s",
                (page_count, contract_id)
            )
        conn.commit()

        # Stage 1: PII redaction — build anonymized version of full text
        redactor = PIIRedactor()
        full_text = "\n".join(b.raw_text for b in blocks)
        result = redactor.redact(full_text)
        redactor.save_token_map(conn, contract_id, result.token_map)
        publish_progress(contract_id, "stage1_done", "PDF parsed and anonymized", 35)

        logger.info("=== Week 1 pipeline complete ===")
        logger.info(f"  Pages: {page_count}")
        logger.info(f"  Blocks: {len(blocks)}")
        logger.info(f"  PII tokens found: {len(result.token_map)}")
        logger.info(f"  Sample anonymized (first 300 chars):")
        logger.info(f"  {result.anonymized_text[:300]}")

        # Update status
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE contracts SET status = 'stage1_complete' WHERE id = %s",
                (contract_id,)
            )
        conn.commit()

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE contracts SET status = 'failed' WHERE id = %s",
                (contract_id,)
            )
        conn.commit()
        raise
    finally:
        conn.close()


# =============================================
# ENTRYPOINT
# =============================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ContractScan AI Worker — Week 1")
    parser.add_argument("--pdf", required=True, help="Path to the PDF file")
    parser.add_argument(
        "--contract-id",
        default=str(uuid.uuid4()),
        help="Contract UUID (auto-generated if not provided)",
    )
    args = parser.parse_args()

    if not Path(args.pdf).exists():
        logger.error(f"PDF not found: {args.pdf}")
        sys.exit(1)

    run_week1_pipeline(args.pdf, args.contract_id)

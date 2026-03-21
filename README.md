# ContractScan

AI-powered contract reviewer for freelancers. Privacy-first, not an AI wrapper.

## Quick Start

### Prerequisites
- Docker Desktop
- Python 3.10+
- Java 21 + Maven (for Week 4+)

### 1. Clone and configure

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

### 2. Start the data layer

```bash
docker-compose up -d
```

This starts:
- PostgreSQL + PGVector on port 5432
- Redis on port 6379
- MinIO (local S3) on port 9000 (console at http://localhost:9001)

The database schema is created automatically on first boot via `infra/postgres/init.sql`.

Verify everything is running:
```bash
docker-compose ps
```

### 3. Set up Python worker

```bash
cd ai-worker
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_lg
```

### 4. Test Week 1 pipeline (Stage 1 + 2)

```bash
# From ai-worker/ with venv activated
python worker.py --pdf /path/to/any/contract.pdf
```

This will:
1. Parse the PDF and extract all text blocks with bounding box coordinates
2. Run spaCy NER to detect and replace PII with tokens
3. Store everything in PostgreSQL

Check the results:
```bash
docker exec -it contractscan-db psql -U contractscan -d contractscan -c "SELECT page_number, x, y, raw_text FROM bbox_coords LIMIT 10;"
docker exec -it contractscan-db psql -U contractscan -d contractscan -c "SELECT token, real_value, entity_type FROM pii_token_map;"
```

## Project Structure

```
ContractScan/
├── docker-compose.yml          # Starts the full data layer locally
├── .env.example                # Copy to .env, add your API keys
├── infra/
│   └── postgres/
│       └── init.sql            # Full database schema, auto-runs on first boot
├── ai-worker/                  # Python — the 7-stage AI pipeline
│   ├── worker.py               # Stage 1 (PII) + Stage 2 (PDF parse) — Week 1
│   └── requirements.txt
├── backend-orchestrator/       # Java Spring Boot — Week 4
└── frontend-client/            # React — Week 5
```

## Build Order

| Week | What you build | Tech |
|------|---------------|------|
| 1 | PDF parsing + PII redaction | Python, spaCy, PyMuPDF |
| 2 | Chunking + embeddings | Python, sentence-transformers, PGVector |
| 3 | LLM integration + coord mapping | Python, Anthropic SDK |
| 4 | REST API + job queue | Java, Spring Boot, Redis |
| 5 | Frontend + PDF viewer | React |
| 6 | Auth + polish | OAuth2, share links |

## Useful Docker Commands

```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose down -v        # Stop and DELETE all data (fresh start)
docker-compose logs -f db     # Watch database logs
docker exec -it contractscan-db psql -U contractscan -d contractscan
```

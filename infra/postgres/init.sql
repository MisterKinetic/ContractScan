-- Run automatically on first container boot
-- Enables pgvector and creates the full ContractScan schema

-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS vector;         -- pgvector — THIS IS THE CRITICAL ONE

-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255),
    auth_provider   VARCHAR(50) NOT NULL DEFAULT 'email',  -- google, github, email
    tier            VARCHAR(20) NOT NULL DEFAULT 'free',   -- free, pro
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================
-- CONTRACTS
-- =============================================
CREATE TABLE contracts (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename           VARCHAR(500) NOT NULL,
    s3_key                      VARCHAR(1000) NOT NULL,
    status                      VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    -- status values: uploaded, processing, complete, failed
    page_count                  INTEGER,
    processing_started_at       TIMESTAMP,
    processing_completed_at     TIMESTAMP,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- =============================================
-- CONTRACT VERSIONS (for version comparison feature)
-- =============================================
CREATE TABLE contract_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    s3_key          VARCHAR(1000) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, version_number)
);

-- =============================================
-- BOUNDING BOX COORDS (populated in Stage 2 — PDF parse)
-- Every text block in every PDF gets a row here
-- =============================================
CREATE TABLE bbox_coords (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    page_number     INTEGER NOT NULL,
    x               FLOAT NOT NULL,
    y               FLOAT NOT NULL,
    width           FLOAT NOT NULL,
    height          FLOAT NOT NULL,
    raw_text        TEXT NOT NULL,
    block_index     INTEGER NOT NULL,  -- order of block on the page
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bbox_contract_id ON bbox_coords(contract_id);
CREATE INDEX idx_bbox_page ON bbox_coords(contract_id, page_number);

-- =============================================
-- CLAUSE CHUNKS (populated in Stage 3 — chunking)
-- =============================================
CREATE TABLE clause_chunks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id         UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    chunk_index         INTEGER NOT NULL,
    raw_text            TEXT NOT NULL,
    anonymized_text     TEXT NOT NULL,
    start_bbox_id       UUID REFERENCES bbox_coords(id),
    end_bbox_id         UUID REFERENCES bbox_coords(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_contract_id ON clause_chunks(contract_id);

-- =============================================
-- CLAUSE EMBEDDINGS (populated in Stage 4 — embed)
-- vector(768) matches sentence-transformers default output dim
-- =============================================
CREATE TABLE clause_embeddings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_chunk_id     UUID NOT NULL REFERENCES clause_chunks(id) ON DELETE CASCADE,
    embedding           vector(768) NOT NULL,
    model_used          VARCHAR(255) NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest-neighbour search
-- Create AFTER data is loaded (not before) for best results
-- CREATE INDEX ON clause_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================
-- LEGAL FINDINGS (populated in Stage 7 — the main output table)
-- =============================================
CREATE TABLE legal_findings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id             UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    clause_chunk_id         UUID NOT NULL REFERENCES clause_chunks(id),
    bbox_coord_id           UUID REFERENCES bbox_coords(id),
    risk_level              VARCHAR(20) NOT NULL,   -- red, yellow, green
    clause_type             VARCHAR(50) NOT NULL,   -- non_compete, ip_ownership, liability, payment, termination, confidentiality, other
    plain_english_text      TEXT NOT NULL,
    suggested_alternative   TEXT,
    llm_model_used          VARCHAR(100) NOT NULL,
    confidence_score        FLOAT,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_findings_contract_id ON legal_findings(contract_id);
CREATE INDEX idx_findings_risk_level ON legal_findings(risk_level);

-- =============================================
-- PII TOKEN MAP (populated in Stage 1 — redaction)
-- real_value would be encrypted in production
-- =============================================
CREATE TABLE pii_token_map (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    token           VARCHAR(100) NOT NULL,   -- e.g. {{PERSON_1}}
    real_value      TEXT NOT NULL,           -- e.g. "John Smith" (encrypt in prod)
    entity_type     VARCHAR(50) NOT NULL,    -- PERSON, ORG, GPE
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pii_contract_id ON pii_token_map(contract_id);

-- =============================================
-- SEED: default test user for local dev
-- =============================================
INSERT INTO users (email, name, auth_provider, tier)
VALUES ('dev@contractscan.local', 'Dev User', 'email', 'pro');

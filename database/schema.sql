-- ============================================
-- RegulateAI Database Schema
-- EU AI Act Compliance Logging Platform
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. ORGANIZATIONS (multi-tenant root)
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country_code VARCHAR(2),                    -- "IN", "DE", "US" etc.
    gst_number VARCHAR(20),                    -- India GST for future billing
    website VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. USERS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),                 -- NULL if using OAuth
    auth_provider VARCHAR(50) DEFAULT 'email',  -- 'email', 'google', 'github'
    role VARCHAR(20) DEFAULT 'admin',         -- 'admin', 'member', 'viewer'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);

-- ============================================
-- 3. PROJECTS (one org can have multiple AI systems)
-- ============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,               -- "My AI Chatbot"
    description TEXT,
    
    -- Risk assessment results (populated after wizard completion)
    risk_tier VARCHAR(20),                   -- 'PROHIBITED', 'HIGH', 'LIMITED', 'MINIMAL'
    compliance_score INTEGER DEFAULT 0,      -- 0-100
    risk_assessment_data JSONB,               -- full wizard answers + results
    risk_assessed_at TIMESTAMPTZ,
    
    -- DPDP Act
    dpdp_applicable BOOLEAN DEFAULT FALSE,
    dpdp_risk_tier VARCHAR(20),
    
    -- Metadata
    status VARCHAR(20) DEFAULT 'active',     -- 'active', 'archived'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(org_id);

-- ============================================
-- 4. API KEYS (for SDK authentication)
-- ============================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,          -- hashed version of the key
    key_prefix VARCHAR(20) NOT NULL,         -- "rl_live_a8f3" — for display
    name VARCHAR(100) DEFAULT 'Default',     -- user-friendly name
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_project ON api_keys(project_id);

-- ============================================
-- 5. AI LOGS (core SDK logging table)
-- ============================================
CREATE TABLE ai_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    project_id UUID NOT NULL,
    api_key_id UUID,
    
    -- What the AI did (Art. 12 — Record-keeping)
    prompt TEXT,                              -- input to the AI
    output TEXT,                              -- AI's response
    model VARCHAR(100),                      -- "gpt-4o"
    model_version VARCHAR(100),               -- "gpt-4o-2024-08-06" (exact version)
    
    -- Performance metrics (Art. 15 — Accuracy & Robustness)
    confidence FLOAT,                        -- 0.0 to 1.0
    latency_ms INTEGER,                      -- response time in milliseconds
    tokens_input INTEGER,                    -- input token count
    tokens_output INTEGER,                   -- output token count
    
    -- Human oversight (Art. 14)
    human_reviewed BOOLEAN DEFAULT FALSE,    -- was this decision reviewed by a human?
    human_reviewer_id VARCHAR(100),          -- who reviewed it (optional)
    human_review_notes TEXT,                 -- review notes (optional)
    
    -- System context
    framework VARCHAR(50),                  -- "openai", "langchain", "vercel-ai", "crewai", "custom"
    status VARCHAR(20) DEFAULT 'success',    -- "success", "error", "timeout"
    error_message TEXT,                     -- error details if status != success
    
    -- Traceability (Art. 12)
    session_id VARCHAR(100),                 -- group related decisions
    user_identifier VARCHAR(255),            -- end-user who triggered this (hashed/anonymized)
    
    -- Flexible metadata
    metadata JSONB DEFAULT '{}',             -- any custom key-value pairs
    
    -- SDK info
    sdk_version VARCHAR(20),                 -- "1.0.0"
    sdk_language VARCHAR(10),                -- "node", "python"
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_logs_org_project ON ai_logs(org_id, project_id);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
CREATE INDEX idx_ai_logs_model ON ai_logs(model);
CREATE INDEX idx_ai_logs_status ON ai_logs(status);
CREATE INDEX idx_ai_logs_session ON ai_logs(session_id);
CREATE INDEX idx_ai_logs_human_reviewed ON ai_logs(human_reviewed);

-- Full-text search on prompt
CREATE INDEX idx_ai_logs_prompt_search ON ai_logs USING GIN(to_tsvector('english', prompt));

-- ============================================
-- 6. COMPLIANCE DOCUMENTS (generated docs)
-- ============================================
CREATE TABLE compliance_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    document_type VARCHAR(50) NOT NULL,      -- 'technical_doc', 'risk_plan', 'bias_assessment',
                                              -- 'human_oversight', 'data_governance', 'declaration_conformity'
    title VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft',      -- 'draft', 'review', 'final'
    
    -- Content
    content JSONB NOT NULL,                  -- structured document data (sections + fields)
    form_data JSONB,                         -- user's form inputs that generated this doc
    
    -- Metadata
    generated_by VARCHAR(50) DEFAULT 'template', -- 'template', 'ai', 'manual'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_project ON compliance_documents(project_id);
CREATE INDEX idx_docs_type ON compliance_documents(document_type);

-- ============================================
-- 7. DOCUMENT VERSIONS (audit trail)
-- ============================================
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES compliance_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_versions ON document_versions(document_id, version);

-- ============================================
-- 8. RISK ASSESSMENTS (wizard results)
-- ============================================
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Can be anonymous (no org/project) for free landing page assessment
    email VARCHAR(255),                     -- captured on PDF download
    company_name VARCHAR(255),
    
    -- Assessment data
    answers JSONB NOT NULL,                 -- all wizard question answers
    
    -- Results
    risk_tier VARCHAR(20) NOT NULL,         -- 'PROHIBITED', 'HIGH', 'LIMITED', 'MINIMAL'
    compliance_score INTEGER NOT NULL,      -- 0-100
    matched_articles TEXT[],                 -- ARRAY['Art. 6', 'Art. 9', ...]
    obligations JSONB NOT NULL,             -- full obligations list with priorities
    documents_required TEXT[],               -- ARRAY['technical_doc', 'risk_plan', ...]
    
    -- DPDP
    dpdp_applicable BOOLEAN DEFAULT FALSE,
    dpdp_obligations JSONB,
    
    -- Timeline
    estimated_effort VARCHAR(50),           -- "2-4 weeks"
    urgency VARCHAR(20),                    -- "immediate", "3_months", "6_months"
    
    -- Report
    report_downloaded BOOLEAN DEFAULT FALSE,
    report_downloaded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_email ON risk_assessments(email);
CREATE INDEX idx_assessments_tier ON risk_assessments(risk_tier);
CREATE INDEX idx_assessments_project ON risk_assessments(project_id);

-- ============================================
-- 9. MODEL CHANGES (auto-detected by SDK)
-- ============================================
CREATE TABLE model_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    previous_model VARCHAR(100),
    previous_version VARCHAR(100),
    new_model VARCHAR(100),
    new_version VARCHAR(100),
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id)
);

CREATE INDEX idx_model_changes_project ON model_changes(project_id);

-- ============================================
-- 10. ALERTS (compliance notifications)
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    
    type VARCHAR(50) NOT NULL,               -- 'score_drop', 'doc_expiring', 'model_change',
                                              -- 'low_human_review', 'anomaly', 'deadline'
    severity VARCHAR(20) NOT NULL,           -- 'critical', 'warning', 'info'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_org ON alerts(org_id, is_read);

-- ============================================
-- VIEWS
-- ============================================

-- Daily log counts per project (for dashboard chart)
CREATE OR REPLACE VIEW daily_log_counts AS
SELECT 
    project_id,
    DATE(created_at) as log_date,
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE human_reviewed = TRUE) as human_reviewed_count,
    COUNT(*) FILTER (WHERE status = 'error') as error_count,
    AVG(latency_ms) as avg_latency,
    AVG(confidence) FILTER (WHERE confidence IS NOT NULL) as avg_confidence
FROM ai_logs
GROUP BY project_id, DATE(created_at);

-- Model distribution per project
CREATE OR REPLACE VIEW model_distribution AS
SELECT
    project_id,
    model,
    model_version,
    COUNT(*) as usage_count,
    AVG(latency_ms) as avg_latency,
    AVG(confidence) FILTER (WHERE confidence IS NOT NULL) as avg_confidence
FROM ai_logs
GROUP BY project_id, model, model_version;

-- Compliance summary per project
CREATE OR REPLACE VIEW project_compliance_summary AS
SELECT
    p.id as project_id,
    p.name as project_name,
    p.risk_tier,
    p.compliance_score,
    COUNT(DISTINCT al.id) as total_logs,
    COUNT(DISTINCT al.id) FILTER (WHERE al.human_reviewed = TRUE) as human_reviewed_logs,
    ROUND(
        COUNT(DISTINCT al.id) FILTER (WHERE al.human_reviewed = TRUE)::NUMERIC / 
        NULLIF(COUNT(DISTINCT al.id), 0) * 100, 1
    ) as human_review_percentage,
    COUNT(DISTINCT cd.id) as documents_created,
    COUNT(DISTINCT cd.id) FILTER (WHERE cd.status = 'final') as documents_finalized,
    MAX(al.created_at) as last_log_at
FROM projects p
LEFT JOIN ai_logs al ON al.project_id = p.id
LEFT JOIN compliance_documents cd ON cd.project_id = p.id
GROUP BY p.id, p.name, p.risk_tier, p.compliance_score;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate compliance score for a project
CREATE OR REPLACE FUNCTION calculate_compliance_score(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
    v_risk_tier VARCHAR(20);
    v_docs_required INTEGER;
    v_docs_created INTEGER;
    v_total_logs BIGINT;
    v_review_rate NUMERIC;
BEGIN
    -- Get project info
    SELECT risk_tier, compliance_score INTO v_risk_tier FROM projects WHERE id = p_project_id;
    
    -- Risk assessment completed (20 points)
    IF v_risk_tier IS NOT NULL THEN
        v_score := v_score + 20;
    END IF;
    
    -- Documents (40 points)
    SELECT COUNT(*) INTO v_docs_required 
    FROM compliance_documents 
    WHERE project_id = p_project_id;
    
    SELECT COUNT(*) INTO v_docs_created 
    FROM compliance_documents 
    WHERE project_id = p_project_id AND status = 'final';
    
    IF v_docs_required > 0 THEN
        v_score := v_score + ROUND((v_docs_created::NUMERIC / v_docs_required) * 40);
    END IF;
    
    -- SDK logging active (20 points)
    SELECT COUNT(*) INTO v_total_logs FROM ai_logs WHERE project_id = p_project_id;
    IF v_total_logs > 0 THEN
        v_score := v_score + 10;
    END IF;
    IF v_total_logs > 100 THEN
        v_score := v_score + 5;
    END IF;
    IF v_total_logs > 1000 THEN
        v_score := v_score + 5;
    END IF;
    
    -- Human review rate (20 points)
    SELECT ROUND(
        COUNT(*) FILTER (WHERE human_reviewed = TRUE)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 1
    ) INTO v_review_rate
    FROM ai_logs WHERE project_id = p_project_id;
    
    IF v_review_rate > 5 THEN v_score := v_score + 5; END IF;
    IF v_review_rate > 10 THEN v_score := v_score + 5; END IF;
    IF v_review_rate > 20 THEN v_score := v_score + 5; END IF;
    IF v_review_rate > 50 THEN v_score := v_score + 5; END IF;
    
    RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

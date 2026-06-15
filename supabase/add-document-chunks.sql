-- ============================================================
-- Migração: Sistema Universal de Documentos para Tribuna IA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela de chunks de documentos (texto indexado por conversa/agente)
CREATE TABLE IF NOT EXISTS public.ai_document_chunks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID,
    agent_id        UUID,
    file_name       TEXT        NOT NULL,
    file_type       TEXT        NOT NULL,
    chunk_index     INTEGER     NOT NULL DEFAULT 0,
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_document_chunks" ON public.ai_document_chunks;
CREATE POLICY "users_own_document_chunks"
  ON public.ai_document_chunks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_doc_chunks_conversation
  ON public.ai_document_chunks(conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_chunks_agent
  ON public.ai_document_chunks(agent_id)
  WHERE agent_id IS NOT NULL;

-- Tabela de logs de extração (auditoria)
CREATE TABLE IF NOT EXISTS public.ai_document_logs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id   UUID,
    agent_id          UUID,
    file_name         TEXT        NOT NULL,
    extraction_method TEXT,
    pages             INTEGER,
    extracted_chars   INTEGER,
    status            TEXT        NOT NULL DEFAULT 'success',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_document_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_document_logs" ON public.ai_document_logs;
CREATE POLICY "users_own_document_logs"
  ON public.ai_document_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Garante que intranet_agents tem as colunas de base de conhecimento
-- (idempotente — já pode ter sido criado por add-agent-knowledge.sql)
ALTER TABLE public.intranet_agents
  ADD COLUMN IF NOT EXISTS knowledge_base   TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_files  JSONB NOT NULL DEFAULT '[]'::jsonb;

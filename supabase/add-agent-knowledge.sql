-- Migration: adicionar campos de base de conhecimento ao intranet_agents
-- Execute este SQL no painel do Supabase (SQL Editor)

ALTER TABLE public.intranet_agents
  ADD COLUMN IF NOT EXISTS knowledge_base TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_files JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Bucket para arquivos de conhecimento dos agentes (se ainda não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-knowledge', 'agent-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket agent-knowledge
DROP POLICY IF EXISTS "agent_knowledge_select" ON storage.objects;
DROP POLICY IF EXISTS "agent_knowledge_insert" ON storage.objects;
DROP POLICY IF EXISTS "agent_knowledge_delete" ON storage.objects;

CREATE POLICY "agent_knowledge_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-knowledge');

CREATE POLICY "agent_knowledge_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-knowledge');

CREATE POLICY "agent_knowledge_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agent-knowledge');

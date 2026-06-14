-- =============================================================================
-- Fix: permite importação de casos via DataJud
-- Execute no Supabase SQL Editor (uma única vez, idempotente).
-- =============================================================================

-- 1. Corrige constraint de status para incluir 'imported'
ALTER TABLE public.casos DROP CONSTRAINT IF EXISTS casos_status_check;
ALTER TABLE public.casos
  ADD CONSTRAINT casos_status_check
  CHECK (status IN ('ativo', 'aguardando', 'arquivado', 'encerrado', 'imported'));

-- 2. Garante que todas as colunas DataJud existem
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS court             TEXT,
  ADD COLUMN IF NOT EXISTS court_name        TEXT,
  ADD COLUMN IF NOT EXISTS case_class        TEXT,
  ADD COLUMN IF NOT EXISTS subject           TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction_body TEXT,
  ADD COLUMN IF NOT EXISTS degree            TEXT,
  ADD COLUMN IF NOT EXISTS distribution_date DATE,
  ADD COLUMN IF NOT EXISTS claim_value       NUMERIC,
  ADD COLUMN IF NOT EXISTS current_phase     TEXT,
  ADD COLUMN IF NOT EXISTS last_movement     TEXT,
  ADD COLUMN IF NOT EXISTS import_source     TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS summary           TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS datajud_raw       JSONB DEFAULT '{}'::jsonb;

-- 3. Garante que colunas JSONB nunca ficam NULL nos registros existentes
UPDATE public.casos SET ai_analysis = '{}'::jsonb WHERE ai_analysis IS NULL;
UPDATE public.casos SET datajud_raw  = '{}'::jsonb WHERE datajud_raw  IS NULL;

-- 4. Grant para o role authenticated (caso tabela tenha sido criada manualmente)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.casos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_parties   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_lawyers   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_ai_outputs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_notes     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_documents TO authenticated;

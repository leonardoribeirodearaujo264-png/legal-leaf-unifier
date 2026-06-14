-- =============================================================================
-- Adiciona identification_source em case_parties
-- Execute no Supabase SQL Editor (idempotente).
-- Valores: DATAJUD | MOVIMENTACOES | IA | MANUAL
-- =============================================================================

ALTER TABLE public.case_parties
  ADD COLUMN IF NOT EXISTS identification_source TEXT DEFAULT 'DATAJUD';

-- Preenche o campo para registros existentes com base em raw_data->>'source'
UPDATE public.case_parties
SET identification_source = UPPER(COALESCE(raw_data->>'source', 'DATAJUD'))
WHERE identification_source IS NULL OR identification_source = 'DATAJUD';

-- Garante que só valores válidos podem ser inseridos
ALTER TABLE public.case_parties
  DROP CONSTRAINT IF EXISTS case_parties_identification_source_check;

ALTER TABLE public.case_parties
  ADD CONSTRAINT case_parties_identification_source_check
  CHECK (identification_source IN ('DATAJUD', 'MOVIMENTACOES', 'IA', 'MANUAL'));

-- =============================================================================
-- Adiciona tabela case_ai_analysis e colunas extras em case_documents
-- Execute no Supabase SQL Editor (idempotente).
-- =============================================================================

-- 1. Tabela de análise de IA por caso (estruturada)
CREATE TABLE IF NOT EXISTS public.case_ai_analysis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Textos da análise completa
  summary               TEXT,
  strategy              TEXT,
  questions             TEXT,
  full_analysis         TEXT,

  -- Chance de êxito
  success_chance_label  TEXT,          -- 'alta' | 'moderada' | 'baixa'
  success_chance_percent INTEGER,      -- 0-100
  success_reason        TEXT,

  -- Risco processual
  risk_label            TEXT,          -- 'critico' | 'atencao' | 'favoravel'
  risk_reason           TEXT,

  -- Próxima ação
  next_action           TEXT,

  -- Explicação ao cliente
  client_message        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Colunas extras em case_documents (para análise e extração de texto)
ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS document_type  TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary     TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by    UUID REFERENCES auth.users(id);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_case_ai_analysis_case ON public.case_ai_analysis (case_id, created_at DESC);

-- 4. Trigger de updated_at
DROP TRIGGER IF EXISTS set_case_ai_analysis_updated_at ON public.case_ai_analysis;
CREATE TRIGGER set_case_ai_analysis_updated_at
  BEFORE UPDATE ON public.case_ai_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS
ALTER TABLE public.case_ai_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_ai_analysis_select" ON public.case_ai_analysis;
CREATE POLICY "case_ai_analysis_select" ON public.case_ai_analysis FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.casos c WHERE c.id = case_ai_analysis.case_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "case_ai_analysis_insert" ON public.case_ai_analysis;
CREATE POLICY "case_ai_analysis_insert" ON public.case_ai_analysis FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.casos c WHERE c.id = case_ai_analysis.case_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "case_ai_analysis_update" ON public.case_ai_analysis;
CREATE POLICY "case_ai_analysis_update" ON public.case_ai_analysis FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.casos c WHERE c.id = case_ai_analysis.case_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "case_ai_analysis_delete" ON public.case_ai_analysis;
CREATE POLICY "case_ai_analysis_delete" ON public.case_ai_analysis FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.casos c WHERE c.id = case_ai_analysis.case_id AND c.user_id = auth.uid()
  ));

-- 6. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_ai_analysis TO authenticated;

-- Migration: Casos Inteligentes com DataJud + IA
-- Execute este SQL no painel do Supabase (SQL Editor)

-- 1. Extender tabela casos existente com campos do DataJud e IA
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS court TEXT,
  ADD COLUMN IF NOT EXISTS court_name TEXT,
  ADD COLUMN IF NOT EXISTS case_class TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction_body TEXT,
  ADD COLUMN IF NOT EXISTS degree TEXT,
  ADD COLUMN IF NOT EXISTS distribution_date DATE,
  ADD COLUMN IF NOT EXISTS claim_value NUMERIC,
  ADD COLUMN IF NOT EXISTS current_phase TEXT,
  ADD COLUMN IF NOT EXISTS last_movement TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS datajud_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT 'manual';

-- 2. Partes do processo
CREATE TABLE IF NOT EXISTS public.case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  document TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Advogados do processo
CREATE TABLE IF NOT EXISTS public.case_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  oab TEXT,
  party_name TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Movimentações do processo
CREATE TABLE IF NOT EXISTS public.case_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ,
  title TEXT NOT NULL,
  description TEXT,
  movement_type TEXT,
  is_important BOOLEAN NOT NULL DEFAULT false,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Outputs de IA por caso
CREATE TABLE IF NOT EXISTS public.case_ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON public.case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_lawyers_case_id ON public.case_lawyers(case_id);
CREATE INDEX IF NOT EXISTS idx_case_movements_case_id_date ON public.case_movements(case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_case_ai_outputs_case_id ON public.case_ai_outputs(case_id);

-- 7. RLS para novas tabelas
ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_ai_outputs ENABLE ROW LEVEL SECURITY;

-- Policies: mesmo user ou admin pode ver/editar
DROP POLICY IF EXISTS "case_parties_all" ON public.case_parties;
CREATE POLICY "case_parties_all" ON public.case_parties
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_lawyers_all" ON public.case_lawyers;
CREATE POLICY "case_lawyers_all" ON public.case_lawyers
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_movements_all" ON public.case_movements;
CREATE POLICY "case_movements_all" ON public.case_movements
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_ai_outputs_all" ON public.case_ai_outputs;
CREATE POLICY "case_ai_outputs_all" ON public.case_ai_outputs
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

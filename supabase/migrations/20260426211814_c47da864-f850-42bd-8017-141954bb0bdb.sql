-- ============================================================
-- 1. Estender advbox_lawsuits com campos do raw_data ADVBox
-- ============================================================
ALTER TABLE public.advbox_lawsuits
  ADD COLUMN IF NOT EXISTS step text,
  ADD COLUMN IF NOT EXISTS step_id integer,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS stage_id bigint,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS group_id bigint,
  ADD COLUMN IF NOT EXISTS type_acao text,
  ADD COLUMN IF NOT EXISTS type_lawsuit_id bigint,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_id bigint,
  ADD COLUMN IF NOT EXISTS process_date date,
  ADD COLUMN IF NOT EXISTS fees_money numeric,
  ADD COLUMN IF NOT EXISTS fees_expec numeric,
  ADD COLUMN IF NOT EXISTS contingency text,
  ADD COLUMN IF NOT EXISTS protocol_number text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS exit_production date,
  ADD COLUMN IF NOT EXISTS exit_execution date,
  ADD COLUMN IF NOT EXISTS last_movement_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parties_text text;

-- Backfill inicial dos campos derivados de raw_data
UPDATE public.advbox_lawsuits
SET
  step = raw_data->>'step',
  step_id = NULLIF(raw_data->>'steps_id','')::int,
  stage = raw_data->>'stage',
  stage_id = NULLIF(raw_data->>'stages_id','')::bigint,
  group_name = raw_data->>'group',
  group_id = NULLIF(raw_data->>'group_id','')::bigint,
  type_acao = raw_data->>'type',
  type_lawsuit_id = NULLIF(raw_data->>'type_lawsuit_id','')::bigint,
  responsible_name = raw_data->>'responsible',
  responsible_id = NULLIF(raw_data->>'responsible_id','')::bigint,
  process_date = NULLIF(raw_data->>'process_date','')::date,
  fees_money = NULLIF(raw_data->>'fees_money','')::numeric,
  fees_expec = NULLIF(raw_data->>'fees_expec','')::numeric,
  contingency = raw_data->>'contingency',
  protocol_number = raw_data->>'protocol_number',
  notes = raw_data->>'notes',
  parties_text = COALESCE(customer_names,'') || ' ' || COALESCE(lawyer_names,'')
WHERE raw_data IS NOT NULL;

-- Atualizar last_movement_at a partir da tabela de movements
UPDATE public.advbox_lawsuits l
SET last_movement_at = m.max_date
FROM (
  SELECT lawsuit_id, MAX(date::timestamptz) AS max_date
  FROM public.advbox_movements
  WHERE lawsuit_id IS NOT NULL
  GROUP BY lawsuit_id
) m
WHERE l.advbox_id = m.lawsuit_id;

-- Calcular is_active: step ativo (não arquivamento/marketing/RH) E movimentação <120d
-- Critério alinhado com filtro "Em andamento" do ADVBox que retorna 1.685
UPDATE public.advbox_lawsuits
SET is_active = (
  step IS NOT NULL
  AND step NOT IN ('ARQUIVAMENTO','MARKETING','RH/FINANCEIRO')
  AND (last_movement_at IS NULL OR last_movement_at >= now() - interval '120 days')
);

-- ============================================================
-- 2. Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_step ON public.advbox_lawsuits(step);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_is_active ON public.advbox_lawsuits(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_last_mov ON public.advbox_lawsuits(last_movement_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_responsible ON public.advbox_lawsuits(responsible_id);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_group ON public.advbox_lawsuits(group_id);

-- GIN+trgm para busca cross-page
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_parties_trgm ON public.advbox_lawsuits USING gin(parties_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_number_trgm ON public.advbox_lawsuits USING gin(number gin_trgm_ops);

-- ============================================================
-- 3. Tabela escritorio_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escritorio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.escritorio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem settings"
  ON public.escritorio_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sócios/admins inserem settings"
  ON public.escritorio_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Sócios/admins atualizam settings"
  ON public.escritorio_settings FOR UPDATE TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

-- Seed: meta de fechamentos do mês
INSERT INTO public.escritorio_settings (setting_key, setting_value, description)
VALUES ('meta_fechamentos_mes', '{"valor": 50}'::jsonb, 'Meta mensal de processos fechados')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 4. Tabela advbox_crm_substages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advbox_crm_substages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phase, name)
);

ALTER TABLE public.advbox_crm_substages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem substages"
  ON public.advbox_crm_substages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sócios/admins gerenciam substages"
  ON public.advbox_crm_substages FOR ALL TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

-- Adicionar coluna crm_substage_id em advbox_lawsuits
ALTER TABLE public.advbox_lawsuits
  ADD COLUMN IF NOT EXISTS crm_substage_id uuid REFERENCES public.advbox_crm_substages(id) ON DELETE SET NULL;

-- ============================================================
-- 5. Tabela advbox_sync_audit (paridade)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advbox_sync_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  advbox_count integer,
  local_count integer NOT NULL,
  diff integer GENERATED ALWAYS AS (COALESCE(advbox_count,0) - local_count) STORED,
  diff_pct numeric GENERATED ALWAYS AS (
    CASE WHEN COALESCE(advbox_count,0) = 0 THEN 0
         ELSE ROUND(((COALESCE(advbox_count,0) - local_count)::numeric / advbox_count) * 100, 2)
    END
  ) STORED,
  notes text,
  audited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advbox_sync_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sócios/admins leem audit"
  ON public.advbox_sync_audit FOR SELECT TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Service role insere audit"
  ON public.advbox_sync_audit FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_advbox_sync_audit_entity ON public.advbox_sync_audit(entity, audited_at DESC);

-- ============================================================
-- 6. Suporte a cursor pagination em sync status
-- ============================================================
ALTER TABLE public.advbox_lawsuits_sync_status
  ADD COLUMN IF NOT EXISTS last_cursor text,
  ADD COLUMN IF NOT EXISTS use_cursor boolean DEFAULT false;

ALTER TABLE public.advbox_movements_sync_status
  ADD COLUMN IF NOT EXISTS last_cursor text,
  ADD COLUMN IF NOT EXISTS use_cursor boolean DEFAULT false;
-- Habilita pg_trgm para busca por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Tabela: advbox_lawsuits
-- ============================================
CREATE TABLE IF NOT EXISTS public.advbox_lawsuits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advbox_id BIGINT NOT NULL UNIQUE,
  number TEXT,
  folder TEXT,
  distribution_date DATE,
  status TEXT,
  area TEXT,
  court TEXT,
  customers JSONB DEFAULT '[]'::jsonb,
  lawyers JSONB DEFAULT '[]'::jsonb,
  customer_names TEXT,
  lawyer_names TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_advbox_id ON public.advbox_lawsuits (advbox_id);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_status ON public.advbox_lawsuits (status);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_distribution_date ON public.advbox_lawsuits (distribution_date DESC);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_number ON public.advbox_lawsuits (number);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_customers_gin ON public.advbox_lawsuits USING GIN (customers);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_lawyers_gin ON public.advbox_lawsuits USING GIN (lawyers);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_customer_names_trgm ON public.advbox_lawsuits USING GIN (customer_names gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_lawyer_names_trgm ON public.advbox_lawsuits USING GIN (lawyer_names gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_folder_trgm ON public.advbox_lawsuits USING GIN (folder gin_trgm_ops);

ALTER TABLE public.advbox_lawsuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated approved users can view lawsuits"
  ON public.advbox_lawsuits FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Service role can manage lawsuits"
  ON public.advbox_lawsuits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_advbox_lawsuits_updated_at
  BEFORE UPDATE ON public.advbox_lawsuits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tabela: advbox_movements
-- ============================================
CREATE TABLE IF NOT EXISTS public.advbox_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advbox_id BIGINT NOT NULL UNIQUE,
  lawsuit_id BIGINT,
  lawsuit_number TEXT,
  date TIMESTAMPTZ,
  content TEXT,
  type TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advbox_movements_advbox_id ON public.advbox_movements (advbox_id);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_lawsuit_id ON public.advbox_movements (lawsuit_id);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_date ON public.advbox_movements (date DESC);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_lawsuit_number ON public.advbox_movements (lawsuit_number);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_content_trgm ON public.advbox_movements USING GIN (content gin_trgm_ops);

ALTER TABLE public.advbox_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated approved users can view movements"
  ON public.advbox_movements FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Service role can manage movements"
  ON public.advbox_movements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_advbox_movements_updated_at
  BEFORE UPDATE ON public.advbox_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Sync status tables
-- ============================================
CREATE TABLE IF NOT EXISTS public.advbox_lawsuits_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'running',
  last_offset INT DEFAULT 0,
  total_synced INT DEFAULT 0,
  total_count INT DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.advbox_lawsuits_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lawsuits sync status"
  ON public.advbox_lawsuits_sync_status FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Service role can manage lawsuits sync status"
  ON public.advbox_lawsuits_sync_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.advbox_movements_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'running',
  last_offset INT DEFAULT 0,
  total_synced INT DEFAULT 0,
  total_count INT DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.advbox_movements_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view movements sync status"
  ON public.advbox_movements_sync_status FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Service role can manage movements sync status"
  ON public.advbox_movements_sync_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
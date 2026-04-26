CREATE INDEX IF NOT EXISTS idx_advbox_lawsuits_number_trgm ON public.advbox_lawsuits USING gin (number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_lawsuit_number_trgm ON public.advbox_movements USING gin (lawsuit_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advbox_movements_type ON public.advbox_movements (type);
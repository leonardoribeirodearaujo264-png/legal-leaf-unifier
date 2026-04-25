-- ============================================================
-- 1. Novos campos em fin_lancamentos
-- ============================================================
ALTER TABLE public.fin_lancamentos
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advbox_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_needs_review
  ON public.fin_lancamentos(needs_review) WHERE needs_review = true;

CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_advbox_id
  ON public.fin_lancamentos(advbox_id) WHERE advbox_id IS NOT NULL;

-- ============================================================
-- 2. fin_settings (singleton) com flag de writeback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fin_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  writeback_enabled BOOLEAN NOT NULL DEFAULT false,
  writeback_test_mode BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

INSERT INTO public.fin_settings (id, writeback_enabled, writeback_test_mode)
VALUES ('singleton', false, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_settings select admin/socio" ON public.fin_settings;
CREATE POLICY "fin_settings select admin/socio"
  ON public.fin_settings FOR SELECT
  TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "fin_settings update admin/socio" ON public.fin_settings;
CREATE POLICY "fin_settings update admin/socio"
  ON public.fin_settings FOR UPDATE
  TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. fin_advbox_writeback_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fin_advbox_writeback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  advbox_id BIGINT,
  status TEXT NOT NULL CHECK (status IN ('success','error','skipped','disabled')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  http_status INTEGER,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_writeback_logs_lancamento
  ON public.fin_advbox_writeback_logs(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_writeback_logs_status_created
  ON public.fin_advbox_writeback_logs(status, created_at DESC);

ALTER TABLE public.fin_advbox_writeback_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "writeback_logs select admin/socio" ON public.fin_advbox_writeback_logs;
CREATE POLICY "writeback_logs select admin/socio"
  ON public.fin_advbox_writeback_logs FOR SELECT
  TO authenticated
  USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- inserts feitos via service role (edge function); sem policy de insert pra usuários

-- ============================================================
-- 4. Função fin_calc_saldo_atual — fonte da verdade
-- ============================================================
CREATE OR REPLACE FUNCTION public.fin_calc_saldo_atual(
  p_conta_id UUID,
  p_data_ref TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial NUMERIC;
  v_snapshot_date TIMESTAMPTZ;
  v_movimentos NUMERIC;
BEGIN
  SELECT
    COALESCE(saldo_inicial, 0),
    COALESCE(saldo_inicial_data, created_at, 'epoch'::timestamptz)
  INTO v_saldo_inicial, v_snapshot_date
  FROM public.fin_contas
  WHERE id = p_conta_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Soma só lançamentos pagos COM data_pagamento posterior ao snapshot
  -- e até a data de referência (now() por padrão)
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'receita' AND conta_origem_id = p_conta_id THEN valor
      WHEN tipo = 'despesa' AND conta_origem_id = p_conta_id THEN -valor
      WHEN tipo = 'transferencia' AND conta_origem_id = p_conta_id THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN valor
      ELSE 0
    END
  ), 0)
  INTO v_movimentos
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL
    AND status = 'pago'
    AND data_pagamento IS NOT NULL
    AND data_pagamento::timestamptz > v_snapshot_date
    AND data_pagamento::timestamptz <= p_data_ref
    AND (conta_origem_id = p_conta_id OR conta_destino_id = p_conta_id);

  RETURN v_saldo_inicial + v_movimentos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_calc_saldo_atual(UUID, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- 5. Trigger fin_update_saldo — reescrito respeitando snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.fin_update_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta UUID;
  v_contas UUID[];
BEGIN
  -- Coleta contas afetadas (origem + destino, antes e depois)
  v_contas := ARRAY(
    SELECT DISTINCT c FROM unnest(ARRAY[
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.conta_origem_id END,
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.conta_destino_id END,
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.conta_origem_id END,
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.conta_destino_id END
    ]) c WHERE c IS NOT NULL
  );

  FOREACH v_conta IN ARRAY v_contas LOOP
    UPDATE public.fin_contas
    SET saldo_atual = public.fin_calc_saldo_atual(v_conta, now()),
        updated_at = now()
    WHERE id = v_conta;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Garante que o trigger cobre INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS trg_fin_update_saldo ON public.fin_lancamentos;
CREATE TRIGGER trg_fin_update_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fin_update_saldo();

-- ============================================================
-- 6. Helper: recalcular saldo de todas as contas
-- ============================================================
CREATE OR REPLACE FUNCTION public.fin_recalc_all_saldos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.fin_contas c
  SET saldo_atual = public.fin_calc_saldo_atual(c.id, now()),
      updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_recalc_all_saldos() TO authenticated;
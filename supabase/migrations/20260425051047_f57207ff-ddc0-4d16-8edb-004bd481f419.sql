-- Allow socio/admin to delete cache (force refresh)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'fin_dashboard_cache' 
    AND policyname = 'fin_dashboard_cache delete admin/socio'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "fin_dashboard_cache delete admin/socio"
      ON public.fin_dashboard_cache
      FOR DELETE
      TO authenticated
      USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
    $POL$;
  END IF;
END $$;

-- Allow socio/admin to update cache (rare but needed for force-write)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'fin_dashboard_cache' 
    AND policyname = 'fin_dashboard_cache update admin/socio'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "fin_dashboard_cache update admin/socio"
      ON public.fin_dashboard_cache
      FOR UPDATE
      TO authenticated
      USING (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.is_socio_or_rafael(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
    $POL$;
  END IF;
END $$;

-- RPC: force recalc + clear cache (callable from frontend by admin/socio)
CREATE OR REPLACE FUNCTION public.fin_force_refresh_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_recalc_count int;
BEGIN
  v_user_id := auth.uid();
  IF NOT (public.is_socio_or_rafael(v_user_id) OR public.has_role(v_user_id, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: somente sócios ou administradores podem forçar refresh do dashboard';
  END IF;

  -- Recalcular saldos
  v_recalc_count := public.fin_recalc_all_saldos();

  -- Limpar cache stale
  DELETE FROM public.fin_dashboard_cache WHERE id = 'singleton';

  RETURN jsonb_build_object(
    'success', true,
    'contas_recalculadas', v_recalc_count,
    'cache_cleared', true,
    'timestamp', now()
  );
END;
$$;

-- Diagnóstico: contar lançamentos órfãos vs vinculados
CREATE OR REPLACE FUNCTION public.fin_advbox_diagnostico()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_orphans int;
  v_linked int;
  v_total_contas int;
  v_contas_com_advbox int;
  v_contas_sem_advbox int;
  v_saldo_total numeric;
  v_lanc_mes int;
  v_receita_realizada numeric;
  v_receita_prevista numeric;
  v_despesa_realizada numeric;
  v_atrasados numeric;
  v_mes_inicio date := date_trunc('month', now())::date;
  v_mes_fim date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
BEGIN
  v_user_id := auth.uid();
  IF NOT (public.is_socio_or_rafael(v_user_id) OR public.has_role(v_user_id, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_orphans
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL
    AND advbox_id IS NOT NULL
    AND conta_origem_id IS NULL
    AND conta_destino_id IS NULL;

  SELECT COUNT(*) INTO v_linked
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL
    AND advbox_id IS NOT NULL
    AND (conta_origem_id IS NOT NULL OR conta_destino_id IS NOT NULL);

  SELECT COUNT(*), COUNT(*) FILTER (WHERE advbox_account_id IS NOT NULL),
         COUNT(*) FILTER (WHERE advbox_account_id IS NULL),
         COALESCE(SUM(saldo_atual), 0)
    INTO v_total_contas, v_contas_com_advbox, v_contas_sem_advbox, v_saldo_total
  FROM public.fin_contas
  WHERE ativa = true;

  SELECT COUNT(*) INTO v_lanc_mes
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL
    AND data_vencimento BETWEEN v_mes_inicio AND v_mes_fim;

  SELECT
    COALESCE(SUM(CASE WHEN tipo='receita' AND status='pago' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo='receita' AND status IN ('pendente','atrasado') THEN valor ELSE 0 END), 0),
    -COALESCE(SUM(CASE WHEN tipo='despesa' AND status='pago' THEN valor ELSE 0 END), 0),
    -COALESCE(SUM(CASE WHEN tipo='despesa' AND status='atrasado' THEN valor ELSE 0 END), 0)
  INTO v_receita_realizada, v_receita_prevista, v_despesa_realizada, v_atrasados
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL
    AND data_vencimento BETWEEN v_mes_inicio AND v_mes_fim;

  RETURN jsonb_build_object(
    'orphans_count', v_orphans,
    'linked_count', v_linked,
    'total_contas_ativas', v_total_contas,
    'contas_com_advbox', v_contas_com_advbox,
    'contas_sem_advbox', v_contas_sem_advbox,
    'saldo_total_intranet', v_saldo_total,
    'lancamentos_mes', v_lanc_mes,
    'receita_realizada', v_receita_realizada,
    'receita_prevista', v_receita_prevista,
    'despesa_realizada', v_despesa_realizada,
    'atrasados', v_atrasados,
    'mes_inicio', v_mes_inicio,
    'mes_fim', v_mes_fim
  );
END;
$$;
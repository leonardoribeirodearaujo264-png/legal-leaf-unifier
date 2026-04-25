CREATE OR REPLACE FUNCTION public.fin_advbox_excluded_by_filter(p_data_inicio date DEFAULT (date_trunc('month', now()))::date, p_data_fim date DEFAULT ((date_trunc('month', now()) + interval '1 month - 1 day'))::date)
RETURNS TABLE (
  id uuid,
  data_vencimento date,
  tipo text,
  descricao text,
  valor numeric,
  status text,
  reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT (public.is_socio_or_rafael(v_user_id) OR public.has_role(v_user_id, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.data_vencimento,
    l.tipo,
    l.descricao,
    l.valor,
    l.status,
    CASE
      WHEN UPPER(l.descricao) LIKE '%REPASSE%' THEN 'REPASSE'
      WHEN UPPER(l.descricao) LIKE '%DISTRIBUI%LUCRO%' THEN 'DISTRIBUIÇÃO DE LUCRO'
      WHEN l.descricao ~* 'HONOR[AÁ]RIOS?\s+(S[OÓ]CIO|S[OÓ]CIA|S[OÓ]CIOS)' THEN 'HONORÁRIOS SÓCIO'
      ELSE 'OUTRO'
    END AS reason
  FROM public.fin_lancamentos l
  WHERE l.deleted_at IS NULL
    AND l.data_vencimento BETWEEN p_data_inicio AND p_data_fim
    AND (
      UPPER(l.descricao) LIKE '%REPASSE%'
      OR UPPER(l.descricao) LIKE '%DISTRIBUI%LUCRO%'
      OR l.descricao ~* 'HONOR[AÁ]RIOS?\s+(S[OÓ]CIO|S[OÓ]CIA|S[OÓ]CIOS)'
    )
  ORDER BY l.data_vencimento DESC, l.valor DESC
  LIMIT 200;
END;
$$;
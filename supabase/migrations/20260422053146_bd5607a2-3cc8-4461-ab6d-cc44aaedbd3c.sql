-- Fecha SELECT permissivo em fin_metas, fin_centros_custo e fin_anexos.
DROP POLICY IF EXISTS "Authenticated users can read metas" ON public.fin_metas;
DROP POLICY IF EXISTS "Usuários autenticados podem ver metas" ON public.fin_metas;

CREATE POLICY "Approved users can read metas"
  ON public.fin_metas FOR SELECT
  USING (is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read centros_custo" ON public.fin_centros_custo;

CREATE POLICY "Approved users can read centros_custo"
  ON public.fin_centros_custo FOR SELECT
  USING (is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read anexos" ON public.fin_anexos;

CREATE POLICY "Approved users can read anexos"
  ON public.fin_anexos FOR SELECT
  USING (is_approved(auth.uid()));
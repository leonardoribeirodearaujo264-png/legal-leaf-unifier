-- Fecha SELECT permissivo em fin_metas, fin_centros_custo e fin_anexos.
--
-- Contexto: a migration 20260219 endureceu INSERT/UPDATE/DELETE dessas
-- tabelas trocando `USING (true)` por `is_approved(auth.uid())`, mas as
-- policies de SELECT continuaram como `USING (true)` — qualquer usuário
-- autenticado (inclusive pendente de aprovação ou suspenso) conseguia
-- ler metas financeiras, centros de custo e anexos de lançamentos.
--
-- Este patch dropa as policies de leitura antigas e recria exigindo
-- aprovação via is_approved(auth.uid()), alinhando com as demais ações.

-- ============================================================
-- fin_metas
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read metas" ON public.fin_metas;
DROP POLICY IF EXISTS "Usuários autenticados podem ver metas" ON public.fin_metas;

CREATE POLICY "Approved users can read metas"
  ON public.fin_metas FOR SELECT
  USING (is_approved(auth.uid()));

-- ============================================================
-- fin_centros_custo
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read centros_custo" ON public.fin_centros_custo;

CREATE POLICY "Approved users can read centros_custo"
  ON public.fin_centros_custo FOR SELECT
  USING (is_approved(auth.uid()));

-- ============================================================
-- fin_anexos
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read anexos" ON public.fin_anexos;

CREATE POLICY "Approved users can read anexos"
  ON public.fin_anexos FOR SELECT
  USING (is_approved(auth.uid()));

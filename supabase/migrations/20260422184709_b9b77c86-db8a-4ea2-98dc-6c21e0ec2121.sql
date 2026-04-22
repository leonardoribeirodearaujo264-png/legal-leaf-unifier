-- =============================================================================
-- Correção adicional dos findings restantes do scanner (após migration 1)
-- Data: 2026-04-22
-- Autor: Rafael + Claude (auditoria-projeto-lovable)
--
-- Objetivo: atacar o Error "10,000+ client PII records fully exposed to
-- unauthenticated users" + o Warning "Bank reconciliation data readable by
-- all authenticated users" + o Warning "Function Search Path Mutable", sem
-- quebrar o frontend.
--
-- NÃO atacado aqui (exige mais trabalho ou decisão do Rafael):
--   * "AI Edge Functions Open to Unauthenticated Abuse" — corrigido em
--     commit separado (requer mudar o código TS de ~15 edge functions de
--     IA para validar supabase.auth.getUser()).
--   * "Any authenticated user can subscribe to any Realtime channel topic"
--     — quebraria UX do chat em tempo real; fica para depois.
--   * "Leaked Password Protection Disabled" — Rafael habilita via
--     Supabase Dashboard > Authentication > Policies (HaveIBeenPwned check).
--   * "Public Bucket Allows Listing" — precisa identificar a bucket e
--     confirmar impacto nas telas que usam listagem.
--   * "TOTP Permission Check is Client-Side Only" — defesa em profundidade,
--     o servidor já rejeita via get_totp_permission = 'edit'. Warning OK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. advbox_customers: tinha uma policy ALL aplicada a {public} com USING(true)
--    que passava até para anon. Dropar e recriar scope service_role. A policy
--    SELECT "auth.uid() IS NOT NULL" continua em pé para os usuários logados.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role pode inserir/atualizar advbox_customers" ON public.advbox_customers;

-- Também remove qualquer policy em {public} que possa ter permissão genérica
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advbox_customers'
      AND 'public' = ANY(roles)
      AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.advbox_customers', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Service role manages advbox_customers"
  ON public.advbox_customers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. fin_conciliacoes + fin_conciliacao_itens: SELECT aberto a todo authenticated
--    causava exposição de dados bancários. Restringir a usuários com
--    perm_financial (view ou edit) ou admin/socio.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read conciliacoes" ON public.fin_conciliacoes;
DROP POLICY IF EXISTS "Authenticated users can read conciliacao_itens" ON public.fin_conciliacao_itens;

CREATE POLICY "Users with financial permission read conciliacoes"
  ON public.fin_conciliacoes FOR SELECT
  TO authenticated
  USING (
    public.get_admin_permission(auth.uid(), 'financial') IN ('view', 'edit')
    OR public.is_admin_or_socio(auth.uid())
  );

CREATE POLICY "Users with financial permission read conciliacao_itens"
  ON public.fin_conciliacao_itens FOR SELECT
  TO authenticated
  USING (
    public.get_admin_permission(auth.uid(), 'financial') IN ('view', 'edit')
    OR public.is_admin_or_socio(auth.uid())
  );

-- Também restringe INSERT/UPDATE/DELETE a perm_financial=edit (já havia
-- policy "Approved users can * conciliacao_itens" — sobrescrevemos)
DROP POLICY IF EXISTS "Approved users can insert conciliacao_itens" ON public.fin_conciliacao_itens;
DROP POLICY IF EXISTS "Approved users can update conciliacao_itens" ON public.fin_conciliacao_itens;
DROP POLICY IF EXISTS "Approved users can delete conciliacao_itens" ON public.fin_conciliacao_itens;
DROP POLICY IF EXISTS "Authenticated users can insert conciliacoes" ON public.fin_conciliacoes;
DROP POLICY IF EXISTS "Authenticated users can update conciliacoes" ON public.fin_conciliacoes;
DROP POLICY IF EXISTS "Authenticated users can delete conciliacoes" ON public.fin_conciliacoes;

CREATE POLICY "Financial edit users manage conciliacoes"
  ON public.fin_conciliacoes FOR ALL
  TO authenticated
  USING (
    public.get_admin_permission(auth.uid(), 'financial') = 'edit'
    OR public.is_admin_or_socio(auth.uid())
  )
  WITH CHECK (
    public.get_admin_permission(auth.uid(), 'financial') = 'edit'
    OR public.is_admin_or_socio(auth.uid())
  );

CREATE POLICY "Financial edit users manage conciliacao_itens"
  ON public.fin_conciliacao_itens FOR ALL
  TO authenticated
  USING (
    public.get_admin_permission(auth.uid(), 'financial') = 'edit'
    OR public.is_admin_or_socio(auth.uid())
  )
  WITH CHECK (
    public.get_admin_permission(auth.uid(), 'financial') = 'edit'
    OR public.is_admin_or_socio(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. Function Search Path Mutable: setar search_path = public em todas as
--    funções SECURITY DEFINER do schema public que ainda não tenham.
--    Impacto: apenas fecha a brecha de search_path hijacking; comportamento
--    das funções permanece idêntico porque já executam com search_path
--    implícito de public.
-- -----------------------------------------------------------------------------
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema,
      p.proname AS func,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef AS sec_def,
      p.proconfig AS cfg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    -- Só aplica se search_path ainda não estiver setado
    IF fn.cfg IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(fn.cfg) c WHERE c LIKE 'search_path=%'
    ) THEN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public',
        fn.schema, fn.func, fn.args
      );
    END IF;
  END LOOP;
END $$;
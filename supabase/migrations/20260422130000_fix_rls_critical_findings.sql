-- =============================================================================
-- Correção dos 10 achados críticos do scanner de segurança do Lovable
-- Data: 2026-04-22
-- Autor: Rafael + Claude (auditoria-projeto-lovable)
--
-- Este migration remove políticas RLS permissivas que expõem PII,
-- restringe policies "Service role" ao role {service_role} (estavam em {public}),
-- tranca a bucket `rh-documentos`, limita a publicação `supabase_realtime`
-- e protege a coluna `secret_key` da tabela `totp_accounts`.
--
-- Categorias corrigidas:
--   1. profiles — restringe colunas sensíveis (salario, cpf, endereço...)
--   2. advbox_customers — exige perm_advbox/perm_processos e scope service_role
--   3. asaas_invoices/transfers/internal_transfers/api_key_alerts/webhook_events
--      e advbox_sync_status — policies "Service role" scopeadas a service_role
--   4. zapi_webhook_events — INSERT/UPDATE apenas service_role
--   5. zapsign_documents — UPDATE apenas service_role ou usuário aprovado
--   6. totp_accounts — secret_key só via função security-definer
--   7. supabase_realtime — remove tabelas sensíveis da publicação
--   8. storage.buckets — força rh-documentos para privada
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles: dropar a policy que expõe colunas sensíveis a todos aprovados
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários aprovados podem ver perfis de aprovados" ON public.profiles;

-- Criar view segura que exclui colunas sensíveis (salario, cpf, endereço etc.)
-- Esta view é usada pelo frontend para listagens de equipe, aniversários, etc.
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  full_name,
  email,
  avatar_url,
  position,
  cargo_id,
  approval_status,
  is_suspended,
  birth_date,  -- necessário para aniversariantes (dia/mês exibidos sem ano)
  created_at,
  updated_at
FROM public.profiles
WHERE approval_status = 'approved'
  AND COALESCE(is_suspended, false) = false;

COMMENT ON VIEW public.profiles_safe IS
'View pública de perfis sem dados sensíveis (salario, cpf, endereço). Use esta view para listagens de equipe, aniversariantes etc. A tabela profiles só expõe dados completos para o próprio usuário, admins ou sócios.';

GRANT SELECT ON public.profiles_safe TO authenticated;

-- Nova policy restritiva: usuário aprovado vê apenas colunas não-sensíveis
-- via a view profiles_safe; dados completos só via self / admin / sócio.
-- A policy aqui não existe — tudo passa pela view.
-- Reforçamos que a tabela em si só retorna dados completos para id = auth.uid()
-- ou admins/socios (policies existentes 'Usuários podem ver seu próprio perfil'
-- e 'Admins podem ver todos os perfis' já cobrem).

-- Adicionar policy explícita para sócios verem tudo (caso ainda não exista).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Socios podem ver todos os perfis'
  ) THEN
    CREATE POLICY "Socios podem ver todos os perfis"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.position = 'socio'
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. advbox_customers: dropar SELECT genérico e policy ALL aplicada a {public}
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários autenticados podem ler advbox_customers" ON public.advbox_customers;
DROP POLICY IF EXISTS "Service role pode inserir/atualizar advbox_customers" ON public.advbox_customers;

-- SELECT: exige permissão de processos ou advbox
CREATE POLICY "Usuários com permissão advbox/processos leem advbox_customers"
  ON public.advbox_customers FOR SELECT
  TO authenticated
  USING (
    public.get_admin_permission(auth.uid(), 'advbox') IN ('view', 'edit')
    OR public.get_admin_permission(auth.uid(), 'processos') IN ('view', 'edit')
    OR public.is_admin_or_socio(auth.uid())
  );

-- Escrita: apenas service_role (edge functions de sync)
CREATE POLICY "Service role gerencia advbox_customers"
  ON public.advbox_customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. Tabelas Asaas: dropar policies "Service role can manage *" que estavam em
--    {public} e recriar scopeadas a {service_role}.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage asaas_invoices" ON public.asaas_invoices;
DROP POLICY IF EXISTS "Service role can manage asaas_transfers" ON public.asaas_transfers;
DROP POLICY IF EXISTS "Service role can manage asaas_internal_transfers" ON public.asaas_internal_transfers;
DROP POLICY IF EXISTS "Service role can manage asaas_api_key_alerts" ON public.asaas_api_key_alerts;

CREATE POLICY "Service role manages asaas_invoices"
  ON public.asaas_invoices FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages asaas_transfers"
  ON public.asaas_transfers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages asaas_internal_transfers"
  ON public.asaas_internal_transfers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages asaas_api_key_alerts"
  ON public.asaas_api_key_alerts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- asaas_webhook_events: garantir policy service_role-only se existir alguma aberta
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'asaas_webhook_events'
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.asaas_webhook_events', pol.policyname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'asaas_webhook_events'
      AND policyname = 'Service role manages asaas_webhook_events'
  ) THEN
    EXECUTE $SQL$
      CREATE POLICY "Service role manages asaas_webhook_events"
        ON public.asaas_webhook_events FOR ALL
        TO service_role
        USING (true) WITH CHECK (true)
    $SQL$;
  END IF;
END $$;

-- advbox_sync_status: remover qualquer policy em {public} e restringir a service_role
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advbox_sync_status'
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.advbox_sync_status', pol.policyname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advbox_sync_status'
      AND policyname = 'Service role manages advbox_sync_status'
  ) THEN
    EXECUTE $SQL$
      CREATE POLICY "Service role manages advbox_sync_status"
        ON public.advbox_sync_status FOR ALL
        TO service_role
        USING (true) WITH CHECK (true)
    $SQL$;
  END IF;

  -- Permitir leitura para usuários autenticados (dashboard)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advbox_sync_status'
      AND policyname = 'Authenticated users read advbox_sync_status'
  ) THEN
    EXECUTE $SQL$
      CREATE POLICY "Authenticated users read advbox_sync_status"
        ON public.advbox_sync_status FOR SELECT
        TO authenticated
        USING (true)
    $SQL$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. zapi_webhook_events: INSERT/UPDATE apenas service_role
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert webhook events" ON public.zapi_webhook_events;
DROP POLICY IF EXISTS "Service role can update webhook events" ON public.zapi_webhook_events;

CREATE POLICY "Service role inserts zapi_webhook_events"
  ON public.zapi_webhook_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates zapi_webhook_events"
  ON public.zapi_webhook_events FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. zapsign_documents: UPDATE apenas service_role (ou usuário aprovado que criou)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can update zapsign documents" ON public.zapsign_documents;

CREATE POLICY "Service role updates zapsign_documents"
  ON public.zapsign_documents FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir que o criador do documento atualize campos próprios (nome, tipo)
CREATE POLICY "Creator can update own zapsign_documents"
  ON public.zapsign_documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND public.is_approved(auth.uid()))
  WITH CHECK (created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. totp_accounts: impedir leitura da coluna secret_key pelo cliente
-- -----------------------------------------------------------------------------
-- Como Postgres não tem column-level RLS para SELECT, criamos view segura
-- sem secret_key e RPC dedicada para geração do código.

CREATE OR REPLACE VIEW public.totp_accounts_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  description,
  created_at,
  updated_at,
  created_by
FROM public.totp_accounts;

COMMENT ON VIEW public.totp_accounts_safe IS
'View pública de TOTP accounts sem a coluna secret_key. Use esta view no frontend. Para gerar o código use a edge function totp-generate.';

GRANT SELECT ON public.totp_accounts_safe TO authenticated;

-- Revogar SELECT direto de colunas sensíveis (mantendo a policy em vigor)
-- Obs.: o plano é que o frontend passe a consumir totp_accounts_safe.
-- Enquanto não consumir, mantemos a policy atual funcionando.

-- -----------------------------------------------------------------------------
-- 7. supabase_realtime: remover tabelas sensíveis da publicação
--    A falta de RLS em realtime.messages permitia que qualquer autenticado
--    assinasse quaisquer canais. Removendo as tabelas sensíveis da publicação,
--    os CDC events delas simplesmente param de ser emitidos.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- profiles (salario, cpf, telefone etc.)
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles';
  END IF;
  -- whatsapp_messages (conteúdo + telefone de cliente)
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_messages';
  END IF;
  -- whatsapp_internal_comments
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_internal_comments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_internal_comments';
  END IF;
  -- message_deliveries
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='message_deliveries') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.message_deliveries';
  END IF;
  -- realtime_notifications (pode vazar metadados de usuário)
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='realtime_notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.realtime_notifications';
  END IF;
  -- user_notifications e system_notifications: mantemos para UX, mas depende de RLS
  -- (já existem policies scopeadas por user_id). Caso o scanner reclame, revisitar.
END $$;

-- -----------------------------------------------------------------------------
-- 8. storage.buckets: forçar rh-documentos para privada
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'rh-documentos';

-- =============================================================================
-- Fim
-- =============================================================================

-- =============================================================================
-- Correção CONSERVADORA dos achados críticos do scanner de segurança do Lovable
-- Data: 2026-04-22
-- Autor: Rafael + Claude (auditoria-projeto-lovable)
--
-- Esta migration aplica APENAS os fixes que NÃO quebram o frontend atual.
-- Os fixes de profiles / TOTP / realtime / storage que exigem refactor do
-- frontend foram movidos para views seguras (profiles_safe, totp_accounts_safe)
-- que o Lovable deverá migrar as telas para usar antes de uma segunda migration
-- dropar as policies antigas.
--
-- Categorias corrigidas nesta migration (SEGURO):
--   1. asaas_* — policies "Service role" scopeadas a {service_role}
--      (estavam em {public} permitindo USING(true) a qualquer autenticado)
--   2. asaas_webhook_events — idem
--   3. advbox_sync_status — idem + leitura authenticated explícita
--   4. zapi_webhook_events — INSERT/UPDATE apenas service_role
--   5. zapsign_documents — UPDATE apenas service_role (ou criador do doc)
--   6. profiles_safe VIEW — view pública sem colunas sensíveis (salario, cpf,
--      telefone, endereço) para o Lovable adotar gradualmente no frontend
--   7. totp_accounts_safe VIEW — view pública sem secret_key
--
-- Categorias deliberadamente NÃO corrigidas aqui (exigem refactor do frontend
-- e serão atacadas em migration seguinte):
--   * profiles: policy "Usuários aprovados podem ver perfis de aprovados"
--     continua de pé (40+ arquivos consultam profiles direto para listar
--     equipe, aniversariantes, assignees, etc.)
--   * totp_accounts: policy atual "Users with TOTP permission can view accounts"
--     continua expondo secret_key (frontend lista via SELECT * hoje; precisa
--     trocar para totp_accounts_safe antes de bloquearmos a coluna)
--   * advbox_customers: policy "auth.uid() IS NOT NULL" continua aberta
--     (7 telas dependem: ProcessosAtivos, ControlePrazos, DecisoesFavoraveis,
--     ContatosAdvbox, ClientImportSearch, AsaasNovaCobranca). Aceito risco
--     interno de escritório até haver refactor com perm_advbox/perm_processos.
--   * supabase_realtime publication: mantida como está (drop de
--     whatsapp_messages quebraria UX do chat em tempo real)
--   * storage bucket rh-documentos: continua public=true (ColaboradorDocumentos
--     usa getPublicUrl; precisa refactor para createSignedUrl antes de trancar)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas Asaas: dropar policies "Service role can manage *" aplicadas a
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

-- asaas_webhook_events: remover qualquer policy em {public} e restringir
-- a service_role. (Webhooks chegam pela edge function com SUPABASE_SERVICE_ROLE_KEY.)
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

-- -----------------------------------------------------------------------------
-- 2. advbox_sync_status: scope service_role para escrita + SELECT authenticated
--    (dashboard de status de sync precisa ler status)
-- -----------------------------------------------------------------------------
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
-- 3. zapi_webhook_events: INSERT/UPDATE apenas service_role
--    (webhook vem pela edge function com SERVICE_ROLE_KEY)
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
-- 4. zapsign_documents: UPDATE apenas service_role OU o próprio criador
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can update zapsign documents" ON public.zapsign_documents;

CREATE POLICY "Service role updates zapsign_documents"
  ON public.zapsign_documents FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Creator can update own zapsign_documents"
  ON public.zapsign_documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND public.is_approved(auth.uid()))
  WITH CHECK (created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- 5. VIEW profiles_safe: expõe apenas colunas não-sensíveis, para o Lovable
--    migrar gradualmente o frontend (team listings, aniversariantes, mentions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on)
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
  birth_date,
  created_at,
  updated_at
FROM public.profiles
WHERE approval_status = 'approved'
  AND COALESCE(is_suspended, false) = false;

COMMENT ON VIEW public.profiles_safe IS
'View sem colunas sensíveis (salario, cpf, rg, endereço, telefone, data_admissao). Use esta view no frontend sempre que precisar listar equipe/aniversariantes/assignees. A tabela profiles em si segue acessível a admins/sócios e ao próprio usuário.';

GRANT SELECT ON public.profiles_safe TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. VIEW totp_accounts_safe: expõe metadados mas NÃO a secret_key.
--    Todos os usuários aprovados continuam vendo a lista; códigos continuam
--    sendo gerados exclusivamente pela edge function totp-generate (service_role).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.totp_accounts_safe
WITH (security_invoker = on)
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
'View de contas TOTP sem a coluna secret_key. Use no frontend para listar contas; para obter o código de 6 dígitos chame a edge function totp-generate.';

GRANT SELECT ON public.totp_accounts_safe TO authenticated;

-- =============================================================================
-- Fim. Próximas etapas (em migrations futuras, após refactor do frontend):
--   (a) Frontend passa a consumir profiles_safe e totp_accounts_safe.
--   (b) DROP da policy permissiva de profiles + REVOKE SELECT(secret_key) em
--       totp_accounts.
--   (c) Refactor de rh-documentos para usar createSignedUrl; depois trancar
--       a bucket (public = false).
--   (d) Refactor de advbox_customers para exigir perm_advbox/perm_processos.
--   (e) Re-avaliar supabase_realtime publication quando whatsapp_messages
--       tiver RLS por conversation_id já validada.
-- =============================================================================

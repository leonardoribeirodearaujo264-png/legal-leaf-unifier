-- =============================================================================
-- Correção CONSERVADORA dos achados críticos do scanner de segurança do Lovable
-- =============================================================================

-- 1. Tabelas Asaas
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

-- 2. advbox_sync_status
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

-- 3. zapi_webhook_events
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

-- 4. zapsign_documents
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

-- 5. VIEW profiles_safe
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

-- 6. VIEW totp_accounts_safe
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
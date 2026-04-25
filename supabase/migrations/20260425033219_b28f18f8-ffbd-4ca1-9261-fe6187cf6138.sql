ALTER TABLE public.fin_lancamentos
  ADD COLUMN IF NOT EXISTS advbox_account_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_advbox_account_id
  ON public.fin_lancamentos (advbox_account_id)
  WHERE advbox_account_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fin_normalize_bank_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  IF p_name IS NULL THEN RETURN NULL; END IF;
  v_norm := UPPER(TRIM(p_name));
  v_norm := TRANSLATE(v_norm,
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'AAAAAEEEEIIIIOOOOOUUUUC');
  v_norm := REGEXP_REPLACE(v_norm, '\s*\(CAIXINHA\s+PADRAO\)\s*$', '', 'gi');
  v_norm := REGEXP_REPLACE(v_norm, '\s*\(CAIXINHA\)\s*$', '', 'gi');
  v_norm := REGEXP_REPLACE(v_norm, '^Z(?=[A-Z])', '', 'g');
  RETURN TRIM(v_norm);
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados_anteriores JSONB;
  v_dados_novos JSONB;
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
  v_ignored_keys TEXT[] := ARRAY['updated_at', 'created_at'];
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_user_id := COALESCE(NEW.created_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN
      v_user_id := COALESCE(NEW.updated_by, auth.uid());
    EXCEPTION WHEN undefined_column THEN
      v_user_id := COALESCE(NEW.created_by, auth.uid());
    END;
  ELSE
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE
      IF TG_OP = 'UPDATE' THEN NEW.updated_at = NOW(); END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'criar', to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_dados_anteriores := '{}'::jsonb;
    v_dados_novos := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new_json)
    LOOP
      IF NOT (v_key = ANY(v_ignored_keys)) AND (v_old_json->v_key IS DISTINCT FROM v_new_json->v_key) THEN
        v_dados_anteriores := v_dados_anteriores || jsonb_build_object(v_key, v_old_json->v_key);
        v_dados_novos := v_dados_novos || jsonb_build_object(v_key, v_new_json->v_key);
      END IF;
    END LOOP;
    IF v_dados_novos = '{}'::jsonb THEN
      NEW.updated_at = NOW();
      RETURN NEW;
    END IF;
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'editar', v_dados_anteriores, v_dados_novos, v_user_id);
    NEW.updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.fin_auditoria (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'deletar', to_jsonb(OLD), v_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
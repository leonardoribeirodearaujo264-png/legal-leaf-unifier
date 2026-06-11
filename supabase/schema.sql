-- =============================================================================
-- Tribuna IA — Schema completo
-- Execute inteiro no Supabase SQL Editor (uma única vez, idempotente).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- FUNÇÕES AUXILIARES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND approval_status = 'approved'
      AND is_active = true
      AND is_suspended = false
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approval_status, is_active, is_suspended)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    'approved', true, false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABELAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE,
  full_name     TEXT,
  avatar_url    TEXT,
  position      TEXT,
  approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_suspended  BOOLEAN NOT NULL DEFAULT false,
  suspended_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.usage_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module     TEXT,
  tool_name  TEXT,
  action     TEXT NOT NULL,
  input      JSONB,
  output     JSONB,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AI / Assistente ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nova conversa',
  model      TEXT NOT NULL DEFAULT 'gemini-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL DEFAULT '',
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  images          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_message_favorites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id      UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  model           TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- ── Agentes do Intranet ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intranet_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  objective       TEXT NOT NULL,
  instructions    TEXT NOT NULL,
  model           TEXT NOT NULL DEFAULT 'gemini-flash',
  icon_emoji      TEXT NOT NULL DEFAULT '🤖',
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  function_role   TEXT,
  card_color      TEXT NOT NULL DEFAULT 'purple',
  data_access     TEXT[] NOT NULL DEFAULT '{}'::text[],
  knowledge_base  TEXT,
  knowledge_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  file_name  TEXT NOT NULL,
  file_type  TEXT NOT NULL,
  file_url   TEXT NOT NULL,
  file_size  BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nova conversa',
  model      TEXT NOT NULL DEFAULT 'gemini-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.intranet_agent_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL DEFAULT '',
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  images          JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to_id     UUID REFERENCES public.intranet_agent_messages(id) ON DELETE SET NULL,
  is_edited       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_url  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_url)
);

-- ── Casos jurídicos ────────────────────────────────────────────────────────
-- status inclui 'imported' para casos vindos do DataJud

CREATE TABLE IF NOT EXISTS public.casos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  cliente           TEXT NOT NULL,
  numero_processo   TEXT,
  area_juridica     TEXT,
  status            TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'aguardando', 'arquivado', 'encerrado', 'imported')),
  observacoes       TEXT,
  -- Campos DataJud
  court             TEXT,
  court_name        TEXT,
  case_class        TEXT,
  subject           TEXT,
  jurisdiction_body TEXT,
  degree            TEXT,
  distribution_date DATE,
  claim_value       NUMERIC,
  current_phase     TEXT,
  last_movement     TEXT,
  import_source     TEXT DEFAULT 'manual',
  -- Campos IA
  summary           TEXT,
  ai_analysis       JSONB NOT NULL DEFAULT '{}'::jsonb,
  datajud_raw       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_parties (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT,
  document   TEXT,
  raw_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_lawyers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  oab        TEXT,
  party_name TEXT,
  raw_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ,
  title         TEXT NOT NULL,
  description   TEXT,
  movement_type TEXT,
  is_important  BOOLEAN NOT NULL DEFAULT false,
  raw_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_ai_outputs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name  TEXT NOT NULL,
  file_url   TEXT NOT NULL,
  file_type  TEXT,
  file_size  BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- COLUNAS ADICIONAIS (idempotente — para bancos já existentes)
-- =============================================================================

-- Casos: garante colunas DataJud/IA mesmo se a tabela já existia sem elas
ALTER TABLE public.casos
  ADD COLUMN IF NOT EXISTS court             TEXT,
  ADD COLUMN IF NOT EXISTS court_name        TEXT,
  ADD COLUMN IF NOT EXISTS case_class        TEXT,
  ADD COLUMN IF NOT EXISTS subject           TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction_body TEXT,
  ADD COLUMN IF NOT EXISTS degree            TEXT,
  ADD COLUMN IF NOT EXISTS distribution_date DATE,
  ADD COLUMN IF NOT EXISTS claim_value       NUMERIC,
  ADD COLUMN IF NOT EXISTS current_phase     TEXT,
  ADD COLUMN IF NOT EXISTS last_movement     TEXT,
  ADD COLUMN IF NOT EXISTS import_source     TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS summary           TEXT,
  ADD COLUMN IF NOT EXISTS ai_analysis       JSONB,
  ADD COLUMN IF NOT EXISTS datajud_raw       JSONB;

-- Corrige o CHECK constraint de status para incluir 'imported'
ALTER TABLE public.casos DROP CONSTRAINT IF EXISTS casos_status_check;
ALTER TABLE public.casos
  ADD CONSTRAINT casos_status_check
  CHECK (status IN ('ativo', 'aguardando', 'arquivado', 'encerrado', 'imported'));

-- Agentes: garante colunas de base de conhecimento
ALTER TABLE public.intranet_agents
  ADD COLUMN IF NOT EXISTS knowledge_base  TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_files JSONB NOT NULL DEFAULT '[]'::jsonb;

-- =============================================================================
-- VIEW
-- =============================================================================

CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, full_name, avatar_url, position
FROM public.profiles
WHERE approval_status = 'approved'
  AND is_active = true
  AND is_suspended = false;

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_approval        ON public.profiles (approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name       ON public.profiles (full_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id       ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user       ON public.usage_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user    ON public.ai_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv         ON public.ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_fav_user              ON public.ai_message_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_created_by        ON public.intranet_agents (created_by);
CREATE INDEX IF NOT EXISTS idx_agents_active            ON public.intranet_agents (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conv_user          ON public.intranet_agent_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_msg_conv           ON public.intranet_agent_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_fav_user           ON public.ai_agent_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_casos_user_status        ON public.casos (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_parties_case        ON public.case_parties (case_id);
CREATE INDEX IF NOT EXISTS idx_case_lawyers_case        ON public.case_lawyers (case_id);
CREATE INDEX IF NOT EXISTS idx_case_movements_case_date ON public.case_movements (case_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_case_ai_outputs_case     ON public.case_ai_outputs (case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_case          ON public.case_notes (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_docs_case           ON public.case_documents (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_settings_key         ON public.app_settings (setting_key);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_profiles_updated_at        ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_messages_updated_at ON public.ai_messages;
CREATE TRIGGER set_ai_messages_updated_at
  BEFORE UPDATE ON public.ai_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_prompt_templates_updated_at ON public.ai_prompt_templates;
CREATE TRIGGER set_ai_prompt_templates_updated_at
  BEFORE UPDATE ON public.ai_prompt_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_agents_updated_at ON public.intranet_agents;
CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON public.intranet_agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_agent_conv_updated_at ON public.intranet_agent_conversations;
CREATE TRIGGER set_agent_conv_updated_at
  BEFORE UPDATE ON public.intranet_agent_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_agent_msg_updated_at ON public.intranet_agent_messages;
CREATE TRIGGER set_agent_msg_updated_at
  BEFORE UPDATE ON public.intranet_agent_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_casos_updated_at ON public.casos;
CREATE TRIGGER set_casos_updated_at
  BEFORE UPDATE ON public.casos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_case_notes_updated_at ON public.case_notes;
CREATE TRIGGER set_case_notes_updated_at
  BEFORE UPDATE ON public.case_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_case_docs_updated_at ON public.case_documents;
CREATE TRIGGER set_case_docs_updated_at
  BEFORE UPDATE ON public.case_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS — habilitar
-- =============================================================================

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_favorites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_parties                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_lawyers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_movements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_ai_outputs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents              ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS — políticas
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR approval_status = 'approved' OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- usage_history
DROP POLICY IF EXISTS "usage_history_select" ON public.usage_history;
CREATE POLICY "usage_history_select" ON public.usage_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "usage_history_insert" ON public.usage_history;
CREATE POLICY "usage_history_insert" ON public.usage_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "usage_history_delete" ON public.usage_history;
CREATE POLICY "usage_history_delete" ON public.usage_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- app_settings
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_manage" ON public.app_settings;
CREATE POLICY "app_settings_manage" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ai_conversations
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ai_messages
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "ai_messages_update" ON public.ai_messages;
CREATE POLICY "ai_messages_update" ON public.ai_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ai_prompt_templates
DROP POLICY IF EXISTS "ai_prompt_templates_select" ON public.ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_select" ON public.ai_prompt_templates FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_prompt_templates_manage" ON public.ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_manage" ON public.ai_prompt_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ai_message_favorites
DROP POLICY IF EXISTS "ai_message_favorites_select" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_select" ON public.ai_message_favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_message_favorites_insert" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_insert" ON public.ai_message_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_message_favorites_delete" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_delete" ON public.ai_message_favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agents
DROP POLICY IF EXISTS "intranet_agents_select" ON public.intranet_agents;
CREATE POLICY "intranet_agents_select" ON public.intranet_agents FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_insert" ON public.intranet_agents;
CREATE POLICY "intranet_agents_insert" ON public.intranet_agents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_update" ON public.intranet_agents;
CREATE POLICY "intranet_agents_update" ON public.intranet_agents FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_delete" ON public.intranet_agents;
CREATE POLICY "intranet_agents_delete" ON public.intranet_agents FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agent_files
DROP POLICY IF EXISTS "intranet_agent_files_select" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_select" ON public.intranet_agent_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intranet_agents a
    WHERE a.id = intranet_agent_files.agent_id
      AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR a.is_active = true)));

DROP POLICY IF EXISTS "intranet_agent_files_insert" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_insert" ON public.intranet_agent_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.intranet_agents a
    WHERE a.id = intranet_agent_files.agent_id
      AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "intranet_agent_files_delete" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_delete" ON public.intranet_agent_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intranet_agents a
    WHERE a.id = intranet_agent_files.agent_id
      AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- intranet_agent_conversations
DROP POLICY IF EXISTS "intranet_agent_conversations_select" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_select" ON public.intranet_agent_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_insert" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_insert" ON public.intranet_agent_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_update" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_update" ON public.intranet_agent_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_delete" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_delete" ON public.intranet_agent_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agent_messages
DROP POLICY IF EXISTS "intranet_agent_messages_select" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_select" ON public.intranet_agent_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intranet_agent_conversations c
    WHERE c.id = intranet_agent_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "intranet_agent_messages_insert" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_insert" ON public.intranet_agent_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.intranet_agent_conversations c
    WHERE c.id = intranet_agent_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "intranet_agent_messages_update" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_update" ON public.intranet_agent_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intranet_agent_conversations c
    WHERE c.id = intranet_agent_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intranet_agent_conversations c
    WHERE c.id = intranet_agent_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "intranet_agent_messages_delete" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_delete" ON public.intranet_agent_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.intranet_agent_conversations c
    WHERE c.id = intranet_agent_messages.conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ai_agent_favorites
DROP POLICY IF EXISTS "ai_agent_favorites_select" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_select" ON public.ai_agent_favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_agent_favorites_insert" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_insert" ON public.ai_agent_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_agent_favorites_delete" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_delete" ON public.ai_agent_favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- casos
DROP POLICY IF EXISTS "casos_select" ON public.casos;
CREATE POLICY "casos_select" ON public.casos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_insert" ON public.casos;
CREATE POLICY "casos_insert" ON public.casos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_update" ON public.casos;
CREATE POLICY "casos_update" ON public.casos FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_delete" ON public.casos;
CREATE POLICY "casos_delete" ON public.casos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- case_parties / case_lawyers / case_movements / case_ai_outputs
DROP POLICY IF EXISTS "case_parties_all" ON public.case_parties;
CREATE POLICY "case_parties_all" ON public.case_parties FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_lawyers_all" ON public.case_lawyers;
CREATE POLICY "case_lawyers_all" ON public.case_lawyers FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_movements_all" ON public.case_movements;
CREATE POLICY "case_movements_all" ON public.case_movements FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "case_ai_outputs_all" ON public.case_ai_outputs;
CREATE POLICY "case_ai_outputs_all" ON public.case_ai_outputs FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- case_notes
DROP POLICY IF EXISTS "case_notes_select" ON public.case_notes;
CREATE POLICY "case_notes_select" ON public.case_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_notes.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_notes_insert" ON public.case_notes;
CREATE POLICY "case_notes_insert" ON public.case_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_notes.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_notes_update" ON public.case_notes;
CREATE POLICY "case_notes_update" ON public.case_notes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_notes.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_notes.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_notes_delete" ON public.case_notes;
CREATE POLICY "case_notes_delete" ON public.case_notes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_notes.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- case_documents
DROP POLICY IF EXISTS "case_documents_select" ON public.case_documents;
CREATE POLICY "case_documents_select" ON public.case_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_documents.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_documents_insert" ON public.case_documents;
CREATE POLICY "case_documents_insert" ON public.case_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_documents.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_documents_update" ON public.case_documents;
CREATE POLICY "case_documents_update" ON public.case_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_documents.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_documents.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "case_documents_delete" ON public.case_documents;
CREATE POLICY "case_documents_delete" ON public.case_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.casos c WHERE c.id = case_documents.case_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- =============================================================================
-- STORAGE — buckets e políticas
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars',         'avatars',         true),
  ('agent-files',     'agent-files',     true),
  ('agent-knowledge', 'agent-knowledge', false),
  ('case-documents',  'case-documents',  true)
ON CONFLICT (id) DO NOTHING;

-- Limpa políticas antigas para recriar de forma idempotente
DO $$
DECLARE pol TEXT;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname IN (
        'avatars_select','avatars_insert','avatars_update','avatars_delete',
        'agent_files_select','agent_files_insert','agent_files_update','agent_files_delete',
        'agent_knowledge_select','agent_knowledge_insert','agent_knowledge_delete',
        'case_documents_storage_select','case_documents_storage_insert',
        'case_documents_storage_update','case_documents_storage_delete'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
END $$;

CREATE POLICY "avatars_select"    ON storage.objects FOR SELECT    TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert"    ON storage.objects FOR INSERT    TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_update"    ON storage.objects FOR UPDATE    TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_delete"    ON storage.objects FOR DELETE    TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "agent_files_select" ON storage.objects FOR SELECT   TO authenticated USING (bucket_id = 'agent-files');
CREATE POLICY "agent_files_insert" ON storage.objects FOR INSERT   TO authenticated WITH CHECK (bucket_id = 'agent-files');
CREATE POLICY "agent_files_update" ON storage.objects FOR UPDATE   TO authenticated USING (bucket_id = 'agent-files') WITH CHECK (bucket_id = 'agent-files');
CREATE POLICY "agent_files_delete" ON storage.objects FOR DELETE   TO authenticated USING (bucket_id = 'agent-files');

CREATE POLICY "agent_knowledge_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'agent-knowledge');
CREATE POLICY "agent_knowledge_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-knowledge');
CREATE POLICY "agent_knowledge_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-knowledge');

CREATE POLICY "case_documents_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'case-documents');
CREATE POLICY "case_documents_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-documents');
CREATE POLICY "case_documents_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'case-documents') WITH CHECK (bucket_id = 'case-documents');
CREATE POLICY "case_documents_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-documents');

-- =============================================================================
-- GRANTS — permissões de tabela para os roles do Supabase
-- Necessário quando tabelas são criadas via SQL Editor (owner = postgres).
-- Sem isso, RLS é irrelevante: o role 'authenticated' não tem nem acesso à tabela.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.user_roles,
  public.usage_history,
  public.app_settings,
  public.ai_conversations,
  public.ai_messages,
  public.ai_prompt_templates,
  public.ai_message_favorites,
  public.intranet_agents,
  public.intranet_agent_files,
  public.intranet_agent_conversations,
  public.intranet_agent_messages,
  public.ai_agent_favorites,
  public.casos,
  public.case_parties,
  public.case_lawyers,
  public.case_movements,
  public.case_ai_outputs,
  public.case_notes,
  public.case_documents
TO authenticated;

-- Sequências (para gen_random_uuid e outros defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- Garante que futuras tabelas criadas também herdem os grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;

-- =============================================================================
-- DADOS INICIAIS
-- =============================================================================

INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('site_name',               'Tribuna IA',  'Nome do aplicativo'),
  ('registration_enabled',    'true',        'Controla se novos registros podem ser criados'),
  ('default_approval_status', 'approved',    'Status inicial dos novos perfis')
ON CONFLICT (setting_key) DO NOTHING;

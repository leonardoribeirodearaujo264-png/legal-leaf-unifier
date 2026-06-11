-- Tribuna IA / Legal Leaf
-- Base limpa para o app atual

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- Core tables
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  position TEXT,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT,
  tool_name TEXT,
  action TEXT NOT NULL,
  input JSONB,
  output JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  model TEXT NOT NULL DEFAULT 'openai/gpt-5',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_message_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

CREATE TABLE IF NOT EXISTS public.intranet_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  instructions TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5',
  icon_emoji TEXT NOT NULL DEFAULT '🤖',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  function_role TEXT,
  card_color TEXT NOT NULL DEFAULT 'purple',
  data_access TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.intranet_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  model TEXT NOT NULL DEFAULT 'openai/gpt-5',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.intranet_agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to_id UUID REFERENCES public.intranet_agent_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_url)
);

CREATE TABLE IF NOT EXISTS public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cliente TEXT NOT NULL,
  numero_processo TEXT,
  area_juridica TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'aguardando', 'arquivado', 'encerrado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Helper functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.approval_status = 'approved'
      AND p.is_active = true
      AND p.is_suspended = false
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approval_status, is_active, is_suspended)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    'approved',
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_agent_conversation_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conversation_owner UUID;
BEGIN
  SELECT user_id INTO conversation_owner
  FROM public.intranet_agent_conversations
  WHERE id = NEW.conversation_id;

  IF conversation_owner IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NEW.role = 'user' AND NEW.conversation_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Views
-- =====================================================

CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, full_name, avatar_url, position
FROM public.profiles
WHERE approval_status = 'approved'
  AND is_active = true
  AND is_suspended = false;

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles (approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles (full_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_created ON public.usage_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON public.ai_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON public.ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_message_favorites_user_created ON public.ai_message_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intranet_agents_created_by ON public.intranet_agents (created_by);
CREATE INDEX IF NOT EXISTS idx_intranet_agents_active ON public.intranet_agents (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intranet_agent_conversations_user_updated ON public.intranet_agent_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intranet_agent_messages_conversation_created ON public.intranet_agent_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_favorites_user_created ON public.ai_agent_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_casos_user_status_created ON public.casos (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_created ON public.case_notes (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_created ON public.case_documents (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings (setting_key);

-- =====================================================
-- Triggers
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_messages_updated_at ON public.ai_messages;
CREATE TRIGGER set_ai_messages_updated_at
  BEFORE UPDATE ON public.ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_ai_prompt_templates_updated_at ON public.ai_prompt_templates;
CREATE TRIGGER set_ai_prompt_templates_updated_at
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_intranet_agents_updated_at ON public.intranet_agents;
CREATE TRIGGER set_intranet_agents_updated_at
  BEFORE UPDATE ON public.intranet_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_intranet_agent_conversations_updated_at ON public.intranet_agent_conversations;
CREATE TRIGGER set_intranet_agent_conversations_updated_at
  BEFORE UPDATE ON public.intranet_agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_intranet_agent_messages_updated_at ON public.intranet_agent_messages;
CREATE TRIGGER set_intranet_agent_messages_updated_at
  BEFORE UPDATE ON public.intranet_agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_casos_updated_at ON public.casos;
CREATE TRIGGER set_casos_updated_at
  BEFORE UPDATE ON public.casos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_case_notes_updated_at ON public.case_notes;
CREATE TRIGGER set_case_notes_updated_at
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_case_documents_updated_at ON public.case_documents;
CREATE TRIGGER set_case_documents_updated_at
  BEFORE UPDATE ON public.case_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR approval_status = 'approved'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- usage_history
DROP POLICY IF EXISTS "usage_history_select" ON public.usage_history;
CREATE POLICY "usage_history_select"
  ON public.usage_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "usage_history_insert" ON public.usage_history;
CREATE POLICY "usage_history_insert"
  ON public.usage_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "usage_history_update" ON public.usage_history;
CREATE POLICY "usage_history_update"
  ON public.usage_history
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "usage_history_delete" ON public.usage_history;
CREATE POLICY "usage_history_delete"
  ON public.usage_history
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ai_conversations
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select"
  ON public.ai_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert"
  ON public.ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update"
  ON public.ai_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete"
  ON public.ai_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ai_messages
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select"
  ON public.ai_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert"
  ON public.ai_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "ai_messages_update" ON public.ai_messages;
CREATE POLICY "ai_messages_update"
  ON public.ai_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete"
  ON public.ai_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- ai_prompt_templates
DROP POLICY IF EXISTS "ai_prompt_templates_select" ON public.ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_select"
  ON public.ai_prompt_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_prompt_templates_manage" ON public.ai_prompt_templates;
CREATE POLICY "ai_prompt_templates_manage"
  ON public.ai_prompt_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ai_message_favorites
DROP POLICY IF EXISTS "ai_message_favorites_select" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_select"
  ON public.ai_message_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_message_favorites_insert" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_insert"
  ON public.ai_message_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_message_favorites_delete" ON public.ai_message_favorites;
CREATE POLICY "ai_message_favorites_delete"
  ON public.ai_message_favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agents
DROP POLICY IF EXISTS "intranet_agents_select" ON public.intranet_agents;
CREATE POLICY "intranet_agents_select"
  ON public.intranet_agents
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_insert" ON public.intranet_agents;
CREATE POLICY "intranet_agents_insert"
  ON public.intranet_agents
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_update" ON public.intranet_agents;
CREATE POLICY "intranet_agents_update"
  ON public.intranet_agents
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agents_delete" ON public.intranet_agents;
CREATE POLICY "intranet_agents_delete"
  ON public.intranet_agents
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agent_files
DROP POLICY IF EXISTS "intranet_agent_files_select" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_select"
  ON public.intranet_agent_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intranet_agents a
      WHERE a.id = intranet_agent_files.agent_id
        AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR a.is_active = true)
    )
  );

DROP POLICY IF EXISTS "intranet_agent_files_insert" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_insert"
  ON public.intranet_agent_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.intranet_agents a
      WHERE a.id = intranet_agent_files.agent_id
        AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "intranet_agent_files_delete" ON public.intranet_agent_files;
CREATE POLICY "intranet_agent_files_delete"
  ON public.intranet_agent_files
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intranet_agents a
      WHERE a.id = intranet_agent_files.agent_id
        AND (a.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- intranet_agent_conversations
DROP POLICY IF EXISTS "intranet_agent_conversations_select" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_select"
  ON public.intranet_agent_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_insert" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_insert"
  ON public.intranet_agent_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_update" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_update"
  ON public.intranet_agent_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "intranet_agent_conversations_delete" ON public.intranet_agent_conversations;
CREATE POLICY "intranet_agent_conversations_delete"
  ON public.intranet_agent_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- intranet_agent_messages
DROP POLICY IF EXISTS "intranet_agent_messages_select" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_select"
  ON public.intranet_agent_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intranet_agent_conversations c
      WHERE c.id = intranet_agent_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "intranet_agent_messages_insert" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_insert"
  ON public.intranet_agent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.intranet_agent_conversations c
      WHERE c.id = intranet_agent_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "intranet_agent_messages_update" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_update"
  ON public.intranet_agent_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intranet_agent_conversations c
      WHERE c.id = intranet_agent_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.intranet_agent_conversations c
      WHERE c.id = intranet_agent_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "intranet_agent_messages_delete" ON public.intranet_agent_messages;
CREATE POLICY "intranet_agent_messages_delete"
  ON public.intranet_agent_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intranet_agent_conversations c
      WHERE c.id = intranet_agent_messages.conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- ai_agent_favorites
DROP POLICY IF EXISTS "ai_agent_favorites_select" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_select"
  ON public.ai_agent_favorites
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_agent_favorites_insert" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_insert"
  ON public.ai_agent_favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ai_agent_favorites_delete" ON public.ai_agent_favorites;
CREATE POLICY "ai_agent_favorites_delete"
  ON public.ai_agent_favorites
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- casos
DROP POLICY IF EXISTS "casos_select" ON public.casos;
CREATE POLICY "casos_select"
  ON public.casos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_insert" ON public.casos;
CREATE POLICY "casos_insert"
  ON public.casos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_update" ON public.casos;
CREATE POLICY "casos_update"
  ON public.casos
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "casos_delete" ON public.casos;
CREATE POLICY "casos_delete"
  ON public.casos
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- case notes
DROP POLICY IF EXISTS "case_notes_select" ON public.case_notes;
CREATE POLICY "case_notes_select"
  ON public.case_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_notes.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_notes_insert" ON public.case_notes;
CREATE POLICY "case_notes_insert"
  ON public.case_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_notes.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_notes_update" ON public.case_notes;
CREATE POLICY "case_notes_update"
  ON public.case_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_notes.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_notes.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_notes_delete" ON public.case_notes;
CREATE POLICY "case_notes_delete"
  ON public.case_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_notes.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- case documents
DROP POLICY IF EXISTS "case_documents_select" ON public.case_documents;
CREATE POLICY "case_documents_select"
  ON public.case_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_documents.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_documents_insert" ON public.case_documents;
CREATE POLICY "case_documents_insert"
  ON public.case_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_documents.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_documents_update" ON public.case_documents;
CREATE POLICY "case_documents_update"
  ON public.case_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_documents.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_documents.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

DROP POLICY IF EXISTS "case_documents_delete" ON public.case_documents;
CREATE POLICY "case_documents_delete"
  ON public.case_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casos c
      WHERE c.id = case_documents.case_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- app_settings
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_settings_manage" ON public.app_settings;
CREATE POLICY "app_settings_manage"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- Storage
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('agent-files', 'agent-files', true),
  ('case-documents', 'case-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "agent_files_select" ON storage.objects;
DROP POLICY IF EXISTS "agent_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "agent_files_update" ON storage.objects;
DROP POLICY IF EXISTS "agent_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_delete" ON storage.objects;

CREATE POLICY "avatars_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "agent_files_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'agent-files');

CREATE POLICY "agent_files_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agent-files');

CREATE POLICY "agent_files_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agent-files')
  WITH CHECK (bucket_id = 'agent-files');

CREATE POLICY "agent_files_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'agent-files');

CREATE POLICY "case_documents_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-documents');

CREATE POLICY "case_documents_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "case_documents_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'case-documents')
  WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "case_documents_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'case-documents');

-- =====================================================
-- Default settings
-- =====================================================

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('site_name', 'Tribuna IA', 'Nome do aplicativo'),
  ('registration_enabled', 'true', 'Controla se novos registros podem ser criados'),
  ('default_approval_status', 'approved', 'Status inicial dos novos perfis')
ON CONFLICT (setting_key) DO NOTHING;

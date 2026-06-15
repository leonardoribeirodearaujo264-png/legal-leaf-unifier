-- ============================================================
-- Migração: Perfis de autenticação do Tribuna IA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Garantir colunas obrigatórias na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp  TEXT,
  ADD COLUMN IF NOT EXISTS role      TEXT DEFAULT 'user';

-- 2. Atualizar a função handle_new_user para incluir whatsapp
--    e não bloquear o usuário (sem approval_status = pending)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    whatsapp,
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email     = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    whatsapp  = COALESCE(NULLIF(EXCLUDED.whatsapp,  ''), public.profiles.whatsapp);

  RETURN NEW;
END;
$$;

-- 3. Garantir que o trigger está criado e ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Aprovar automaticamente usuários existentes que estejam pendentes
--    (opcional — execute apenas se necessário para migrar base existente)
-- UPDATE public.profiles
--   SET approval_status = 'approved'
--   WHERE approval_status = 'pending';

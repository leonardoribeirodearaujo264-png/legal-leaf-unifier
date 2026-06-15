-- ============================================================
-- Migration: Monitoramento Admin, Sessões e Auditoria
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de sessões de usuário
CREATE TABLE IF NOT EXISTS user_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER     NOT NULL DEFAULT 0,
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_started_at_idx ON user_sessions(started_at DESC);

-- 2. Tabela de logs de atividade
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_activity_logs_user_id_idx ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS user_activity_logs_created_at_idx ON user_activity_logs(created_at DESC);

-- 3. Tabela de impersonação/acesso assistido
CREATE TABLE IF NOT EXISTS admin_impersonations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id    UUID        REFERENCES auth.users(id),
  target_user_id   UUID        REFERENCES auth.users(id),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  reason           TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Adicionar last_seen_at ao profiles para acesso rápido
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE user_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_impersonations ENABLE ROW LEVEL SECURITY;

-- Helper view para checar admin (evita subconsulta repetida)
-- Verifica tanto profiles.role quanto user_roles para compatibilidade
-- usada inline nas políticas abaixo

-- ── user_sessions ──────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_own_insert"    ON user_sessions;
DROP POLICY IF EXISTS "sessions_own_update"    ON user_sessions;
DROP POLICY IF EXISTS "sessions_own_select"    ON user_sessions;
DROP POLICY IF EXISTS "sessions_admin_select"  ON user_sessions;

CREATE POLICY "sessions_own_insert" ON user_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_own_update" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "sessions_own_select" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "sessions_admin_select" ON user_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles     WHERE id      = auth.uid() AND role    = 'admin')
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role    = 'admin')
  );

-- ── user_activity_logs ─────────────────────────────────────
DROP POLICY IF EXISTS "logs_own_insert"    ON user_activity_logs;
DROP POLICY IF EXISTS "logs_own_select"    ON user_activity_logs;
DROP POLICY IF EXISTS "logs_admin_select"  ON user_activity_logs;

CREATE POLICY "logs_own_insert" ON user_activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "logs_own_select" ON user_activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "logs_admin_select" ON user_activity_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles     WHERE id      = auth.uid() AND role    = 'admin')
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role    = 'admin')
  );

-- ── admin_impersonations ───────────────────────────────────
DROP POLICY IF EXISTS "imp_admin_insert"  ON admin_impersonations;
DROP POLICY IF EXISTS "imp_admin_update"  ON admin_impersonations;
DROP POLICY IF EXISTS "imp_admin_select"  ON admin_impersonations;

CREATE POLICY "imp_admin_insert" ON admin_impersonations
  FOR INSERT WITH CHECK (
    admin_user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM profiles     WHERE id      = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "imp_admin_update" ON admin_impersonations
  FOR UPDATE USING (admin_user_id = auth.uid());

CREATE POLICY "imp_admin_select" ON admin_impersonations
  FOR SELECT USING (
    admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles     WHERE id      = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM user_roles   WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ── profiles: admin pode ver todos ────────────────────────
-- (se já não existir uma policy SELECT aberta para admins)
DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;

CREATE POLICY "profiles_admin_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles     p2 WHERE p2.id      = auth.uid() AND p2.role = 'admin')
    OR EXISTS (SELECT 1 FROM user_roles   ur  WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

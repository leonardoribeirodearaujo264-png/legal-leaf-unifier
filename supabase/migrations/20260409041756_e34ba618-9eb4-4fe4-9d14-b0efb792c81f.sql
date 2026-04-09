
ALTER TABLE comercial_vendedores_config ADD COLUMN IF NOT EXISTS chatguru_user_id TEXT;

UPDATE comercial_vendedores_config SET chatguru_user_id = '66392c1575f9357baf26ad8a' WHERE vendedor_nome ILIKE '%Daniel%';
UPDATE comercial_vendedores_config SET chatguru_user_id = '652c57bb2619cad2db392625' WHERE vendedor_nome ILIKE '%Lucas%';

CREATE TABLE IF NOT EXISTS comercial_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comercial_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read comercial_config" ON comercial_config FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Admins can manage comercial_config" ON comercial_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO comercial_config (key, value, description) VALUES 
  ('marcos_chatguru_id', '63ff69df1c00b36c82814a99', 'ID do Marcos (Head Comercial) no ChatGuru - sempre marcado'),
  ('setor_comercial_chatguru_id', '', 'ID do Setor Comercial no ChatGuru - sempre marcado (preencher quando disponível)')
ON CONFLICT (key) DO NOTHING;

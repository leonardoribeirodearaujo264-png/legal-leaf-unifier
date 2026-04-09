
-- Registro de cada demanda comercial criada
CREATE TABLE public.comercial_demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_advbox_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  vendedor_id UUID REFERENCES public.profiles(id),
  vendedor_nome TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  chatguru_note_id TEXT,
  crm_activity_id UUID,
  status TEXT DEFAULT 'aberto',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comercial_demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view demandas"
ON public.comercial_demandas FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can create demandas"
ON public.comercial_demandas FOR INSERT
TO authenticated
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Admins can update demandas"
ON public.comercial_demandas FOR UPDATE
TO authenticated
USING (public.is_approved(auth.uid()));

-- Configuração de vendedores elegíveis para o rodízio
CREATE TABLE public.comercial_vendedores_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  vendedor_nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comercial_vendedores_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view vendedores config"
ON public.comercial_vendedores_config FOR SELECT
TO authenticated
USING (public.is_approved(auth.uid()));

CREATE POLICY "Admins can manage vendedores config"
ON public.comercial_vendedores_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_socio(auth.uid()));

-- Inserir vendedores iniciais
INSERT INTO public.comercial_vendedores_config (vendedor_id, vendedor_nome, ativo) VALUES
  ('1eebbf27-a9f8-4877-a10d-aec9279e1fea', 'Daniel Martins Silva', true),
  ('1703d91d-4781-4285-ad5c-ad71b108f1d0', 'Jhonny Silva Souza', true),
  ('f83cbef4-8ff7-4168-8e28-6a15f0d2c1f9', 'Lucas Mendes de Paula', true);

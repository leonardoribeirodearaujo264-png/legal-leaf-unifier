
CREATE TABLE public.comercial_demanda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES public.comercial_demandas(id) ON DELETE CASCADE,
  vendedor_anterior_id UUID,
  vendedor_anterior_nome TEXT,
  vendedor_novo_id UUID NOT NULL,
  vendedor_novo_nome TEXT NOT NULL,
  alterado_por UUID NOT NULL,
  alterado_por_nome TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comercial_demanda_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage comercial_demanda_historico"
  ON public.comercial_demanda_historico
  FOR ALL TO authenticated
  USING (public.is_approved(auth.uid()));

INSERT INTO public.comercial_config (key, value, description) VALUES
  ('marcos_obrigatorio', 'true', 'Marcos sempre marcado como responsável'),
  ('setor_comercial_obrigatorio', 'true', 'Setor comercial sempre marcado'),
  ('metodo_distribuicao', 'rodizio', 'rodizio ou sorteio'),
  ('prazo_padrao_horas', '48', 'Prazo padrão em horas para tarefa comercial'),
  ('texto_observacao_chatguru', 'Nova análise de caso para o comercial', 'Texto base da observação no ChatGuru'),
  ('chatguru_ativo', 'true', 'Integração com ChatGuru ativa')
ON CONFLICT (key) DO NOTHING;

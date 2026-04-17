-- Tabela para rastrear entrega de mensagens por destinatário
CREATE TABLE IF NOT EXISTS public.message_deliveries (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id ON public.message_deliveries(message_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_user_id ON public.message_deliveries(user_id);

ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;

-- Usuário pode inserir sua própria entrega
CREATE POLICY "Users can insert own deliveries"
ON public.message_deliveries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Participantes da conversa podem ver entregas das mensagens dessa conversa
CREATE POLICY "Participants can view deliveries"
ON public.message_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_deliveries.message_id
    AND public.is_conversation_participant(auth.uid(), m.conversation_id)
  )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deliveries;
ALTER TABLE public.message_deliveries REPLICA IDENTITY FULL;
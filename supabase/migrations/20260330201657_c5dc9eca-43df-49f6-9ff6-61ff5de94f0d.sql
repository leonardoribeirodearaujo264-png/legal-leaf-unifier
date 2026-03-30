
DROP POLICY "Autor pode editar sua mensagem" ON public.messages;

CREATE POLICY "Autor ou admin pode editar mensagem" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR is_socio_or_rafael(auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR is_socio_or_rafael(auth.uid())
  );


CREATE POLICY "Usuarios aprovados podem atualizar pagamentos"
ON public.parceiros_pagamentos FOR UPDATE TO authenticated
USING (is_approved(auth.uid()))
WITH CHECK (is_approved(auth.uid()));

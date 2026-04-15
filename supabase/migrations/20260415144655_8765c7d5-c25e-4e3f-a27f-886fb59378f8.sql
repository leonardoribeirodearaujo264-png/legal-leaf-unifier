
CREATE POLICY "Usuários com permissão edit podem inserir contatos"
ON public.crm_contacts
FOR INSERT
TO authenticated
WITH CHECK (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

CREATE POLICY "Usuários com permissão edit podem deletar contatos"
ON public.crm_contacts
FOR DELETE
TO authenticated
USING (get_admin_permission(auth.uid(), 'lead_tracking') = 'edit');

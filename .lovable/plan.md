

## Corrigir edição de mensagens internas

### Problemas encontrados

1. **Prazo muito curto**: A função `canEditMessage` permite edição apenas dentro de **5 minutos** (`minutesSinceSent <= 5`). Isso é muito restritivo e explica por que a equipe não consegue editar.

2. **Sem suporte a admin**: O botão de edição só aparece para o autor da mensagem (`isMe && canEditMessage`). Administradores não têm permissão de editar mensagens de outros.

3. **RLS bloqueia admins**: A política de UPDATE na tabela `messages` é `sender_id = auth.uid()`, ou seja, apenas o autor pode editar via banco. Admins são bloqueados no nível do banco.

### Correções

**1. Mensagens.tsx — Ampliar prazo e adicionar suporte admin**

- Alterar `canEditMessage`: prazo de 5 minutos → **360 minutos (6 horas)** para o autor
- Adicionar verificação de admin: buscar `has_role` ou usar a mesma lógica de `isSocio` já existente para determinar se o usuário é admin
- Criar função `canEditMessageAsAdmin`: admins/sócios podem editar qualquer mensagem a qualquer momento
- Atualizar o botão de edição no JSX: mostrar para `(isMe && canEditMessage(msg)) || isAdminOrSocio`

**2. Migração SQL — Atualizar política RLS de UPDATE**

Substituir a política atual por uma que permita:
- Autor editar sua própria mensagem
- Admins (`has_role(auth.uid(), 'admin')`) e sócios (`is_socio_or_rafael(auth.uid())`) editarem qualquer mensagem

```sql
DROP POLICY "Autor pode editar sua mensagem" ON public.messages;
CREATE POLICY "Autor ou admin pode editar mensagem" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR is_socio_or_rafael(auth.uid())
  );
```

**3. useMessaging.tsx — Remover filtro de sender_id no editMessage**

Atualmente o `editMessage` faz `.eq('sender_id', user.id)` no update, o que impede admins de editar mensagens de outros. Precisa condicionar: se for admin/sócio, não filtrar por sender_id.

### Resultado
- Autores podem editar suas mensagens por até 6 horas
- Admins e sócios podem editar qualquer mensagem a qualquer momento
- RLS garante a segurança no nível do banco


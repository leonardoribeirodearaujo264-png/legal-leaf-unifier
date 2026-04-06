
## Corrigir queda imediata de sessão após login

### Diagnóstico
- O cadastro da Ludmilla no backend está normal: aprovado, ativo e não suspenso.
- Então o problema não parece ser permissão nem bloqueio de acesso.
- A causa mais provável está em `src/hooks/useAuth.tsx`, na lógica de inatividade de 6 horas.
- Hoje o sistema usa uma chave global no `localStorage` (`egg_nunes_last_activity`).
- Quando o login acontece, o código ainda lê esse valor antigo e, se ele estiver “velho”, derruba a sessão recém-criada.
- Pior: em alguns pontos o logout é feito com `supabase.auth.signOut()` direto, sem limpar essa chave, o que pode gerar loop de login/logout.

### Correção
1. Ajustar `src/hooks/useAuth.tsx`
   - Trocar o controle de atividade para armazenar `userId + timestamp`, e não só um timestamp solto.
   - No evento `SIGNED_IN`, tratar como sessão nova válida e sobrescrever a atividade imediatamente.
   - Não invalidar login recém-feito com base em atividade antiga do navegador.
   - Aplicar a checagem de inatividade apenas para sessão restaurada/retorno ao app, não para login novo.
   - Centralizar o logout forçado em uma única função que também limpe o estado de atividade.

2. Eliminar o loop de sessão caindo
   - Substituir os `supabase.auth.signOut()` usados nas checagens de inatividade pelo helper centralizado.
   - Se o valor salvo no `localStorage` estiver inválido, antigo ou de outro usuário, limpar e seguir normalmente.

3. Blindagem extra
   - Garantir que dois usuários no mesmo navegador não herdem a inatividade um do outro.
   - Preservar o comportamento correto de expirar sessões realmente antigas.

### Resultado esperado
- A Ludmilla conseguirá logar normalmente sem cair logo em seguida.
- Sessões antigas continuarão sendo encerradas quando necessário.
- O problema deixará de ocorrer com qualquer colaborador que use navegador com storage antigo.

### Verificação
- Testar login com storage antigo: o usuário deve entrar normalmente.
- Testar sessão restaurada após mais de 6 horas: o sistema deve encerrar só essa sessão antiga.
- Testar troca de usuários no mesmo navegador: o segundo login não pode cair por causa do primeiro.

### Arquivo a alterar
- `src/hooks/useAuth.tsx`

### Observação técnica
O indício mais forte é que o perfil da Ludmilla está aprovado e ativo; por isso a correção deve focar na rotina de autenticação/inatividade, não em permissões.

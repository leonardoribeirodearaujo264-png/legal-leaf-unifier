

## Duas correções: Gerar documentos a partir do ADVBox + Evitar perda de dados ao trocar de janela

### 1. Gerar Contrato/Procuração/Declaração a partir da busca de clientes no ADVBox

**Problema**: Hoje, só é possível gerar esses documentos pela aba "Setor Comercial" (que puxa dados do Google Sheets). O usuário quer poder gerar documentos diretamente ao pesquisar um cliente na página de Processos Ativos (dados do ADVBox).

**Solução**: Adicionar botões de "Contrato", "Procuração" e "Declaração" na página `ProcessosAtivos.tsx`, junto aos botões já existentes (Mensagem, Tarefa, Petição). Ao clicar, o sistema monta o objeto `Client` a partir dos dados do ADVBox (`advbox_customers`) e abre o respectivo gerador.

**Arquivo: `src/pages/ProcessosAtivos.tsx`**
- Importar `ContractGenerator`, `ProcuracaoGenerator`, `DeclaracaoGenerator`
- Adicionar estados para controlar abertura dos dialogs e cliente selecionado
- Criar função `handleDocumentFromLawsuit(lawsuit, type)` que:
  - Extrai o `customer_id` do campo `customers` do processo
  - Busca dados completos do cliente em `advbox_customers` (nome, cpf, email, phone, birthday)
  - Também busca dados extras do `client_form_overrides` se existirem (RG, endereço, estado civil, profissão)
  - Monta o objeto `Client` com os campos disponíveis
  - Abre o dialog correspondente
- Adicionar os 3 botões na área de ações de cada card de processo (FileSignature, Scale, FileCheck)
- Renderizar os 3 componentes de geração no final da página

**Limitação conhecida**: O ADVBox armazena menos dados que o Google Sheets (não tem RG, endereço, estado civil, profissão nativamente). Os campos faltantes ficarão com placeholders que o usuário pode preencher manualmente no formulário do documento.

---

### 2. Evitar recarga da página ao trocar de janela

**Problema**: Quando o usuário alterna para outra janela e volta, a página recarrega e perde os dados preenchidos.

**Causa raiz**: O `onAuthStateChange` no `useAuth.tsx` recebe o evento `TOKEN_REFRESHED` quando o token é renovado automaticamente pelo Supabase. Isso atualiza o estado `user` e `session`, causando re-render do `ProtectedRoute`. O `useUserRole` re-busca o perfil, `roleLoading` fica `true` momentaneamente, o componente protegido é desmontado (mostra "Carregando...") e remontado — perdendo todo estado local dos formulários.

**Solução no `src/hooks/useAuth.tsx`** (linha 128-151):
- No handler de `onAuthStateChange`, evitar atualizar `user` e `session` se os valores são os mesmos (comparar `session?.user?.id`). Isso previne re-renders desnecessários quando apenas o token é renovado mas o usuário é o mesmo.

```typescript
(event, session) => {
  // Avoid unnecessary re-renders on TOKEN_REFRESHED
  if (event === 'TOKEN_REFRESHED' && session?.user?.id === user?.id) {
    return; // Same user, no need to update state
  }
  setSession(session);
  setUser(session?.user ?? null);
  ...
}
```

**Solução complementar no `src/hooks/useUserRole.tsx`**:
- Verificar se o `useUserRole` re-busca o perfil desnecessariamente. Adicionar cache ou evitar re-set de `loading` quando o perfil já está carregado para o mesmo usuário.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/ProcessosAtivos.tsx` | Adicionar botões e dialogs de Contrato/Procuração/Declaração por processo |
| `src/hooks/useAuth.tsx` | Evitar re-render no `TOKEN_REFRESHED` quando o user é o mesmo |
| `src/hooks/useUserRole.tsx` | Evitar re-set de loading quando perfil já carregado |

### Resultado
- Ao pesquisar um cliente no ADVBox (Processos Ativos), botões para gerar Contrato, Procuração e Declaração estarão disponíveis
- Ao alternar janelas e voltar, os formulários manterão os dados preenchidos sem recarregar


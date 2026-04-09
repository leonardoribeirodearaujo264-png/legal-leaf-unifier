

## Criar botão "Nova Demanda" na aba Contatos ADVBox

### Resumo

Botão azul "Nova Demanda" que permite ao operacional selecionar um cliente e criar automaticamente uma demanda para o setor comercial, com distribuição por rodízio entre vendedores, registro no ChatGuru e criação de tarefa no CRM/RD Station.

### Fluxo ao clicar "Nova Demanda"

1. Abre Dialog com busca de cliente (mesmo padrão da lista existente)
2. Usuário seleciona cliente e clica "Enviar"
3. Sistema seleciona vendedor por rodízio automático (round-robin)
4. Cria tarefa no CRM (`crm_activities`) sincronizada com RD Station
5. Registra anotação interna no ChatGuru via API (`note_add`)
6. Atualiza status do chat no ChatGuru para "aberto" e marca responsáveis (vendedor sorteado + Marcos + setor comercial) via `chat_edit`
7. Salva registro local da demanda (data, hora, usuário, vendedor atribuído)
8. Exibe confirmação visual (toast + badge no card do cliente)

### Alterações

**1. Migration — Criar tabela `comercial_demandas` e `comercial_vendedores_config`**

```sql
-- Registro de cada demanda criada
CREATE TABLE comercial_demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_advbox_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  vendedor_id UUID REFERENCES profiles(id),
  vendedor_nome TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome TEXT,
  chatguru_note_id TEXT,
  crm_activity_id UUID,
  status TEXT DEFAULT 'aberto',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração de vendedores elegíveis para o rodízio
CREATE TABLE comercial_vendedores_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  vendedor_nome TEXT,
  ativo BOOLEAN DEFAULT true, -- desmarcar se férias/folga
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inicializar com os 3 vendedores atuais
INSERT INTO comercial_vendedores_config (vendedor_id, vendedor_nome, ativo) VALUES
  ('1eebbf27-...', 'Daniel Martins Silva', true),
  ('1703d91d-...', 'Jhonny Silva Souza', true),
  ('f83cbef4-...', 'Lucas Mendes de Paula', true);
```

RLS: acesso para usuários aprovados.

**2. Nova Edge Function `create-commercial-demand/index.ts`**

Recebe: `cliente_advbox_id`, `cliente_nome`, `cliente_telefone`, `user_id`, `user_name`.

Lógica:
- **Rodízio**: Busca último vendedor atribuído em `comercial_demandas`, seleciona o próximo ativo na lista `comercial_vendedores_config`
- **ChatGuru — Anotação** (`note_add`): "Nova análise de caso para o comercial — Cliente: {nome} — Criado por: {usuário} em {data} às {hora}"
- **ChatGuru — Status** (`chat_edit`): status = "aberto", user_id = vendedor sorteado (precisa do ID do ChatGuru, mapeado via e-mail ou nome)
- **ChatGuru — Responsáveis**: Além do vendedor, marca Marcos e setor comercial como responsáveis adicionais
- **CRM**: Insere em `crm_activities` (type: 'task', title: "Analisar caso e apresentar proposta — {cliente}", owner_id: vendedor) e sincroniza com RD Station via `crm-sync`
- **Registro local**: Insere em `comercial_demandas`

**3. Atualizar `src/pages/ContatosAdvbox.tsx`**

- Botão azul "Nova Demanda" no topo (ao lado de "Novo Cliente")
- Dialog "Nova Demanda":
  - Campo de busca de cliente (autocomplete, busca na `advbox_customers`)
  - Card do cliente selecionado (nome, telefone, CPF)
  - Indicação visual de qual vendedor será atribuído (após clicar Enviar)
  - Botão "Enviar Demanda"
- Após sucesso: toast de confirmação com nome do vendedor atribuído
- Badge visual no card do cliente (se tiver demanda recente)

**4. Tela de configuração de vendedores elegíveis**

Seção dentro da aba Contatos (ou sub-aba) para:
- Listar vendedores do comercial
- Toggle ativo/inativo para cada um (excluir de férias/folga)
- Mostrar histórico de atribuições recentes

### Integração ChatGuru (API v1)

```
POST https://s17.chatguru.app/api/v1
Params: key, account_id, phone_id, action=note_add, chat_number, note_text
```

```
POST https://s17.chatguru.app/api/v1
Params: key, account_id, phone_id, action=chat_edit, chat_number, status=aberto, user_id={chatguru_user_id}
```

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar `comercial_demandas` e `comercial_vendedores_config` |
| `supabase/functions/create-commercial-demand/index.ts` | Nova edge function (rodízio + ChatGuru + CRM) |
| `src/pages/ContatosAdvbox.tsx` | Botão "Nova Demanda" + Dialog + configuração vendedores |

### Questão pendente

Para marcar os responsáveis no ChatGuru, preciso mapear os IDs dos vendedores no ChatGuru (Daniel, Lucas, Jhonny, Marcos, e "setor comercial"). A API `chat_edit` usa `user_id` do ChatGuru. Vou buscar esses IDs automaticamente ou posso precisar que você me informe os IDs/nomes exatos como aparecem no ChatGuru.


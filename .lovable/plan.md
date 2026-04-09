

## Análise e correções pendentes do fluxo comercial

### Status atual — o que JÁ está implementado

| Item | Status |
|------|--------|
| 1. Aba Contatos com busca por nome/telefone/CPF/e-mail | Feito |
| 2. Sub-aba Aniversários dentro de Contatos | Feito |
| 3. Botão "Nova Demanda" com dialog de busca de cliente | Feito |
| 4. Rodízio automático entre vendedores (Daniel/Lucas) | Feito |
| 5. Integração ChatGuru (nota + chat_edit + responsáveis) | Feito |
| 7. Criação automática de tarefa no CRM | Feito |
| 8. Destaque visual vermelho para tarefas atrasadas | Feito |
| 9. Aba "Pendências" no CRM com filtros | Feito |
| 13. UX/UI com feedback visual (toasts de sucesso/erro) | Feito |
| 14. Comportamento resiliente se ChatGuru falhar | Feito |

### O que está FALTANDO ou com problemas

**Problema 1 — Jhonny ainda aparece no CRM Dashboard**
`CRMDashboard.tsx` linha 47 ainda lista Jhonny nos `RESPONSAVEIS_IDS`. Precisa ser removido.

**Problema 2 — Sem reassignação manual de demandas com histórico (item 6)**
Não existe UI para trocar o responsável de uma demanda já criada, nem tabela de histórico de alterações.

**Problema 3 — Sem visualização de logs das demandas (item 11)**
A tabela `comercial_demandas` registra dados, mas não existe UI para consultar o histórico de demandas criadas, ver se o ChatGuru funcionou, quem criou, etc.

**Problema 4 — Configuração administrativa incompleta (item 12)**
Existe apenas config de vendedores (ativar/desativar + ID ChatGuru). Faltam:
- Toggle para Marcos como participante obrigatório
- Toggle para setor comercial
- Método de distribuição (sorteio vs rodízio)
- Prazo padrão da tarefa
- Texto padrão da observação do ChatGuru
- Toggle para ativar/desativar integração ChatGuru

### Alterações planejadas

**1. Remover Jhonny do `CRMDashboard.tsx`**
Remover linha 47 do array `RESPONSAVEIS_IDS`.

**2. Migration — Tabela de histórico de reassignação + colunas de config**

```sql
-- Histórico de reassignação de demandas
CREATE TABLE comercial_demanda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID NOT NULL REFERENCES comercial_demandas(id) ON DELETE CASCADE,
  vendedor_anterior_id UUID,
  vendedor_anterior_nome TEXT,
  vendedor_novo_id UUID NOT NULL,
  vendedor_novo_nome TEXT NOT NULL,
  alterado_por UUID NOT NULL,
  alterado_por_nome TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comercial_demanda_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can manage" ON comercial_demanda_historico
  FOR ALL TO authenticated USING (public.is_approved(auth.uid()));

-- Configurações extras na tabela comercial_config
INSERT INTO comercial_config (key, value, description) VALUES
  ('marcos_obrigatorio', 'true', 'Marcos sempre marcado como responsável'),
  ('setor_comercial_obrigatorio', 'true', 'Setor comercial sempre marcado'),
  ('metodo_distribuicao', 'rodizio', 'rodizio ou sorteio'),
  ('prazo_padrao_horas', '48', 'Prazo padrão em horas para tarefa comercial'),
  ('texto_observacao_chatguru', 'Nova análise de caso para o comercial', 'Texto base da observação no ChatGuru'),
  ('chatguru_ativo', 'true', 'Integração com ChatGuru ativa')
ON CONFLICT (key) DO NOTHING;
```

**3. Criar componente de histórico/logs de demandas**
Novo componente `src/components/crm/CRMDemandasLog.tsx`:
- Lista todas as demandas de `comercial_demandas` com: cliente, vendedor atribuído, criado por, data/hora, status ChatGuru (sucesso/falha), status tarefa CRM
- Filtro por data e por vendedor
- Indicadores visuais: verde se ChatGuru OK, vermelho se falhou

**4. Adicionar reassignação manual nas demandas**
No componente de logs, cada demanda terá botão "Reatribuir" que:
- Abre dialog com dropdown de vendedores ativos
- Ao confirmar, atualiza `comercial_demandas.vendedor_id/vendedor_nome`
- Registra em `comercial_demanda_historico`
- Atualiza o `owner_id` da `crm_activities` vinculada

**5. Expandir configuração administrativa**
Ampliar o dialog de configuração em `ContatosAdvbox.tsx` para incluir todos os toggles e campos configuráveis (Marcos, setor comercial, método, prazo, texto ChatGuru, ativar/desativar ChatGuru).

**6. Atualizar edge function `create-commercial-demand`**
Ler configurações dinâmicas da tabela `comercial_config` em vez de valores hardcoded:
- `marcos_obrigatorio` para decidir se marca Marcos
- `setor_comercial_obrigatorio` para setor
- `prazo_padrao_horas` para due_date da tarefa CRM
- `texto_observacao_chatguru` para texto da nota
- `chatguru_ativo` para pular integração se desativado

**7. Adicionar aba "Demandas" no CRM Dashboard**
Nova tab no CRM para acessar o log de demandas comerciais, ao lado de "Pendências".

**8. Registrar atualização na intranet**
Inserir registro em `intranet_updates` documentando as melhorias.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Tabela `comercial_demanda_historico` + configs extras |
| `src/components/crm/CRMDashboard.tsx` | Remover Jhonny + adicionar aba Demandas |
| `src/components/crm/CRMDemandasLog.tsx` | Novo — log de demandas + reassignação |
| `src/components/crm/index.ts` | Exportar novo componente |
| `src/pages/ContatosAdvbox.tsx` | Expandir dialog de configuração |
| `supabase/functions/create-commercial-demand/index.ts` | Ler configs dinâmicas |




## Incluir colaboradores inativos na área de Pagamentos do RH

### Problema

Os componentes de pagamentos (RHPagamentos e RHDashboard) filtram colaboradores com `is_active = true` e `is_suspended = false`. Isso impede que a Tatiane (desligada) apareça na lista para lançar pagamentos retroativos como acerto de rescisão.

### Correção

**1. `src/components/rh/RHPagamentos.tsx` (linha 177-183)**

Remover os filtros `is_active` e `is_suspended` da query de colaboradores, mantendo apenas `approval_status = 'approved'`. Assim todos os colaboradores aprovados (ativos ou não) aparecem na lista de pagamentos.

Opcionalmente, ordenar mostrando inativos ao final ou com indicação visual (badge "Desligado").

**2. `src/components/rh/RHDashboard.tsx` (linhas 63-69)**

Mesma alteração: remover filtros `is_active` e `is_suspended` da query de colaboradores do dashboard de pagamentos, para que o filtro de colaborador também inclua inativos.

**3. Indicação visual (ambos arquivos)**

Adicionar um badge "(Desligado)" ou "(Inativo)" ao lado do nome do colaborador inativo nos selects e tabelas, para que fique claro quem está ativo e quem não está.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/components/rh/RHPagamentos.tsx` | Remover `.eq('is_active', true).eq('is_suspended', false)` da query de profiles; adicionar badge visual para inativos |
| `src/components/rh/RHDashboard.tsx` | Mesma remoção de filtros na query de colaboradores |

### Resultado
- Tatiane e qualquer outro colaborador desligado aparecerá na lista de pagamentos
- Será possível lançar pagamentos retroativos (acerto, rescisão, etc.)
- Os demais módulos do RH continuam ocultando inativos normalmente




## Implementar tiques de status nas mensagens internas (estilo WhatsApp)

### Situação atual
Já existe uma função `isMessageRead` que verifica se algum participante leu a mensagem, e mostra `✓✓` quando lida. Mas falta diferenciar os 3 estados: enviada, recebida e lida.

### Lógica dos 3 estados

| Estado | Visual | Condição |
|---|---|---|
| **Enviada** | ✓ (cinza) | Mensagem existe no banco (já está salva) |
| **Recebida** | ✓✓ (cinza) | Pelo menos 1 outro participante tem `last_read_at` posterior OU a mensagem foi entregue via Realtime (participante está online) |
| **Lida** | ✓✓ (azul) | Pelo menos 1 outro participante tem `last_read_at >= msg.created_at` |

Como o sistema atual não rastreia "entrega" separadamente de "leitura", usaremos uma abordagem simplificada:
- ✓ = enviada (sempre, para mensagens minhas)
- ✓✓ cinza = pelo menos um participante está na conversa (tem atividade recente) mas ainda não leu
- ✓✓ azul = pelo menos um participante leu a mensagem

**Simplificação prática**: Como não há campo de "delivered_at", usaremos:
- **1 tique cinza** (✓): mensagem enviada
- **2 tiques cinza** (✓✓): mensagem não lida ainda por ninguém
- **2 tiques azuis** (✓✓): mensagem lida por pelo menos 1 participante

Na prática, como não temos delivery tracking separado, faremos **2 estados visuais claros**:
- ✓ cinza = enviada, não lida
- ✓✓ azul = lida

### Correção

**Arquivo: `src/pages/Mensagens.tsx`** (linhas 1668-1680)

Substituir o bloco atual que mostra apenas `✓✓` quando lida por:
- Se `isMe` e `isMessageRead(msg)`: mostrar 2 checks azuis (ícones Check do Lucide, cor azul)
- Se `isMe` e não lida: mostrar 1 check cinza (ícone Check do Lucide)
- Se não é `isMe`: não mostrar tiques

Usar ícones SVG do Lucide (`Check`) em tamanho pequeno em vez de caracteres texto, para visual mais limpo e colorido.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/Mensagens.tsx` | Substituir o `✓✓` por componente com ícones Check coloridos (azul para lido, cinza para enviado) |


# Guia — Central de Marketing, Segmentos e WhatsApp Manual

## Objetivo

A Central de Marketing permite criar segmentos de clientes, campanhas, modelos de mensagem, prévia de destinatários e preparação de envio manual via WhatsApp.

Ela foi construída com segurança: **não há disparo automático de mensagens**.

## Rota

```text
/admin/marketing
```

## Conceitos principais

### Segmentos

Segmentos agrupam clientes para campanhas.

Tipos previstos:

- manual;
- tag;
- nível de fidelidade;
- comportamento;
- histórico de compras;
- campanha;
- personalizado.

### Campanhas

Campanhas representam ações promocionais ou comunicacionais.

Tipos previstos:

- comunicação;
- promoção;
- benefício;
- reativação;
- aniversário;
- fidelidade;
- personalizada.

### Destinatários preparados

Destinatários preparados são clientes selecionados para uma campanha, com mensagem personalizada gerada pelo sistema.

## Fluxo operacional atual

```text
1. Criar ou escolher segmento.
2. Atualizar segmentos.
3. Criar campanha.
4. Escolher público-alvo.
5. Escrever mensagem usando variáveis.
6. Gerar prévia de destinatários.
7. Preparar todos.
8. Abrir WhatsApp individualmente.
9. Enviar manualmente no WhatsApp.
10. Marcar como enviado no OptmaMenu.
```

## Variáveis de mensagem

Variáveis disponíveis:

| Variável | Substituição |
|---|---|
| `{{customer_name}}` | Nome do cliente |
| `{{store_name}}` | Nome da loja |
| `{{current_date}}` | Data atual |

## Status dos destinatários

| Status | Significado |
|---|---|
| `ready` | Preparado, ainda não enviado |
| `sent` | Marcado manualmente como enviado |
| `delivered` | Reservado para integração futura/API |
| `read` | Reservado para integração futura/API |
| `clicked` | Reservado para rastreio futuro |
| `converted` | Reservado para conversão futura |
| `failed` | Falha |
| `cancelled` | Cancelado |

## WhatsApp manual

O botão WhatsApp abre uma URL no formato:

```text
https://wa.me/<telefone>?text=<mensagem>
```

O OptmaMenu não envia a mensagem sozinho. O lojista precisa confirmar/envia-la no WhatsApp.

## Campanhas agendadas

O campo `scheduled_at` serve como lembrete/planejamento.

Campanha agendada:

- não envia automaticamente;
- aparece como agendada, vencida ou para hoje;
- deve ser preparada e enviada manualmente pelo lojista.

## Entregue e lido

Sem WhatsApp Business Platform/Cloud API ou outro provedor oficial, o OptmaMenu não consegue saber automaticamente se a mensagem foi entregue ou lida.

No modelo atual:

- `sent` é confirmação manual do lojista;
- `delivered` e `read` devem ficar reservados para integração futura;
- não se deve prometer rastreio automático sem API.

## Metadata JSON e Conditions JSON

### `metadata`

Usado para informações técnicas, contexto e auditoria.

Exemplo:

```json
{
  "created_by_source": "marketing_center_page",
  "last_recipients_prepared_at": "2026-05-05T21:30:00-03:00"
}
```

### `conditions`

Usado para regras de aplicação da campanha.

Exemplo futuro:

```json
{
  "only_loyalty_opt_in": true,
  "minimum_order_value": 30,
  "days_without_purchase_gt": 30
}
```

Resumo:

```text
metadata = informações sobre o registro
conditions = regras para aplicar/usar o registro
```

## Separação com mensagens operacionais

A rota `/admin/messages-admin` deve ser reservada para mensagens não promocionais, como:

- manutenção;
- sistema fora do ar;
- comunicados gerais;
- alertas operacionais;
- avisos internos.

A Central de Marketing deve concentrar promoções, campanhas, fidelidade e comunicações dirigidas.

## Integrações futuras

- WhatsApp Business Platform/Cloud API;
- Telegram Bot/canal;
- push notifications;
- atendimento automático via n8n;
- fila de envio;
- templates aprovados;
- opt-in/opt-out;
- webhooks de status.

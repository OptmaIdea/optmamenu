# Manual do Usuário — OptmaMenu

> Versão inicial consolidada após a Fase 8 Comercial.

## 1. Visão geral

O OptmaMenu é um sistema para gestão de produtos, estoque, compras, fornecedores, clientes, pedidos, caixa, fidelidade e campanhas comerciais.

A partir da Fase 8, o sistema também passou a contemplar uma jornada comercial inicial: loja pública, pedidos pelo cliente, reserva de estoque, livro de caixa, fidelidade e marketing manual por WhatsApp.

## 2. Painel operacional e Dashboard comercial

### Painel operacional

Rota:

```text
/admin
```

Uso:

- visão diária da operação;
- pedidos recentes;
- estoque crítico;
- alertas;
- atividades recentes.

### Dashboard comercial

Rota:

```text
/admin/commercial-dashboard
```

Uso:

- análise por período;
- vendas;
- pedidos por status;
- ticket médio;
- top produtos;
- canais de venda;
- clientes;
- fidelidade;
- caixa.

## 3. Pedidos

Rota:

```text
/admin/orders
```

Fluxo recomendado:

```text
Pedido reservado
→ Aceitar/preparar
→ Concluir/entregar
```

Ao concluir, o sistema pode:

- baixar estoque;
- consumir reserva;
- gerar movimentação de estoque;
- lançar entrada no livro de caixa;
- pontuar fidelidade.

Cancelamentos novos devem liberar reservas automaticamente.

## 4. Loja pública

A loja pública permite que clientes façam pedidos pelo catálogo/cardápio por slug.

O lojista deve configurar:

- loja pública ativa;
- catálogo público ativo;
- local de venda pública;
- formas de pagamento públicas;
- formas de entrega públicas;
- tempo de reserva;
- contatos da loja.

## 5. Pagamentos

Rota de configuração:

```text
/admin/commercial-settings
```

Formas típicas:

- A combinar;
- PIX;
- Dinheiro;
- Cartão de débito;
- Cartão de crédito.

Apenas métodos configurados para afetar caixa geram lançamento automático no Livro de Caixa.

## 6. Entregas

As formas de entrega podem incluir:

- retirada na loja;
- entrega local;
- mesa/QR;
- consumo local.

Regra adotada:

- retirada pode ter qualquer valor;
- entrega pode exigir pedido mínimo.

## 7. Livro diário de caixa

Rota:

```text
/admin/cashbook
```

Registra entradas e saídas simples da operação.

Entradas por venda são geradas automaticamente quando o pedido é concluído e a forma de pagamento afeta caixa.

O sistema ainda não faz conciliação bancária.

## 8. Clientes

Rota:

```text
/admin/customers
```

Clientes podem ser:

- cadastrados pela loja;
- originados da loja pública;
- originados de WhatsApp/QR;
- importados futuramente.

Clientes vindos de canais públicos têm dados protegidos e edição limitada pela loja. Clientes cadastrados diretamente pela administração podem ser editados pela loja.

## 9. Vida do Cliente

A Vida do Cliente reúne histórico, pedidos, dados, pontos e observações.

Deve ser usada para entender:

- quando o cliente comprou;
- quanto gastou;
- saldo de pontos;
- origem;
- relacionamento com a loja.

## 10. Fidelidade

A fidelidade pontua pedidos concluídos conforme regras configuradas.

Pontos não devem ser considerados definitivos antes da conclusão do pedido.

A consolidação completa da fidelidade avançada será feita em etapa futura, incluindo prêmios, selos, expiração de pontos, termos legais e configuração completa de níveis.

## 11. Central de Marketing

Rota:

```text
/admin/marketing
```

A Central de Marketing permite:

- criar segmentos;
- criar campanhas;
- gerar prévias;
- preparar destinatários;
- abrir WhatsApp individualmente;
- marcar destinatário como enviado.

Importante:

```text
O sistema não envia campanhas automaticamente.
```

Campanhas agendadas servem como lembrete visual. O lojista precisa preparar e enviar manualmente.

## 12. Enviado, entregue e lido no WhatsApp

No modelo atual:

| Status | Como funciona |
|---|---|
| Pronto | Sistema preparou destinatário |
| Enviado | Lojista marcou manualmente |
| Entregue | Não confirmado automaticamente sem API |
| Lido | Não confirmado automaticamente sem API |

Para confirmar entregue/lido automaticamente, será necessária integração oficial com WhatsApp Business Platform/Cloud API ou provedor equivalente.

## 13. Mensagens operacionais

A rota:

```text
/admin/messages-admin
```

deve ser usada futuramente para mensagens não promocionais, como:

- manutenção;
- sistema fora do ar;
- comunicados gerais;
- alertas internos.

Isso deve ficar separado da Central de Marketing.

## 14. Configurações de estoque

Rota:

```text
/admin/stock-settings
```

A área organiza mínimos e máximos globais e por local. A evolução futura deve permitir distribuição mais refinada dos limites por unidade/local.

## 15. Boas práticas operacionais

- Conferir pedidos reservados diariamente.
- Cancelar pedidos não atendidos pelo fluxo do painel.
- Concluir pedidos somente quando forem entregues/prontos.
- Conferir o Livro de Caixa ao final do dia.
- Atualizar segmentos antes de campanhas.
- Não prometer envio automático de WhatsApp sem integração oficial.
- Usar o Dashboard comercial para análise por período.

## 16. Limitações conhecidas

- Envio de WhatsApp é manual.
- Entregue/lido não são rastreados automaticamente.
- Livro de Caixa ainda não é conciliação bancária.
- Fidelidade avançada ainda será consolidada em sprint própria.
- Geração/impressão real de QR Code por mesa fica para etapa futura.
- Relatórios gerenciais em PDF serão tratados em etapa posterior.

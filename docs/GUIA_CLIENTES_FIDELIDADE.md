# Guia — Clientes, Vida do Cliente e Fidelidade

## Objetivo

A camada de clientes da Fase 8 passou a distinguir clientes vindos da loja pública/WhatsApp de clientes cadastrados diretamente pela administração, além de conectar pedidos, pontos, histórico e segmentação.

## Tipos de clientes

| Origem | Propriedade dos dados | Edição pela loja |
|---|---|---|
| Loja pública / WhatsApp / QR | `customer_owned` | Protegida, edição limitada |
| Administração | `store_managed` | Editável pela loja |
| Misto | `mixed` | Regras intermediárias |

## Regra prática

Clientes criados pelo próprio cliente ou por canais públicos devem ter dados pessoais protegidos. A loja pode manter observações internas e classificações operacionais, mas não deve alterar dados sensíveis livremente.

Clientes cadastrados diretamente pela administração podem ser editados pela loja.

## Vida do Cliente

A Vida do Cliente deve centralizar:

- dados básicos;
- origem;
- consentimentos;
- pedidos;
- total gasto;
- pontos;
- extrato de fidelidade;
- observações internas;
- segmentações futuras;
- comunicações futuras.

## Fidelidade avançada inicial

A Fase 8 entregou a base de pontuação avançada por pedido concluído.

Fluxo:

```text
pedido concluído
→ calcula pontos por regras ativas
→ cria transação em loyalty_transactions
→ atualiza saldo do cliente
→ atualiza nível quando aplicável
```

## Tabelas relevantes

- `customers`
- `loyalty_transactions`
- `loyalty_point_rules`
- `customer_benefit_rules`
- `fidelity_programs`
- `fidelity_tiers`
- `fidelity_rewards`
- `fidelity_vouchers`

## Pontos entregues

- consulta de pontos na loja pública;
- exibição do nome do cliente pontuante;
- pontos por pedido concluído;
- extrato básico;
- níveis existentes;
- regras de pontuação avançada inicial;
- benefícios/descontos como estrutura inicial.

## Consolidação futura da fidelidade

A fidelidade avançada deve virar sprint própria depois do dashboard e marketing.

Itens registrados:

- bônus de adesão por aceite no programa;
- bônus por atingir nível pela primeira vez;
- expiração de pontos;
- multiplicadores por categoria/produto;
- sistema de selos por compras;
- configuração completa de níveis: ativo/inativo, cor, nome, pontos mínimos e multiplicador;
- prêmios e resgates disponíveis;
- clientes ativos com saldos e extratos;
- termos legais/adesão;
- limpeza da lógica antiga de fidelidade no front.

## Manual para operação

Ao orientar o lojista:

- Pontos são gerados por pedido concluído, não por pedido reservado.
- Cancelamentos não devem gerar pontos permanentes.
- Ajustes manuais de pontos devem ser auditados em fase futura.
- Benefícios/descontos ainda precisam ser conectados ao checkout/pedido.

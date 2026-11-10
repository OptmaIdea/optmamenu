# Módulo Comercial, Vendas, Clientes e Fidelidade

> **Versão Autorizada:** `0.10.0-rc.1`  
> **Escopo:** Gestão de pedidos comerciais, venda direta, clientes 360º, programa de fidelidade, central de marketing, mensagens WhatsApp/LGPD e atacado combinado.

---

## 🛒 1. Gestão de Pedidos Comerciais (`/admin/orders`)

### 1.1 Ciclo de Vida do Pedido
Os pedidos comerciais (originados pela loja pública, WhatsApp ou balcão) transitam pelos seguintes estados:
- **Pendente**: Pedido recebido aguardando confirmação do estabelecimento. Reserva temporária de estoque ativa.
- **Confirmado / Em Preparo**: Pedido aceito e enviado para a cozinha/produção.
- **Pronto / Em Trânsito**: Pedido finalizado aguardando retirada ou em rota de entrega.
- **Concluído**: Pedido entregue e pagamento baixado no Livro Caixa.
- **Cancelado / Expirado**: Pedido rejeitado ou expirado por decurso de prazo.

### 1.2 Expiração Automática de Pedidos Pendentes
- Pedidos pendentes online que não forem confirmados no tempo limite (configurado nas opções da loja) sofrem expiração automática.
- O job no banco de dados executa a rotina para liberar os itens reservados de volta ao estoque disponível.

---

## 👤 2. Gestão de Clientes 360º (`/admin/customers`)

### 2.1 Perfis de Identificação
- **Cliente Eventual / Balcão**: Compra presencial no PDV sem necessidade de cadastro completo.
- **Cliente Registrado**: Possui cadastro formal com Nome, CPF, Telefone e Histórico de Compras.
- **Cliente da Loja Pública**: Cliente autenticado ou identificado pelo número do celular na loja online.

### 2.2 Painel Visão 360º do Cliente (`/admin/customers/:id`)
- Histórico completo de pedidos e ticket médio.
- Saldo de pontos no programa de fidelidade.
- Preferências de comunicação e consentimento LGPD.
- Estado atual de Termos de Uso, Política de Privacidade, Fidelidade, WhatsApp, e-mail e SMS.
- Histórico cronológico dos eventos de consentimento, com origem e versões legais quando disponíveis.

### 2.3 Identidade, deduplicação e fusão segura
A frente C2 consolidou a identidade de clientes com normalização e detecção de candidatos duplicados por telefone, CPF, e-mail e nome + data de nascimento.

A tela `/admin/customers` possui as abas **Possíveis duplicidades** e **Histórico de fusões**. A fusão é sempre manual e auditada. O backend mantém o cadastro principal, transfere vínculos suportados e marca o cadastro absorvido como `merged`.

RPCs principais:
- `get_customer_duplicate_candidates_safe(uuid, uuid, integer)` — lista pares candidatos e informa a sugestão de cadastro principal.
- `merge_customers_safe(uuid, uuid, uuid, text)` — executa a fusão transacional. Para usuários administrativos exige `customers.manage` + `customers.sensitive.view`, salvo owner.
- `get_customer_merge_history_safe(uuid, uuid, integer)` — consulta o ledger das fusões.

### 2.4 Consentimentos e preferências — C3
O histórico oficial é `customer_consent_logs`. Alterações feitas pelo próprio cliente passam por RPC server-side e não por `insert/update` direto nas tabelas de clientes.

RPCs relevantes:
- `get_customer_self_consents_safe()` — retorna ao cliente autenticado o próprio histórico de consentimentos.
- `set_customer_self_consent_safe(text, boolean, text, text, text)` — registra concessão/revogação do próprio cliente para `loyalty_program`, `marketing_whatsapp`, `marketing_email` e `marketing_sms`.
- `create_admin_customer_safe(...)` / `update_admin_customer_safe(...)` — alterações de consentimento pelo backoffice exigem `customers.consent.manage` e registram evidência administrativa explícita.
- `get_customer_360_safe(uuid, uuid)` — expõe consentimentos ao administrativo somente quando houver acesso a dados sensíveis.

A coluna `customers.marketing_consent` representa o estado agregado de marketing: fica `true` quando **ao menos um** canal de marketing possui como último evento uma concessão ativa, e `false` quando nenhum canal está ativo. Assim, revogar e-mail não desliga WhatsApp que continue consentido, por exemplo. `customers.loyalty_opt_in` é sincronizado com o último evento de `loyalty_program`.

Migrations C3:
- `20260913103142_customer_consent_current_state.sql` — consolida o estado agregado de marketing e fidelidade.
- `20260913103711_fix_customer_consent_event_ordering.sql` — usa timestamp real por evento (`clock_timestamp()`) para garantir ordenação determinística mesmo dentro da mesma transação.
- `20260913103900_harden_customer_self_consent_rpc_grants.sql` — remove execução anônima das RPCs de autogestão de consentimento.

> **Fronteira atual de segurança:** o portal autenticado do cliente continua propositalmente *fail-closed*. `CUSTOMER_PORTAL_AUTH_ENABLED` permanece desabilitado e a Edge Function `issue_customer_jwt` não emite sessão enquanto senha + OTP não forem provados no servidor. Portanto, a infraestrutura de autogestão de consentimentos está pronta e segura no backend, mas não deve ser exposta ao cliente até a conclusão da sessão autenticada do portal.

---

## 🎁 3. Programa de Fidelidade e Recompensas (`/admin/loyalty`)

### 3.1 Regras de Acúmulo e Resgate
- O estabelecimento define a taxa de conversão (ex: R$ 1,00 gasto = 1 ponto acumulado).
- Os pontos acumulados podem ser trocados por produtos ou cupons de desconto.
- **Biblioteca de Mídias de Prêmios (`reward_media_library`)**: Suporte a upload de até 15 imagens otimizadas para ilustrar os prêmios do catálogo de fidelidade.

---

## 🏷️ 4. Regras de Atacado Combinado e Grupos de Precificação

### 4.1 Grupos de Precificação (`/admin/products/pricing-groups`)
- Permite criar regras de desconto por volume agrupando categorias ou produtos distintos.
- **Exemplo**: Ao comprar 3 itens quaisquer da categoria "Salgados" + "Bebidas", o cliente obtém o preço unitário de atacado em todos os 3 itens.
- **Ordem de Precedência Autorizada no Backend**:
  1. Preço promocional direto no produto;
  2. Desconto do grupo de atacado combinado;
  3. Preço da categoria;
  4. Preço base do produto.

---

## 📱 5. Central de Marketing e Mensageria Assistida (`/admin/marketing`)

### 5.1 Envio de Mensagens Assistidas via WhatsApp
- Comunicação direta com o cliente para atualização do status do pedido, lembretes de aniversário ou ofertas exclusivas.
- Respeita o opt-in de marketing e inclui avisos padrão LGPD no rodapé de todas as mensagens.
- **Integração SMSGate**: Emissão de notificações ativas integrando em background com o serviço OptmaSMSGate.

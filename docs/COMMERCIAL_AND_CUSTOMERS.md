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
- Preferências de comunicação e consentimento LGPD (`preserve_public_customer_marketing_consent`).

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

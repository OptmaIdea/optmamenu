# POS_9 — Venda direta — Seleção de cliente existente

## Status

Implementado para validação local.

## Contexto

A venda direta já estava funcional com:

- menu Comercial apontando para `/admin/direct-sales`;
- itens agrupados no carrinho;
- ajuste de quantidade por item;
- desconto adicional editável/zerável;
- desconto por quantidade;
- forma de pagamento amigável;
- pedido gerado com sucesso.

## Implementação

Arquivo alterado:

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`

Commit:

- `440776a9e5d1b7819482b9bea5095a18eb4a583c`

## O que mudou

A tela agora carrega clientes existentes usando:

- `Customers360Service.listCustomers(storeId, 500)`;
- RPC segura `get_admin_customers_safe`.

A seção `Cliente e pagamento` recebeu um seletor de cliente.

## Comportamento

### Default

O default permanece:

- `Cliente de balcão`.

Nesse modo:

- `customer_id` é enviado como `null`;
- nome fica como `Cliente de balcão`;
- telefone fica livre para digitação opcional;
- a RPC pode criar cliente rápido se houver telefone válido e permissão.

### Cliente existente

Ao selecionar cliente existente:

- `customer_id` é enviado para a RPC;
- nome e telefone são preenchidos automaticamente;
- nome e telefone ficam somente leitura na tela;
- o pedido fica vinculado ao cliente.

### Voltar para balcão

Quando há cliente selecionado, aparece ação para voltar para cliente de balcão.

## Segurança e dados protegidos

Esta alteração não edita cadastro de cliente.

Ela apenas usa o cliente selecionado como vínculo comercial do pedido.

Assim, não altera dados pessoais de clientes vindos da loja pública/WhatsApp nem interfere no padrão de proteção de dados da Vida do Cliente.

## Sem schema novo

Não foi criada migration.

## Sem permissão nova

A rota continua protegida por `orders.manage`.

A listagem usa a RPC segura de clientes já existente.

## Validação sugerida

1. Acessar `/admin/direct-sales` pelo menu Comercial.
2. Confirmar que o default é `Cliente de balcão`.
3. Criar venda sem cliente selecionado.
4. Selecionar cliente existente.
5. Confirmar que nome/telefone foram preenchidos.
6. Concluir venda.
7. Confirmar que o pedido foi criado e vinculado ao cliente.
8. Conferir console limpo e build ok.

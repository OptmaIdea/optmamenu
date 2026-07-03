# POS_9 - Financeiro - Contas financeiras - UI de cadastro

## Status

Diretriz registrada.

## Decisao

A loja tera uma area para cadastrar, editar e desativar contas financeiras e locais de caixa.

As contas criadas automaticamente sao apenas o ponto inicial.

## Exemplos de contas que o owner podera criar

- Caixa Balcao;
- Caixa Delivery;
- Caixa Evento;
- Cofre Loja;
- Cofre Escritorio;
- Banco Itau;
- Banco Bradesco;
- Banco Inter;
- Pix CNPJ;
- Stone;
- InfinitePay;
- PagSeguro;
- Mercado Pago;
- Recebiveis Stone;
- Recebiveis Cielo.

## Tipos suportados

A base atual suporta:

- cash_drawer;
- safe;
- bank;
- pix_wallet;
- card_acquirer;
- card_receivable;
- owner;
- other.

## Regras de cadastro

- toda conta pertence a uma loja;
- cada conta tem codigo, nome, tipo e status ativo;
- pode existir uma conta padrao por tipo ou contexto;
- contas com movimento nao devem ser excluidas;
- contas sem uso podem ser desativadas;
- exclusao fisica deve continuar bloqueada na regra inicial.

## Local sugerido na UI

Opcao 1:

- Configuracoes > Financeiro > Contas financeiras

Opcao 2:

- Livro Diario > aba Configuracoes financeiras

Preferencia inicial:

- Configuracoes > Financeiro > Contas financeiras

## Uso futuro

Essas contas serao usadas para:

- caixa fisico do dia;
- fechamento do caixa;
- sangria;
- transferencia entre caixa e cofre;
- recebimentos Pix;
- recebimentos de cartao;
- conciliacao com banco;
- reforco de troco;
- aporte do proprietario;
- retirada do proprietario;
- zeramento operacional de formas que nao ficam no caixa fisico.

## Permissoes futuras sugeridas

- cashbook.accounts.view;
- cashbook.accounts.manage.

Enquanto essas permissoes nao existirem, usar permissao atual de caixa/financeiro com cuidado.

## Proxima etapa tecnica

Criar service e tela simples para listar, criar, editar e desativar contas financeiras da loja.

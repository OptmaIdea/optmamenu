# Manual do Usuário — OptmaMenu

> Guia completo de uso do sistema OptmaMenu para gestores, operadores e equipe da loja.

---

## Sumário

1. [Primeiros Passos](#1-primeiros-passos)
2. [Dashboard e Painel Operacional](#2-dashboard-e-painel-operacional)
3. [Pedidos](#3-pedidos)
4. [Loja Pública e Catálogo Online](#4-loja-pública-e-catálogo-online)
5. [Produtos](#5-produtos)
6. [Categorias](#6-categorias)
7. [Estoque](#7-estoque)
8. [Transferências](#8-transferências)
9. [Compras](#9-compras)
10. [Cotações](#10-cotações)
11. [Fornecedores](#11-fornecedores)
12. [Clientes](#12-clientes)
13. [Fidelidade](#13-fidelidade)
14. [Marketing e Campanhas](#14-marketing-e-campanhas)
15. [Livro Diário (Caixa)](#15-livro-diário-caixa)
16. [Dashboard Comercial](#16-dashboard-comercial)
17. [Configurações da Loja](#17-configurações-da-loja)
18. [Meu Perfil](#18-meu-perfil)
19. [Horários de Funcionamento](#19-horários-de-funcionamento)
20. [Gerenciamento de Usuários](#20-gerenciamento-de-usuários)
21. [Segurança e Permissões](#21-segurança-e-permissões)
22. [Relatórios](#22-relatórios)
23. [Atividades Recentes e Alertas](#23-ativas-recentes-e-alertas)
24. [Suporte e Documentação](#24-suporte-e-documentação)
25. [Boas Práticas Operacionais](#25-boas-práticas-operacionais)
26. [Perguntas Frequentes (FAQ)](#26-perguntas-frequentes-faq)

---

## 1. Primeiros Passos

### 1.1 Acessando o Sistema

Acesse o painel administrativo pela URL fornecida pelo seu gestor ou pela página de login da loja.

**Fluxo de login:**
1. Informe seu **e-mail** e **senha**.
2. Clique em **Entrar**.
3. Se for seu primeiro acesso, o sistema pode redirecionar para o **Onboarding** para completar seu perfil (nome, CPF, endereço).
4. Após completar o perfil, você terá acesso ao painel administrativo.

### 1.2 Estrutura do Painel

Ao entrar no sistema, você verá:

- **Menu lateral esquerdo:** Navegação organizada por módulos (Dashboard, Comercial, Financeiro, Produtos, Configurações, Suporte).
- **Cabeçalho superior:** Título da página atual, botão de refresh, alternador de modo escuro/claro, relógio de sessão e botão de logout.
- **Área principal:** Conteúdo da página selecionada.

### 1.3 Alternar Modo Escuro

Clique no ícone de lua/sol no cabeçalho superior para alternar entre o tema claro e escuro. A preferência é salva automaticamente.

### 1.4 Sessão e Timeout

O sistema exibe o tempo de sessão no cabeçalho. Se houver inatividade prolongada (configurável pelo administrador), a sessão será encerrada automaticamente por segurança.

---

## 2. Dashboard e Painel Operacional

### 2.1 Painel Operacional

**Rota:** `/admin`

O painel operacional é sua tela principal, exibindo:

| Card | Descrição |
|---|---|
| Total de Produtos | Quantidade de produtos cadastrados |
| Total de Pedidos | Quantidade de pedidos no período |
| Tendência de Vendas | Comparativo de vendas |
| Receita | Valor total de receita |
| Mensagens | Quantidade de mensagens |
| Pedidos Concluídos | Pedidos finalizados com sucesso |

**Outros elementos:**
- **Pedidos recentes:** Lista dos últimos pedidos com status, cliente, valor e data.
- **Alertas de estoque crítico:** Produtos com estoque zerado ou abaixo do mínimo.
- **Banners de alerta:** Avisos importantes do sistema.
- **Feed de atividade recente:** Últimas ações realizadas no sistema.

### 2.2 Atividades Recentes

**Rota:** `/admin/activity`

Timeline de eventos operacionais com filtros:

- **Tipo de entidade:** Cotações, Compras, Transferências, Movimentações, Fornecedores, Produtos.
- **Severidade:** Info, Sucesso, Aviso, Perigo, Crítico.
- **Status:** Aberto, Concluído, Cancelado, Arquivado.
- **Período:** Hoje, 7 dias, 30 dias, Tudo, Período personalizado.

**Ação:** Exportar para CSV clicando no botão de exportação.

### 2.3 Alertas

**Rota:** `/admin/alertas`

Resumo de alertas de estoque organizados por severidade:

| Severidade | Significado |
|---|---|
| Crítico | Estoque zerado |
| Aviso | Estoque abaixo do mínimo |
| Info | Produtos que precisam de atenção |
| Excesso | Estoque acima do máximo |

Atualização automática a cada 5 minutos.

---

## 3. Pedidos

**Rota:** `/admin/orders`

### 3.1 Visualizando Pedidos

A tela mostra todos os pedidos em tempo real (Supabase Realtime). Um **som de notificação** toca quando um novo pedido chega.

**Filtros disponíveis:**
- Todos
- Novos (reservados)
- Em Preparo (confirmados)
- Finalizados
- Cancelados

**Informações exibidas por pedido:**
- Código do pedido (5 primeiros caracteres)
- Badge de status
- Nome e telefone do cliente
- Lista de itens com quantidades
- Valor total
- Forma de entrega (retirada/entrega/mesa)
- Forma de pagamento
- Cronômetro de reserva (quando aplicável)

### 3.2 Fluxo de um Pedido

```
Cliente faz pedido na loja pública
  → Pedido aparece com status "Reservado"
  → Estoque é reservado automaticamente
  → Você接受 o pedido (status: "Confirmado")
  → Prepara o pedido
  → Conclui o pedido (status: "Concluído")
  → Estoque é baixado definitivamente
  → Movimentação de estoque é registrada
  → Entrada no Livro Diário é gerada (se pagamento afeta caixa)
  → Pontos de fidelidade são concedidos (se aplicável)
```

### 3.3 Ações nos Pedidos

| Ação | Descrição |
|---|---|
| Aceitar/Preparar | Confirma o pedido e inicia o preparo |
| Concluir/Entregar | Finaliza o pedido, baixa estoque e gera lançamento no caixa |
| Cancelar | Cancela o pedido e devolve o estoque reservado |
| Estender Reserva | Aumenta o tempo de reserva do pedido |
| Abrir WhatsApp | Abre conversa com o cliente no WhatsApp |

### 3.4 Notificações por WhatsApp/SMS

O sistema pode enviar notificações ao cliente via OptmaSMSGate:

- Pedido preparado
- Pedido pronto para retirada
- Aviso de expiração da reserva
- Notificação de cancelamento

### 3.5 Cancelamento e Expiração

- **Cancelamento manual:** Você pode cancelar qualquer pedido pelo painel.
- **Expiração automática:** Pedidos reservados que não forem confirmados no tempo configurado são cancelados automaticamente.
- Ao cancelar, o estoque reservado é devolvido ao estoque disponível.

---

## 4. Loja Pública e Catálogo Online

### 4.1 Acessando a Loja Pública

A loja pública é acessível pelos clientes通过 URLs como:

```
/s/{slug-da-loja}
/loja/{slug-da-loja}
/cardapio/{slug-da-loja}
```

Também pode ser acessada via **QR Code** de mesa:

```
/q/{slug-da-loja}/{codigo-da-mesa}
/mesa/{slug-da-loja}/{codigo-da-mesa}
```

### 4.2 Funcionalidades do Catálogo

- **Visualização de produtos:** Cards com imagem, nome, preço e descrição.
- **Filtro por categoria:** Navegue pelas categorias para encontrar produtos.
- **Busca:** Pesquise produtos por nome.
- **Detalhe do produto:** Clique em um produto para ver informações completas.
- **Carrinho de compras:** Adicione itens, ajuste quantidades, remova itens.

### 4.3 Finalizando o Pedido (Checkout)

1. Revise os itens no carrinho.
2. Informe seu **nome**.
3. Selecione o **método de entrega** (retirada, entrega, mesa).
4. Selecione a **forma de pagamento** (PIX, dinheiro, etc.).
5. Confirme o pedido.
6. Para PIX, o sistema exibirá o código para cópia.
7. O pedido é enviado ao estabelecimento via WhatsApp.

### 4.4 Configuração da Loja Pública

Para que a loja pública funcione, o gestor deve configurar:

| Configuração | Onde |
|---|---|
| Loja pública ativa | Configurações > Dados da Loja |
| Catálogo público ativo | Configurações > Comercial |
| Local de venda pública | Configurações > Comercial |
| Formas de pagamento públicas | Configurações > Pagamento |
| Formas de entrega públicas | Configurações > Entrega |
| Tempo de reserva | Configurações > Pedido Online |
| Contatos da loja | Configurações > Dados da Loja > Contatos |

---

## 5. Produtos

**Rota:** `/admin/products`

### 5.1 Listando Produtos

A tela exibe uma tabela com todos os produtos:

| Coluna | Descrição |
|---|---|
| Imagem | Foto do produto |
| Nome | Nome do produto |
| Categoria | Categoria vinculada |
| Estoque | Quantidade em estoque |
| Preço | Preço de venda |
| Status | Ativo/Inativo |
| Ações | Botões de ação |

**Cards de estatísticas no topo:**
- Total de produtos
- Estoque zero
- Estoque baixo
- Estoque para atenção
- Excesso de estoque
- Recomendação de compra
- Recomendação de transferência

### 5.2 Filtrando e Buscando

**Filtros disponíveis:**
- Busca por nome
- Filtrar por categoria
- Filtrar por status de estoque
- Filtrar por ação recomendada (comprar/transferir)
- Filtrar por status (ativo/inativo)
- Agrupar por categoria

**Ordenação:** Clique no cabeçalho da coluna para ordenar.

**Exportação:** Botão para exportar a lista em CSV.

### 5.3 Criando um Produto

1. Clique em **Novo Produto**.
2. Preencha os dados:
   - Nome do produto
   - Descrição
   - Preço de venda
   - Categoria
   - Unidade de medida
   - Fotos (upload)
3. Configure o estoque:
   - Estoque mínimo
   - Estoque máximo
   - Estoque atual por local
4. Salve o produto.

### 5.4 Editando um Produto

1. Clique no ícone de editar na linha do produto.
2. Altere os dados necessários.
3. Salve as alterações.

### 5.5 Excluindo/Descontinuando um Produto

1. Clique no ícone de excluir na linha do produto.
2. Confirme a ação.
3. O produto será marcado como descontinuado (não é excluído permanentemente).

> **Nota:** A exclusão de produto é uma **ação sensível** que pode exigir PIN ou senha mestra, dependendo da configuração de segurança.

---

## 6. Categorias

**Rota:** `/admin/categories`

### 6.1 Gerenciando Categorias

**Visualizações:** Tabela ou cards (alterne pelo botão de visualização).

**Ações disponíveis:**
- **Criar nova categoria:** Clique em "Nova Categoria" e preencha nome, descrição e ordem de exibição.
- **Editar categoria:** Clique no ícone de editar.
- **Excluir categoria:** Clique no ícone de excluir e confirme.
- **Ver detalhe:** Visualize a categoria e seus produtos vinculados.

**Campos da categoria:**
- Nome
- Descrição
- Ordem de exibição (para controlar a ordem no catálogo)
- Status (ativa/inativa)

---

## 7. Estoque

### 7.1 Estoque por Local

**Rota:** `/admin/inventory`

Visualização multi-local do estoque. Para cada produto em cada local, o sistema exibe:

| Status | Significado |
|---|---|
| Sem Estoque | Estoque zerado |
| Crítico | Abaixo do mínimo |
| OK | Dentro dos limites |
| Excesso | Acima do máximo |
| Inativo | Produto inativo no local |

**Recomendações de ação:**
- **Comprar:** Produto precisa de reposição via compra.
- **Transferir:** Produto deve ser transferido de outro local.
- **Monitorar:** Acompanhar evolução.
- **Revisar excesso:** Estoque acima do máximo.
- **OK:** Nenhuma ação necessária.
- **Aguardar recebimento:** Compra ou transferência em trânsito.

**Exportação:** Botão para exportar em CSV.

### 7.2 Vida do Produto

**Rota:** `/admin/products/lifecycle` (seletor) → `/admin/products/{id}/life

cycle`

Visão 360° do produto incluindo:

- **Cards de resumo:** Estoque total, valor em estoque, movimentações.
- **Posição de estoque por local:** Tabela com saldos em cada local.
- **Histórico de movimentações:** Timeline de todas as entradas e saídas.
- **Timeline operacional:** Eventos importantes do produto.
- **Painel de custos de fornecedores:** Preços praticados por fornecedor.
- **Painel de cotações:** Cotações pendentes para o produto.
- **Painel de trânsito:** Estoques em transferência.

**Ações disponíveis:**
- Ajuste manual de estoque
- Baixa de estoque (zera estoque)
- Exportação CSV

### 7.3 Movimentação de Estoque

**Rota:** `/admin/stock-movements`

Histórico completo de movimentações de estoque.

**Tipos de movimentação:**

| Tipo | Descrição |
|---|---|
| Entrada | Compra, ajuste, transferência recebida |
| Saída | Venda, perda, transferência enviada |
| Reserva | Criação de pedido (estoque reservado) |
| Baixa (Pedido) | Conclusão de pedido (estoque consumido) |
| Cancelamento | Cancelamento de pedido (reserva devolvida) |
| Transferência | Movimentação entre locais |

**Filtros:** Tipo, período, produto, local.

**Paginação:** 50 registros por página.

**Exportação:** CSV e impressão.

---

## 8. Transferências

**Rota:** `/admin/transfers`

### 8.1 Criando uma Transferência

1. Clique em **Nova Transferência**.
2. Selecione o **local de origem**.
3. Selecione o **local de destino**.
4. Adicione produtos com quantidades.
5. Salve como rascunho ou envie diretamente.

### 8.2 Fluxo da Transferência

```
Rascunho → Pendente → Aprovada → Enviada → Recebida (ou Divergente)
```

| Status | Ação |
|---|---|
| Rascunho | Transferência em criação |
| Pendente | Aguardando aprovação |
| Aprovada | Autorizada para envio |
| Enviada | Produto em trânsito |
| Recebida | Produto recebido no destino |
| Divergente | Quantidade recebida diferente da enviada |
| Cancelada | Transferência cancelada |

### 8.3 Ações na Transferência

- **Aprovar:** Autoriza o envio.
- **Enviar:** Registra o envio do produto.
- **Receber:** Confirma o recebimento no destino.
- **Cancelar:** Cancela a transferência em qualquer etapa.

### 8.4 Sugestões de Transferência

O sistema pode sugerir transferências quando um local está com excesso de estoque e outro está com estoque baixo para o mesmo produto.

---

## 9. Compras

**Rota:** `/admin/stock/purchase-documents`

### 9.1 Criando um Documento de Compra

1. Clique em **Nova Compra**.
2. Selecione o **fornecedor**.
3. Informe o **número da nota fiscal**.
4. Informe a **data de emissão**.
5. Adicione produtos com **quantidades** e **custos unitários**.
6. Adicione observações se necessário.
7. Salve como rascunho.

### 9.2 Fluxo da Compra

```
Rascunho → Confirmada
```

| Status | Efeito |
|---|---|
| Rascunho | Compra em criação, sem impacto no estoque |
| Confirmada | Estoque aumentado, entrada registrada no Livro Diário |
| Cancelada | Compra cancelada (com motivo) |

### 9.3 Confirmando uma Compra

Ao confirmar:
- O estoque do produto aumenta no local de recebimento.
- Uma movimentação de entrada é registrada.
- Uma entrada é gerada no Livro Diário (se aplicável).

> **Nota:** A confirmação de compra é uma **ação sensível** que pode exigir verificação adicional.

### 9.4 Cancelando uma Compra

1. Selecione a compra a ser cancelada.
2. Informe o **motivo** do cancelamento.
3. Confirme a ação.

> **Nota:** O cancelamento de compra é uma **ação sensível**.

---

## 10. Cotações

**Rota:** `/admin/stock/quotations`

### 10.1 Criando uma Cotação

1. Clique em **Nova Cotação**.
2. Selecione o **fornecedor**.
3. Adicione produtos com quantidades desejadas.
4. Selecione o **canal de envio** (WhatsApp, e-mail, PDF, manual, outro).
5. Adicione observações.
6. Salve a cotação.

### 10.2 Fluxo da Cotação

```
Rascunho → Enviada → Respondida → Aprovada (ou Rejeitada)
```

| Status | Descrição |
|---|---|
| Rascunho | Cotação em criação |
| Enviada | Cotação enviada ao fornecedor |
| Respondida | Fornecedor respondeu com preços |
| Aprovada | Cotação aprovada (cria documento de compra) |
| Rejeitada | Cotação rejeitada |
| Cancelada | Cotação cancelada |

### 10.3 Ações na Cotação

| Ação | Descrição |
|---|---|
| Enviar | Abre WhatsApp/e-mail do fornecedor |
| Marcar como Respondida | Registra que o fornecedor respondeu |
| Aprovar | Cria um documento de compra automaticamente |
| Rejeitar | Marca como rejeitada |
| Cancelar | Cancela a cotação |
| Copiar | Duplica a cotação para outro fornecedor |

### 10.4 Informações do Fornecedor na Cotação

O sistema exibe automaticamente:
- Telefone do fornecedor
- E-mail do fornecedor
- Botão para abrir WhatsApp

---

## 11. Fornecedores

**Rota:** `/admin/suppliers`

### 11.1 Listando Fornecedores

- Busca por nome
- Filtro por status
- Botão para criar novo fornecedor

### 11.2 Criando um Fornecedor

1. Clique em **Novo Fornecedor**.
2. Preencha os dados:
   - Nome/Razão Social
   - CNPJ/CPF
   - Telefone
   - E-mail
   - WhatsApp
   - Endereço
3. Salve o fornecedor.

### 11.3 Detalhe do Fornecedor

**Rota:** `/admin/suppliers/{id}`

Visão completa do fornecedor com:

**Cards de resumo:**
- Total de compras
- Total de documentos
- Prazo médio de entrega
- Frequência de compras

**Abas:**
| Aba | Conteúdo |
|---|---|
| Documentos de Compra | Histórico de compras realizadas |
| Produtos Fornecidos | Lista de produtos que este fornecedor fornece |
| Evolução de Custos | Gráfico de evolução de preços |
| Contatos | Telefones, e-mails, WhatsApp |
| Timeline Operacional | Eventos importantes |

### 11.4 Vida do Fornecedor

**Rota:** `/admin/suppliers/{id}/lifecycle`

Visão 360° incluindo histórico de compras, cotações, produtos fornecidos, contatos e timeline.

---

## 12. Clientes

**Rota:** `/admin/customers`

### 12.1 Listando Clientes

A tela exibe todos os clientes com:

| Informação | Descrição |
|---|---|
| Nome | Nome do cliente |
| Origem | Admin, Loja pública, WhatsApp, QR/Mesa, Venda direta, Importado |
| Propriedade dos dados | Editável, Protegido, Misto |
| Total de pedidos | Quantidade de pedidos realizados |
| Total gasto | Valor total gasto |
| Nível de fidelidade | Tier do programa de fidelidade |

**Busca:** Pesquise por nome.

### 12.2 Criando um Cliente

1. Clique em **Novo Cliente**.
2. Preencha os dados:
   - Nome
   - Telefone
   - E-mail
   - Endereço
3. Salve o cliente.

### 12.3 Editando um Cliente

1. Clique no ícone de editar.
2. Altere os dados necessários.
3. Salve.

> **Nota:** Clientes originados de canais públicos (loja pública, WhatsApp) têm dados protegidos e edição limitada.

### 12.4 Vida do Cliente

**Rota:** `/admin/customers/{id}`

Visão 360° do cliente incluindo:

- Dados básicos (nome, telefone, e-mail)
- Origem e canal de aquisição
- Status de propriedade dos dados
- Indicador de proteção
- Histórico de pedidos
- Total gasto
- Saldo de pontos de fidelidade
- Nível de fidelidade
- Tags
- Endereço
- Consentimentos (LGPD)

---

## 13. Fidelidade

### 13.1 Configuração do Programa

**Rota:** `/admin/loyalty`

**Abas de configuração:**

| Aba | Conteúdo |
|---|---|
| Regras Principais | Configuração geral do programa |
| Categorias | Regras por categoria de produto |
| Níveis | Níveis/tiers do programa |
| Premios | Configuração de recompensas |
| Manual | Ajustes manuais de pontos |
| Legal | Termos e condições do programa |

**Configurações principais:**

| Campo | Descrição |
|---|---|
| Programa ativo | Ativa/desativa o programa |
| Pontos por unidade | Quantos pontos por R$ 1,00 gasto |
| Pedido mínimo | Valor mínimo para pontuar |
| Bônus de cadastro | Pontos ao se cadastrar |
| Bônus de aniversário | Pontos no aniversário |
| Cashback | Configuração de cashback |
| Validade dos pontos | Meses até expiração |
| Mínimo para resgate | Pontos mínimos para usar |
| Sistema de selos | Configuração de selos |

### 13.2 Fidelidade Avançada

**Rota:** `/admin/loyalty/advanced`

Gerenciamento avançado de regras:

**Regras de Pontos:**
- Código e nome da regra
- Evento gatilho
- Tipo de regra
- Modo e valor dos pontos
- Prioridade
- Empilhável (acumula com outras regras)

**Regras de Benefícios:**
- Código e nome
- Tipo de benefício
- Alvo (tier, tag, todos)
- Desconto (percentual ou valor)
- Pontos bônus
- Entrega gratuita
- Pedido mínimo
- Limite de usos (total e por cliente)

---

## 14. Marketing e Campanhas

**Rota:** `/admin/marketing`

### 14.1 Segmentos

**O que são:** Grupos de clientes com características em comum.

**Tipos de segmento:**

| Tipo | Descrição |
|---|---|
| Manual | Seleção manual de clientes |
| Tag | Clientes com tag específica |
| Nível de fidelidade | Clientes de um determinado tier |
| Comportamento | Baseado em ações dos clientes |
| Histórico de compra | Baseado em padrões de compra |
| Campanha | Clientes que interagiram com uma campanha |
| Personalizado | Regras customizadas |

**Ações:**
- Criar segmento
- Editar segmento
- Ativar/desativar
- Atualizar membros (refresh)

### 14.2 Campanhas

**Criando uma campanha:**

1. Clique em **Nova Campanha**.
2. Preencha:
   - **Nome** da campanha
   - **Tipo:** comunicação, promoção, benefício, reativação, aniversário, fidelidade, personalizado
   - **Segmento alvo:** selecione o segmento de clientes
   - **Canal:** WhatsApp, e-mail, SMS, in-app, manual, misto
   - **Mensagem:** escreva o texto com variáveis disponíveis
   - **Data de agendamento** (opcional)
3. Salve a campanha.

**Variáveis disponíveis na mensagem:**

| Variável | Substitui por |
|---|---|
| `{{customer_name}}` | Nome do cliente |
| `{{store_name}}` | Nome da loja |
| `{{current_date}}` | Data atual |

**Status da campanha:**

| Status | Descrição |
|---|---|
| Rascunho | Campanha em criação |
| Agendada | Programada para envio futuro |
| Ativa | Campanha em andamento |
| Pausada | Campanha pausada |
| Concluída | Campanha finalizada |
| Cancelada | Campanha cancelada |

### 14.3 Enviando uma Campanha

> **Importante:** O sistema **não envia campanhas automaticamente**. O envio é manual via WhatsApp.

**Fluxo:**

1. Acesse a campanha.
2. Clique em **Preparar Destinatários**.
3. Revise a lista de destinatários.
4. Para cada destinatário, clique em **Abrir WhatsApp**.
5. Envie a mensagem manualmente no WhatsApp.
6. Marque o destinatário como **Enviado**.

**Status dos destinatários:**

| Status | Descrição |
|---|---|
| Pronto | Sistema preparou o destinatário |
| Enviado | Lojista marcou como enviado manualmente |
| Entregue | Confirmado automaticamente (requer API oficial) |
| Lido | Confirmado automaticamente (requer API oficial) |

---

## 15. Livro Diário (Caixa)

**Rota:** `/admin/cashbook`

### 15.1 Visualizando o Livro Diário

A tela exibe:

- **Resumo:** Receitas, despesas e saldo.
- **Lista de lançamentos** com busca e filtros.

**Filtros:**
- Período (data inicial e final)
- Cliente
- Status (ativo, cancelado, todos)

### 15.2 Tipos de Lançamento

| Tipo | Descrição |
|---|---|
| Venda | Gerado automaticamente ao concluir pedido |
| Entrada manual | Lançamento de entrada criado manualmente |
| Saída manual | Lançamento de saída criado manualmente |
| Estorno | Estorno de um lançamento anterior |
| Ajuste | Ajuste manual no caixa |
| Transferência | Transferência entre contas/locais |

### 15.3 Criando um Lançamento Manual

1. Clique em **Novo Lançamento**.
2. Selecione a **direção** (entrada ou saída).
3. Preencha:
   - Descrição
   - Valor
   - Forma de pagamento
   - Observações
   - Data/hora
4. Salve o lançamento.

### 15.4 Status dos Lançamentos

| Status | Descrição |
|---|---|
| Confirmado | Lançamento válido e registrado |
| Pendente | Aguardando confirmação |
| Cancelado | Lançamento cancelado |
| Anulado | Lançamento anulado (estornado) |

> **Nota:** Lançamentos de venda gerados automaticamente têm edição limitada (apenas descrição).

---

## 16. Dashboard Comercial

**Rota:** `/admin/commercial-dashboard`

Análise de desempenho comercial por período.

### 16.1 Selecionando o Período

Use o seletor de datas para definir o período de análise. O padrão é o mês corrente.

### 16.2 Métricas Disponíveis

| Métrica | Descrição |
|---|---|
| Total de vendas | Valor total vendado no período |
| Total de pedidos | Quantidade de pedidos |
| Ticket médio | Valor médio por pedido |
| Pedidos concluídos | Pedidos finalizados com sucesso |
| Top produtos | Ranking de produtos mais vendidos |
| Vendas por canal | Desempenho por canal de venda |
| Estatísticas de clientes | Novos clientes, recorrentes |
| Métricas de fidelidade | Pontos concedidos, resgatados |
| Resumo do caixa | Entradas, saídas, saldo |

---

## 17. Configurações da Loja

**Rota:** `/admin/settings`

### 17.1 Abas de Configuração

| Aba | Conteúdo |
|---|---|
| Dados da Loja | Dados corporativos, endereço, contatos |
| Comercial | Regras comerciais, loja pública |
| Pedido Online | Configurações de pedidos online |
| Estoque | Regras de estoque, mínimos e máximos |
| Entrega | Métodos de entrega, pedido mínimo |
| Pagamento | Formas de pagamento |
| Documentos e Termos | Política de privacidade, termos de uso |
| Sistema | Configurações gerais do sistema |

### 17.2 Dados da Loja

**Sub-abas:**

**Dados Corporativos:**
- CNPJ/CPF
- Razão Social
- Nome Fantasia
- Tipo de estabelecimento

**Endereço:**
- CEP (preenchimento automático via ViaCEP)
- Rua
- Número
- Complemento
- Bairro
- Cidade
- UF

**Contatos:**
- E-mail
- Telefone
- WhatsApp
- Redes sociais
- Website

**Logo:** Upload do logotipo da loja.

**Slug da loja:** Endereço da loja pública (ex: `minhaloja` → `/s/minhaloja`).

### 17.3 Configurações Comerciais

- Regras de pedidos
- Valores mínimos por método de entrega
- Configurações da loja pública

### 17.4 Configurações de Pedido Online

- Tempo de reserva (minutos)
- Configurações de pré-pedido
- Regras de cancelamento automático

### 17.5 Configurações de Estoque

- Estoque mínimo global
- Estoque máximo global
- Senha de estoque (para operações sensíveis)

### 17.6 Configurações de Entrega

- Métodos de entrega disponíveis
- Pedido mínimo por método
- Raio de entrega (para entrega local)

### 17.7 Configurações de Pagamento

- Formas de pagamento habilitadas
- Indicador de afetação no caixa (gera lançamento automático)
- Configurações de PIX

### 17.8 Documentos e Termos

- Política de Privacidade (texto)
- Termos de Uso (texto)
- Política de Cookies (texto)
- E-mail e contato do DPO (Encarregado de Dados)
- Gerenciamento de consentimentos

---

## 18. Meu Perfil

**Rota:** `/admin/my-profile`

### 18.1 Editando seu Perfil

**Abas:**

| Aba | Campos |
|---|---|
| Identidade | Nome, apelido interno, CPF, data de nascimento, e-mail |
| Endereço | CEP, rua, número, complemento, bairro, cidade, estado |
| Informações Adicionais | Campos customizados (título, texto, sinalização sensível) |
| Solicitações de Alteração | Histórico de pedidos de alteração de cadastro |

### 18.2 Upload de Foto de Perfil

Clique na área de avatar para fazer upload de uma foto de perfil.

### 18.3 Solicitações de Alteração

Quando você altera dados protegidos, o sistema cria uma **solicitação de alteração** que precisa ser aprovada por um administrador.

**Status da solicitação:**

| Status | Descrição |
|---|---|
| Pendente | Aguardando análise |
| Aprovada | Alteração autorizada |
| Rejeitada | Alteração negada |

---

## 19. Horários de Funcionamento

**Rota:** `/admin/hours`

### 19.1 Configurando a Semana

Para cada dia da semana (Domingo a Sábado):
- Hora de abertura
- Hora de fechamento
- Toggle "Fechado" (para dias sem funcionamento)

### 19.2 Exceções de Horário

Para feriados ou dias especiais:
1. Adicione uma exceção.
2. Informe a data.
3. Marque como fechado ou defina horários especiais.
4. Informe o motivo.

### 19.3 Configurações Adicionais

- **Tolerância (minutos):** Margem de tolerância para atrasos.
- **Minutos para pré-pedido:** Tempo mínimo de antecedência para pedidos.

---

## 20. Gerenciamento de Usuários

**Rota:** `/admin/users`

> **Permissão necessária:** `users.view` para visualizar, `users.manage` para gerenciar.

### 20.1 Listando Usuários

**Cards de estatísticas:**
- Total de usuários
- Ativos
- Inativos
- Suspensos

**Filtros:** Busca, papel (role), status.

**Informações por usuário:**
- Avatar/iniciais
- Nome e e-mail
- Badge de papel
- Badge de status
- Último horário de sessão

### 20.2 Criando um Usuário

1. Clique em **Novo Usuário**.
2. Preencha:
   - Nome
   - E-mail
   - Papel (role)
3. Envie o convite.
4. O usuário receberá um e-mail de convite.

### 20.3 Editando um Usuário

1. Clique no usuário.
2. Altere os dados necessários.
3. Salve.

### 20.4 Alterando Papel e Status

- **Papel:** Altere o papel do usuário (Proprietário, Admin, Gerente, etc.).
- **Status:** Alterne entre Ativo, Inativo e Suspenso.

### 20.5 Papéis Personalizados

- Crie papéis personalizados com permissões específicas.
- Atribua papéis personalizados a membros.
- Remova papéis personalizados.

### 20.6 Solicitações de Alteração de Cadastro

Na aba "Solicitações Cadastrais":
- Visualize pedidos de alteração de dados.
- Aprove ou rejeite cada solicitação.
- Veja os detalhes da alteração (valor anterior → valor novo).

### 20.7 Convites

- Envie convites por e-mail.
- Acompanhe o status do convite.
- Reenvie ou cancele convites pendentes.

---

## 21. Segurança e Permissões

**Rota:** `/admin/security`

> **Permissão necessária:** `security.view` para visualizar, `security.manage` para gerenciar.

### 21.1 Configurações de Segurança

| Configuração | Descrição |
|---|---|
| Tentativas falhas de PIN | Número máximo de tentativas incorretas |
| Validade do token | Tempo de expiração do token |
| Máximo de tentativas de token | Limite de tentativas |
| Timeout de sessão inativa | Tempo para encerrar sessão por inatividade |
| Senha mestra | Gerenciamento da senha mestra |

### 21.2 Registro de Segurança (Logs)

Visualize logs de auditoria com filtros:
- Tipo de ação
- Período
- Usuário

Cada log inclui:
- Data/hora
- Descrição da ação
- Usuário/membro
- Detalhes (valores anteriores/novos)
- IP/dispositivo

### 21.3 Senhas e Acesso

**Gerenciamento de PIN:**
- Criar/atualizar PIN
- Validar PIN
- Desbloquear PIN

**Senha mestra:** Resetar a senha mestra.

**Senha de login:** Alterar a senha de acesso ao sistema.

### 21.4 Perfis de Permissão (Templates)

Visualize e edite as permissões padrão para cada papel:

| Papel | Descrição |
|---|---|
| Proprietário | Acesso total |
| Admin | Acesso administrativo |
| Gerente | Gerente/supervisor |
| Estoque | Operador de estoque |
| Caixa | Operador de caixa |
| Vendas | Equipe de vendas |
| Equipe | Membro geral |
| Visualizador | Somente leitura |

Para cada papel, você pode configurar permissões em 14 módulos:
Dashboard, Relatórios, Produtos, Estoque, Compras, Fornecedores, Pedidos, Livro Diário, Clientes, Marketing, Fidelidade, Usuários, Segurança, Configurações.

### 21.5 Permissões Individuais

- Visualize permissões efetivas de cada membro.
- Aplique overrides individuais (permissões diferentes do padrão do papel).
- Gerencie permissões por membro.

### 21.6 Funções Personalizadas

- Crie funções personalizadas com permissões específicas.
- Defina a função base (herança).
- Configure permissões e ações sensíveis.
- Atribua funções personalizadas a membros.

### 21.7 Ações Sensíveis

Ações de alto risco que exigem verificação adicional:

| Ação | Descrição |
|---|---|
| Exclusão de produto | Exclusão/descontinuação de produto |
| Ajuste de estoque | Ajuste manual de quantidades |
| Cancelamento de compra | Cancelamento de documento de compra |
| Alteração de papel | Mudança de papel de usuário |
| Alteração de status | Mudança de status de usuário |
| Ver dados sensíveis | Visualização de dados sensíveis |
| Gerenciar dados sensíveis | Alteração de dados sensíveis |

**Níveis de requisito:**

| Requisito | Descrição |
|---|---|
| Nenhum | Sem verificação adicional |
| PIN | Requer PIN |
| Senha mestra | Requer senha mestra |
| PIN ou senha mestra | Uma das duas opções |
| Aprovação do proprietário | Requer aprovação do owner |
| Token | Requer token interno |
| PIN + token | Ambos necessários |

### 21.8 Solicitações Cadastrais

Na aba "Solicitações Cadastrais":
- Visualize pedidos de alteração de cadastro de outros usuários.
- Aprove ou rejeite cada solicitação.
- Veja os detalhes da alteração.

---

## 22. Relatórios

**Rota:** `/admin/reports`

> **Permissão necessária:** `reports.view`

### 22.1 Relatórios Disponíveis

| Relatório | Status |
|---|---|
| Movimentações de Estoque | Disponível |
| Relatório de Vendas | Em breve |
| Produtos Mais Vendidos | Em breve |
| Base de Clientes | Em breve |

### 22.2 Imprimindo Relatórios

Clique no botão de impressão no card do relatório para gerar uma versão para impressão.

---

## 23. Atividades Recentes e Alertas

### 23.1 Atividades Recentes

**Rota:** `/admin/activity`

Timeline operacional com filtros por:
- Entidade (Cotações, Compras, Transferências, etc.)
- Severidade (Info, Sucesso, Aviso, Perigo, Crítico)
- Status (Aberto, Concluído, Cancelado, Arquivado)
- Período (Hoje, 7 dias, 30 dias, Tudo, Personalizado)

**Exportação:** CSV disponível.

### 23.2 Alertas

**Rota:** `/admin/alerts`

Resumo de alertas de estoque por severidade:
- **Crítico:** Estoque zerado
- **Aviso:** Estoque abaixo do mínimo
- **Info:** Atenção necessária
- **Excesso:** Estoque acima do máximo

Atualização automática a cada 5 minutos.

---

## 24. Suporte e Documentação

### 24.1 Termos Legais

**Rota:** `/admin/legal`

Visualize os termos de uso e política de privacidade da loja.

### 24.2 FAQ

**Rota:** `/admin/faq`

Perguntas frequentes sobre o uso do sistema.

### 24.3 Documentação

**Rota:** `/admin/docs`

Documentação completa do sistema integrada.

---

## 25. Boas Práticas Operacionais

### Pedidos
- Conferir pedidos reservados diariamente.
- Cancelar pedidos não atendidos pelo fluxo do painel.
- Concluir pedidos somente quando forem entregues/prontos.
- Monitorar o cronômetro de reserva para evitar expirações.

### Estoque
- Verificar alertas de estoque crítico regularmente.
- Manter estoque mínimo e máximo atualizados.
- Realizar inventários periódicos.
- Usar transferências para redistribuir estoque entre locais.

### Compras
- Registrar todas as compras no sistema.
- Confirmar compras somente após receiving.
- Manter fornecedores atualizados.

### Financeiro
- Conferir o Livro Diário ao final do dia.
- Registrar todas as entradas e saídas manuais.
- Reconciliar com o extrato bancário periodicamente.

### Marketing
- Atualizar segmentos antes de campanhas.
- Usar variáveis nas mensagens para personalização.
- Não prometer envio automático de WhatsApp sem integração oficial.

### Segurança
- Nunca compartilhar senhas ou PINs.
- Usar senhas fortes.
- Fazer logout ao finalizar a sessão.
- Revisar logs de segurança regularmente.

### Análise
- Usar o Dashboard Comercial para análise por período.
- Acompanhar métricas de vendas e ticket médio.
- Monitorar desempenho por canal de venda.

---

## 26. Perguntas Frequentes (FAQ)

### Como redefinir minha senha?
Acesse a página de login e clique em "Esqueci minha senha". Um e-mail de redefinição será enviado.

### Como adicionar um novo usuário?
Acesse Configurações > Usuários e clique em "Novo Usuário". Preencha os dados e envie o convite.

### Como configurar a loja pública?
Acesse Configurações e configure as abas Comercial, Pagamento e Entrega conforme necessário.

### O sistema envia WhatsApp automaticamente?
Não. O envio de WhatsApp é manual. O sistema prepara os destinatários e abre o WhatsApp para envio manual.

### Como cancelar um pedido?
No painel de Pedidos, clique no pedido e selecione "Cancelar". O estoque reservado será devolvido automaticamente.

### O que acontece quando o estoque fica zerado?
O sistema gera um alerta crítico. Você pode criar uma compra ou transferência para repor o estoque.

### Como alterar permissões de um usuário?
Acesse Segurança > Permissões Individuais, selecione o membro e configure as permissões desejadas.

### O que são ações sensíveis?
São operações de alto risco (exclusão de produto, ajuste de estoque, etc.) que exigem verificação adicional como PIN ou senha mestra.

### Como ver o histórico de ações de um usuário?
Acesse Segurança > Registro de Segurança para visualizar logs de auditoria.

### O Livro Diário faz conciliação bancária?
Não. O Livro Diário registra entradas e saídas, mas a conciliação bancária ainda não está disponível.

---

## Limitações Conhecidas

| Limitação | Descrição |
|---|---|
| Envio de WhatsApp | Manual, sem automação |
| Entregue/lido no WhatsApp | Não rastreado sem API oficial |
| Conciliação bancária | Não disponível |
| Fidelidade avançada | Consolidada parcialmente |
| QR Code por mesa | Geração/impressão em etapa futura |
| Relatórios em PDF | Serão tratados em etapa posterior |

---

## Referência de Rotas

| Módulo | Rota | Descrição |
|---|---|---|
| Dashboard | `/admin` | Painel operacional |
| Atividades | `/admin/activity` | Atividades recentes |
| Alertas | `/admin/alerts` | Alertas de estoque |
| Relatórios | `/admin/reports` | Relatórios do sistema |
| Pedidos | `/admin/orders` | Gestão de pedidos |
| Canais de Venda | `/admin/sales-channels` | Configuração de canais |
| Dashboard Comercial | `/admin/commercial-dashboard` | Análise comercial |
| Clientes | `/admin/customers` | Gestão de clientes |
| Fidelidade | `/admin/loyalty` | Programa de fidelidade |
| Fidelidade Avançada | `/admin/loyalty/advanced` | Regras avançadas |
| Marketing | `/admin/marketing` | Central de marketing |
| Livro Diário | `/admin/cashbook` | Caixa/diário |
| Produtos | `/admin/products` | Gestão de produtos |
| Categorias | `/admin/categories` | Gestão de categorias |
| Estoque | `/admin/inventory` | Estoque por local |
| Vida do Produto | `/admin/products/lifecycle` | Seletor de produto |
| Transferências | `/admin/transfers` | Transferências entre locais |
| Compras | `/admin/stock/purchase-documents` | Documentos de compra |
| Cotações | `/admin/stock/quotations` | Cotações a fornecedores |
| Fornecedores | `/admin/suppliers` | Gestão de fornecedores |
| Movimentações | `/admin/stock-movements` | Histórico de movimentações |
| Configurações | `/admin/settings` | Configurações da loja |
| Meu Perfil | `/admin/my-profile` | Perfil do usuário |
| Meu Histórico | `/admin/my-history` | Histórico de sessões |
| Horários | `/admin/hours` | Horário de funcionamento |
| Mensagens | `/admin/messages` | Configurações de SMS |
| Usuários | `/admin/users` | Gestão de usuários |
| Segurança | `/admin/security` | Segurança e permissões |
| Termos Legais | `/admin/legal` | Termos e condições |
| FAQ | `/admin/faq` | Perguntas frequentes |
| Documentação | `/admin/docs` | Documentação do sistema |

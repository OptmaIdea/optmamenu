# POS_9 — Modelo de vendas: slug, balcão, mesa e canais externos

## Status

Decisão funcional registrada.

## Contexto

Durante a validação de venda direta/PDV, foi observado que a tela `Pedidos` não deve virar uma listagem genérica de vendas.

A tela `Pedidos` nasceu com uma função operacional clara: exibir pedidos que chegam, principalmente via loja pública/slug, para que a loja aceite, prepare, entregue ou cancele sem deixar cliente sem atendimento.

## Regra principal

Separar conceitos:

```txt
Pedidos = fila operacional de atendimento
Vendas = registro comercial/financeiro concluído ou histórico
PDV = venda balcão rápida
Mesa = consumo/comanda em andamento
Dashboard comercial = análise e histórico consolidado
```

## Situação 1 — Pedido via slug / catálogo online

### Descrição

Cliente faz pedido pelo catálogo online usando a loja pública por slug.

Exemplo:

```txt
cliente acessa catálogo público -> escolhe itens -> envia pedido -> loja recebe para preparar/enviar
```

### Característica

Esse fluxo exige atenção operacional porque há cliente aguardando atendimento.

### Status esperado

Pode passar por estados como:

- reservado / novo;
- confirmado;
- em preparo;
- pronto;
- entregue/concluído;
- cancelado.

### Tela principal

Deve aparecer na tela:

- `Pedidos`.

### Objetivo da tela

A tela `Pedidos` deve proteger a operação para que pedidos recebidos não fiquem sem resposta.

### Prioridade atual

Alta.

## Situação 2 — Venda PDV balcão

### Descrição

Cliente pede no balcão, paga/retira e vai embora.

Exemplo:

```txt
cliente chega -> pede item -> operador registra no PDV -> baixa estoque -> venda concluída
```

### Característica

O ciclo nasce e termina rápido.

Não precisa ficar na fila de atendimento, pois não há etapa posterior de preparo/entrega pendente.

### Status esperado

Normalmente já nasce como:

- concluída.

### Tela principal

Deve ser registrada em:

- `Venda direta` / PDV.

### Histórico/análise

Deve aparecer em:

- Dashboard comercial;
- relatórios de vendas;
- Vida do Cliente quando houver cliente vinculado;
- Vida do Cliente de balcão quando for venda operacional de balcão.

### Regra de telefone

Telefone é opcional.

Se o cliente quiser participar de promoções, fidelidade, campanhas ou benefícios, deve se cadastrar e conceder permissões.

### Prioridade atual

Alta.

## Situação 2.1 — Venda de mesa / comanda

### Descrição

Cliente consome na mesa e paga depois.

Exemplo:

```txt
mesa abre consumo -> adiciona itens -> cliente consome -> fecha conta -> paga
```

### Característica

Esse fluxo não é igual ao PDV balcão simples, porque pode ficar em aberto.

Pode envolver:

- mesa;
- comanda;
- consumo parcial;
- itens adicionados ao longo do tempo;
- pagamento posterior;
- cliente cadastrado;
- uso de pontos/fidelidade;
- divisão ou fechamento de conta futuramente.

### Tela principal futura

Deve ter fluxo próprio, por exemplo:

- `Mesas`;
- `Comandas`;
- ou aba própria dentro de vendas/PDV.

### Prioridade atual

Alta, após deixar PDV balcão e slug redondos.

## Situação 3 — Pedidos por outros canais

### Descrição

Pedidos recebidos por canais diversos, fora do slug, PDV e mesa.

Exemplos:

- e-mail;
- telefone;
- vendedor externo;
- colaborador de vendas;
- pedido verbal por intermediário;
- outros canais presenciais/alternativos.

### Decisão

Registrar como memória/futuro.

Não é foco agora.

### Observação importante

No futuro, o colaborador/vendedor externo poderá inserir pedidos manualmente, mas esse fluxo deve ser tratado com cuidado, permissões próprias e UX própria.

### Prioridade atual

Baixa / futura.

## Implicação para a tela Pedidos

A tela `Pedidos` deve manter a pegada de fila operacional.

Ela deve priorizar:

- pedidos via slug aguardando ação;
- pedidos em preparo;
- pedidos prontos/pendentes de entrega;
- eventualmente pedidos de mesa que exigem atendimento;
- alertas de tempo;
- comunicação com cliente;
- ações rápidas de aceitar/preparar/concluir/cancelar.

Ela não deve virar a principal listagem histórica de vendas concluídas.

## Implicação para vendas diretas concluídas

Vendas de PDV balcão podem aparecer em relatórios, dashboard e histórico, mas não devem poluir a fila operacional de pedidos atuais.

A visualização de vendas concluídas pode ficar em:

- Dashboard comercial;
- relatório/listagem de vendas;
- histórico do cliente;
- histórico do produto;
- livro diário/caixa;
- uma futura tela `Vendas` ou `Histórico de vendas`.

## Ajuste necessário após diagnóstico

O ajuste temporário que abriu `/admin/orders` em `Todos os Status` ajudou a identificar o comportamento, mas a regra funcional correta é:

- `Pedidos` deve abrir em `Pedidos Atuais`;
- vendas diretas concluídas devem ser consultadas em outra visão;
- se necessário, manter filtro `Todos os Status`, mas não como default operacional.

## Foco imediato

O foco agora deve ser deixar redondo:

1. venda balcão / PDV;
2. pedido via slug / catálogo online;
3. venda de mesa / comanda.

## Próximos passos recomendados

### PDV balcão

- validar Cliente de balcão operacional;
- validar baixa de estoque;
- validar caixa/livro diário;
- validar dashboard comercial;
- validar Vida do Cliente de balcão;
- decidir onde fica o histórico de vendas concluídas.

### Slug / catálogo online

- revisar fila de pedidos recebidos;
- garantir alertas/visibilidade;
- garantir que pedidos atuais não fiquem escondidos;
- revisar status e ações operacionais;
- garantir Realtime.

### Mesa / comanda

- desenhar fluxo próprio;
- decidir se usa pedido aberto, comanda ou entidade própria;
- definir fechamento e pagamento posterior;
- definir uso de pontos/fidelidade no fechamento.

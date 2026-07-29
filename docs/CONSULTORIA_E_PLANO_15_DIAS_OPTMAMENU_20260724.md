# Consultoria consolidada e plano de entrada em funcionamento do OptmaMenu

**Data:** 24/07/2026  
**Horizonte imediato:** 15 dias  
**Objetivo:** colocar o produto em funcionamento inicial com segurança, clareza
operacional e capacidade de evoluir de pequenos comércios locais para grupos com
matriz e unidades.

## 1. Síntese executiva

O OptmaMenu já ultrapassou a definição de “cardápio digital”. Hoje ele reúne:

- catálogo e loja pública por slug;
- pedidos online e atendimento pelo WhatsApp;
- PDV de balcão com precificação central;
- produtos, categorias, múltiplos locais de estoque e transferências;
- compras, cotações e Fornecedor 360°;
- Clientes 360°, fidelidade e comunicações manuais;
- Livro Diário, plano de contas, contas financeiras e fechamento;
- usuários, papéis, permissões, auditoria e Realtime;
- divergências de estoque e de fechamento tratáveis.

A decisão recomendada é posicionar o produto como:

> **Gestão comercial e operacional acessível para pequenos comércios, preparada
> para acompanhar o crescimento em múltiplas unidades.**

Isso evita dois erros:

1. subestimar o produto como “só cardápio”;
2. transformá-lo cedo demais em um ERP pesado de franquias.

Nos próximos 15 dias, o objetivo não é implementar todo o futuro. É obter um
**release inicial confiável**, usado diariamente por uma loja real, com os
principais fluxos fechados e uma arquitetura que não bloqueie a evolução.

## 2. Princípio de produto: simplicidade progressiva

O OptmaMenu deve trabalhar em três níveis, mas revelar apenas o necessário:

### Nível 1 — Comércio local

Para uma única loja, o usuário deve enxergar:

- minha loja;
- meus produtos e estoque;
- meus pedidos e PDV;
- meu caixa;
- meus clientes e fornecedores;
- minha equipe.

Nenhuma tela deve falar em tenant, holding, matriz ou consolidação se o cliente
possui apenas uma unidade.

### Nível 2 — Negócio com mais de uma unidade

Quando o cliente cria ou recebe acesso a mais de uma unidade:

- aparece o seletor de unidade;
- transferências entre unidades ficam disponíveis;
- o owner enxerga indicadores consolidados;
- gerentes e operadores continuam limitados às unidades autorizadas.

### Nível 3 — Grupo, matriz e franqueados

Evolução posterior:

- grupo empresarial;
- matriz, filial própria e franquia;
- políticas e catálogos herdáveis;
- consolidação financeira;
- comparação de desempenho;
- compartilhamento controlado de produtos, clientes e fornecedores;
- royalties, taxas e regras próprias de franquia.

Este nível deve ser preparado agora no desenho, mas não implementado por inteiro
antes do release inicial.

## 3. Arquitetura multiunidade recomendada

### 3.1. Correção conceitual importante

O documento anexado mistura `owner` com `tenant/grupo`. Isso funciona no exemplo
de um único proprietário, mas limita o futuro.

O modelo recomendado é:

```text
Usuário
  participa de
Grupo empresarial
  possui
Unidades de negócio (stores)
  possuem
Locais de estoque, caixas, clientes, pedidos e páginas públicas
```

O `owner` é um papel de usuário. O grupo empresarial é uma entidade do negócio.
Um grupo pode futuramente ter mais de um sócio/administrador; um mesmo usuário
pode participar de mais de um grupo.

### 3.2. O que manter

- `stores` continua sendo a fronteira operacional da unidade;
- `store_members` continua sendo a base do vínculo e das permissões;
- cada loja mantém caixa, clientes, pedidos, slug e configurações próprios;
- `stock_locations` continua representando locais dentro de uma unidade;
- transferências continuam como o fluxo auditável de deslocamento físico.

### 3.3. O que adicionar depois do release inicial

Uma camada mínima de grupo:

- `business_groups`;
- `business_group_members`;
- `stores.business_group_id`;
- tipo da unidade: `headquarters`, `branch`, `franchise`, `warehouse`,
  `virtual_unit`;
- permissões no nível do grupo, separadas das permissões locais;
- visão consolidada apenas por RPCs seguras.

### 3.4. Depósito central

Não há uma única representação correta para todos os casos.

- Se o depósito compra, recebe, transfere, tem equipe e responsabilidade própria,
  ele deve ser uma `store` do tipo `warehouse`.
- Se é apenas um cômodo ou local interno da mesma empresa/unidade, deve ser um
  `stock_location`.

Para Gelinhares, o depósito MAIN tende a ser uma unidade `warehouse`, porque
centraliza compras e abastece lojas distintas.

### 3.5. Isolamento de dados

No lançamento:

- clientes continuam isolados por loja;
- caixa e contas financeiras continuam por loja;
- slugs permanecem globalmente únicas;
- gerente local não vê outra loja;
- owner vê todas as lojas vinculadas.

Cadastro único de cliente no grupo deve ser uma fase posterior, com consentimento,
LGPD e tabela de vínculos por unidade.

## 4. Financeiro: avaliação dos anexos

### 4.1. Direção correta

É correta a separação entre:

- **Livro Diário:** operação diária e caixa físico;
- **Livro Caixa/Financeiro:** visão gerencial de todas as contas;
- **Contas financeiras:** gaveta, PIX, banco, cartão, recebíveis;
- **Conciliação:** comparação entre o que o sistema registrou e o que ocorreu na
  conta ou adquirente.

O fechamento corrigido em 24/07 já avançou nessa direção ao separar:

- fundo de abertura;
- movimento em dinheiro;
- esperado físico;
- contado;
- ocorrência de divergência.

### 4.2. Ajustes necessários no modelo proposto

Evitar usar `current_balance` como valor livremente editável ou como única fonte
da verdade. O saldo deve ser derivado de lançamentos imutáveis, com snapshot ou
cache apenas para desempenho.

Recomendações:

- `financial_accounts` pertence a uma unidade ou grupo de forma explícita;
- uma conta não deve depender de dois campos opcionais `store_id` e `owner_id`
  sem uma constraint de escopo;
- transferências financeiras devem produzir duas pernas ligadas por um mesmo
  identificador;
- lançamentos confirmados não devem ser editados destrutivamente: corrigir por
  estorno/reclassificação auditável;
- recebíveis de cartão precisam distinguir venda, taxa, parcela, data prevista e
  liquidação;
- importação OFX/CSV deve preservar o arquivo bruto e impedir duplicação por hash.

### 4.3. Ordem financeira recomendada

1. Estabilizar abertura e fechamento por dia.
2. Formalizar sessão/turno de caixa.
3. Vincular cada forma de pagamento a uma conta padrão.
4. Criar fila de conciliação dos lançamentos automáticos do PDV.
5. Conferir PIX e cartão por adquirente/conta.
6. Importar extrato OFX/CSV.
7. Sugerir correspondências e tratar diferenças.
8. Consolidar saldos do grupo.

Conciliação bancária completa não entra no horizonte de 15 dias. A fila de
pendências e a classificação correta dos lançamentos são mais importantes agora.

## 5. Precificação: avaliação da proposta por grupo

### 5.1. O que já funciona

O motor central atual já calcula:

- preço-base;
- preço por categoria;
- faixas por volume;
- quantidade combinada dentro do escopo configurado;
- mesma cotação na slug, PDV e finalização;
- origem da regra e desconto aplicado.

O exemplo real de 4 Acerola + 4 Abacaxi foi validado em R$ 26,00.

### 5.2. O que a proposta adiciona

`pricing_groups` resolve um caso válido: categorias visualmente diferentes que
participam da mesma quantidade de atacado.

Exemplo:

- “Picolé cremoso”;
- “Picolé cremoso zero lactose”;
- ambas contam para “Grupo Picolés Cremosos”.

### 5.3. Cuidados antes de implementar

- o banco atual ainda não possui `pricing_groups`;
- o frontend não pode voltar a calcular preços por conta própria;
- a regra deve entrar no motor central, não apenas em `useCartStore`;
- a precedência deve ser explícita:
  `produto > grupo > categoria > preço-base`, ou outra regra deliberada;
- toda cotação deve devolver a origem aplicada;
- pedido salvo deve preservar um snapshot da regra e do preço;
- mudanças de regra não podem recalcular vendas antigas.

### 5.4. Prioridade

Não é bloqueador do release inicial, pois o caso hoje usado está coberto. Deve
entrar após a comanda e a estabilização do caixa, a menos que um cliente real
dependa imediatamente de categorias cruzadas.

## 6. Loja pública e landing institucional

Existem duas experiências públicas diferentes:

### 6.1. Landing do OptmaMenu

Objetivo: vender o produto para o lojista.

Mensagem recomendada:

> Venda mais. Controle melhor. Cresça sem perder a simplicidade.

Blocos:

1. proposta de valor;
2. venda, estoque, financeiro e relacionamento;
3. “uma loja hoje, novas unidades amanhã”;
4. funcionamento em três passos;
5. CTA de cadastro;
6. segurança e permissões.

Não publicar ainda:

- preço sem plano comercial aprovado;
- “começar grátis” sem regra real de gratuidade;
- nota, quantidade de avaliações ou depoimentos inventados;
- nomes de clientes como prova social sem autorização;
- promessas de conciliação, franquia ou automação ainda não entregues.

### 6.2. Loja pública de cada comércio

Objetivo: converter o cliente final em pedido.

Prioridades:

1. status da loja e tempo/condição de atendimento;
2. busca;
3. categorias;
4. produtos com nome, foto, preço e regra aplicada;
5. carrinho sempre acessível;
6. retirada/entrega/mesa;
7. pagamento;
8. dados mínimos do cliente;
9. confirmação e acompanhamento por token;
10. WhatsApp real configurado pela loja.

Melhorias de UX recomendadas:

- cabeçalho mais compacto ao rolar;
- carrinho como barra inferior no mobile, mostrando itens e total;
- categorias “sticky” abaixo do cabeçalho;
- estado vazio específico para busca e categoria;
- produto indisponível visível sem permitir adição;
- resumo de entrega e mínimo antes do checkout;
- confirmação em tela cheia curta após enviar;
- nenhuma mensagem dizendo “em breve” quando o pedido já funciona;
- nenhum telefone fixo no código.

## 7. OptmaPDV: decisão de ícone

Entre os três PNGs:

- `optmapdv.png`: melhor fonte por possuir transparência e funcionar em qualquer
  tema;
- `optmapdv_clara.png`: útil para material sobre fundo branco;
- `optmapdv_escura.png`: útil para apresentação em fundo escuro.

Para o atalho/PWA, o texto “OptmaPDV” não deve fazer parte do ícone pequeno.
Ele perde legibilidade em 192×192.

Decisão aplicada:

- recorte quadrado do símbolo de comanda + carrinho;
- ícone transparente `192×192`;
- ícone transparente `512×512`;
- versão `maskable 512×512` com fundo claro e área segura;
- manifesto dedicado usando os arquivos `pdv-*`;
- cache do service worker versionado para atualizar atalhos instalados.

## 8. Roteiro de 15 dias

### Critério de entrada em funcionamento

Ao final, uma loja piloto deve conseguir:

1. entrar com usuário e função corretos;
2. cadastrar/ajustar catálogo;
3. vender pela slug;
4. vender pelo PDV;
5. tratar exceção de estoque;
6. acompanhar pedido;
7. registrar e fechar caixa;
8. encontrar a venda no produto, cliente e financeiro;
9. operar sem erro técnico exposto ao usuário;
10. recuperar-se de falha comum sem intervenção no banco.

### Dias 1 e 2 — Release candidate e mapa de risco

- congelar novas frentes grandes;
- consolidar checklist dos fluxos críticos;
- revisar erros recentes de produção;
- confirmar migrations GitHub × Supabase;
- conferir RLS, permissões e RPCs públicas;
- definir a loja piloto, usuários e aparelhos;
- separar bloqueador, importante e pós-lançamento.

**Saída:** release candidate identificado e roteiro de homologação.

### Dias 3 e 4 — Loja pública e pedido real

- revisar catálogo em celulares pequenos e médios;
- remover mensagens obsoletas;
- eliminar contatos fixos;
- validar retirada sem mínimo e entrega com mínimo;
- validar loja aberta, fechada e pré-abertura;
- validar WhatsApp, token público e retorno à slug;
- validar produto sem estoque e produto descontinuado;
- revisar acessibilidade básica e estados vazios.

**Saída:** pedido público completo e compreensível.

### Dias 5 e 6 — PDV e estoque

- instalar PWA com ícone OptmaPDV;
- validar leitura de código, busca e carrinho;
- validar preços simples e faixas;
- validar dinheiro/troco e formas digitais;
- validar venda com divergência confirmada;
- tratar a fila de divergências até resolução;
- validar idempotência em clique duplo e conexão instável.

**Saída:** venda de balcão homologada.

### Dias 7 e 8 — Financeiro e fechamento

- homologar abertura sugerida e editável;
- fechar dia sem divergência;
- fechar dia com falta e sobra;
- testar sangria e reforço;
- validar PIX/cartão;
- testar filtros por data operacional;
- revisar conta financeira e plano de contas padrão;
- documentar conciliação posterior sem bloquear o PDV.

**Saída:** caixa diário utilizável e auditável.

### Dias 9 e 10 — Usuários, permissões e auditoria

- owner, gerente, subgerente, estoquista e operador PDV;
- `view=false` oculta e bloqueia rota;
- `manage=false` mantém modo leitura;
- convite e primeiro acesso;
- troca de loja e vínculo correto;
- histórico de alterações;
- ações sensíveis e mensagens amigáveis;
- sessão expirada, logout e novo login.

**Saída:** equipe opera com acesso mínimo necessário.

### Dias 11 e 12 — Comanda digital MVP

Escopo mínimo:

- abrir comanda;
- adicionar itens em rodadas;
- identificar operador;
- enviar para `awaiting_payment`;
- localizar no caixa;
- receber e fechar;
- cancelar com motivo;
- preço pelo motor central;
- financeiro somente no recebimento.

Não incluir agora:

- divisão complexa;
- múltiplos pagamentos parciais;
- transferência e junção de mesas;
- impressão/KDS avançado.

**Saída:** fluxo básico de mesa separado de pedido online e PDV.

### Dia 13 — Resiliência e desempenho

- rede lenta/offline;
- refresh durante carrinho;
- múltiplas abas;
- Realtime;
- erros de chunk/deploy;
- imagens pesadas;
- consultas de tela inicial;
- duplicações por retry;
- logs e Advisors.

**Saída:** lista curta de riscos conhecidos e mitigados.

### Dia 14 — Operação assistida

- simular um turno completo;
- registrar todos os atritos do operador;
- corrigir apenas bloqueadores e mensagens;
- preparar dados, usuários, estoque e fundo do piloto;
- produzir manual rápido de uma página.

**Saída:** aceite operacional.

### Dia 15 — Entrada inicial

- backup/verificação de migrations;
- deploy final;
- teste de fumaça;
- início com uma loja e equipe limitada;
- janela de acompanhamento;
- registro estruturado de incidentes;
- plano de rollback de frontend;
- nenhuma alteração estrutural durante o turno.

**Saída:** OptmaMenu em funcionamento inicial controlado.

## 9. Backlog após os 15 dias

### P0 — imediatamente após estabilização

- fechamento por sessão/turno;
- fila de conciliação financeira do PDV;
- melhorias restantes da comanda;
- abertura formal de caixa;
- tratamento integrado das divergências;
- monitoramento de falhas e métricas de operação.

### P1 — robustez comercial

- configurações completas de Pedido Online;
- QR por mesa com geração e impressão;
- entrega por km;
- benefícios e descontos avançados;
- segmentos e campanhas com consentimento;
- relatórios operacionais e exportações prioritárias.

### P2 — grupo e múltiplas unidades

- `business_groups`;
- seletor e visão consolidada;
- depósito central como unidade;
- transferências interunidades;
- catálogo compartilhado com sobrescrita local;
- fornecedores globais com vínculo local;
- indicadores por unidade e grupo.

### P3 — financeiro avançado

- contas de grupo;
- cartão e recebíveis;
- importação OFX/CSV;
- conciliação sugerida;
- taxas bancárias;
- DRE/fluxo gerencial;
- consolidação por grupo.

### P4 — franquias

- matriz e franqueado;
- políticas obrigatórias e opcionais;
- catálogo/preço herdado;
- royalties e taxas;
- benchmarking anonimizado;
- governança e contratos.

### P5 — plataforma

- domínio customizado;
- integrações oficiais;
- n8n e automações;
- OTP próprio;
- fiscal;
- offline ampliado;
- migração futura para infraestrutura própria.

## 10. Decisões recomendadas

1. Não abrir conciliação bancária completa antes do lançamento.
2. Implementar comanda apenas no escopo MVP.
3. Preparar grupo empresarial no desenho, sem expor complexidade para uma loja.
4. Manter clientes isolados por loja nesta primeira etapa.
5. Tratar `store` como unidade operacional, não como grupo.
6. Não usar `owner_id` como substituto permanente de tenant.
7. Manter preço autoritativo no backend.
8. Manter o PDV rápido e conciliar classificações depois.
9. Não publicar prova social nem preços sem base real.
10. Usar a loja piloto como autoridade para priorização dos próximos 15 dias.

## 11. Indicadores do lançamento inicial

Medir diariamente:

- pedidos públicos criados/concluídos/cancelados;
- vendas PDV concluídas e falhas;
- divergências de estoque abertas e tempo de resolução;
- fechamentos concluídos e ocorrências;
- erros técnicos por fluxo;
- tempo médio de atendimento no PDV;
- pedidos duplicados evitados;
- diferença entre estoque registrado e contagem;
- usuários ativos e falhas de permissão;
- contatos de suporte por motivo.

## 12. Conclusão

O melhor caminho para o OptmaMenu não é escolher entre “pequeno comércio” e
“franquias”. É construir uma base em que a pequena loja seja a experiência
padrão e o grupo empresarial seja uma capacidade progressiva.

O produto já tem profundidade suficiente para um funcionamento inicial. O risco
agora não é falta de módulos; é dispersão. O ciclo de 15 dias deve fechar os
fluxos reais, corrigir inconsistências, implantar a comanda mínima e colocar uma
operação piloto sob observação. Depois disso, multiunidade, financeiro avançado
e franquias podem crescer sobre dados e necessidades reais.

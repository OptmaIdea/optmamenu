# Documento mestre de retomada e homologação — OptmaMenu

**Data-base:** 20/08/2026  
**Repositório:** `OptmaIdea/optmamenu`  
**Branch de retomada:** `agent/homologacao-geral-20260820`  
**Supabase:** `lgkkfmqzaorrutuoqeax`  
**Vercel:** projeto `optmamenu`, equipe `optmaidea`

---

## 1. Objetivo deste documento

Este é o ponto oficial de retomada do OptmaMenu após a pausa dedicada à Fase 1 do OptmaSMSGate. Ele substitui a necessidade de reconstruir contexto a cada retomada e deve ser lido antes de iniciar novas frentes.

A meta desta rodada não é recomeçar o produto. É **homologar, reconciliar, testar e fechar lacunas sobre o que já existe**, deixando uma aplicação palpável, previsível, segura e próxima de uma entrega comercial real.

As decisões Q1–Q30 respondidas em 20/08/2026 são vinculantes para esta rodada. Quando este documento apresenta uma recomendação arquitetural, ela é identificada como recomendação e não substitui decisão do produto.

---

## 2. Legenda de maturidade

- ✅ **Implementado e já validado em cenário real/teste anterior.** Ainda pode entrar em regressão.
- 🟡 **Implementado/substancial, mas exige homologação sistemática.**
- 🟠 **Parcial: existe base técnica ou UI, porém há lacuna conhecida.**
- 🔴 **Bloqueador P0: não deve ser ignorado antes da homologação externa.**
- ⚪ **Planejado/deferido: não bloqueia a próxima entrega, mas fica preservado no roadmap.**

### Avaliação geral

O OptmaMenu está em estado de **pré-release funcional avançado**: já resolve uma parte relevante da operação de loja, porém ainda não deve ser descrito como produto final de produção antes da rodada de segurança, onboarding novo, testes de ponta a ponta, reconciliação financeira por contas e homologação de permissões.

---

## 3. Governança da retomada

### 3.1 Branch e PR

Decisão Q1 executada:

- a PR #7 foi encerrada sem descartar seu conteúdo;
- a nova branch `agent/homologacao-geral-20260820` foi criada a partir do estado mais recente da frente anterior;
- toda homologação geral deve seguir nessa branch até novo fechamento formal.

### 3.2 Ambiente de homologação

Decisão Q2:

- usar o **Supabase atual**;
- criar uma loja claramente identificada como homologação;
- não usar dados de clientes reais quando dados fictícios forem suficientes;
- dados de homologação ficam preservados temporariamente para regressão e só serão removidos quando os fluxos estiverem comprovadamente estáveis.

Decisão Q3:

- Gelinhares permanece, por enquanto, como massa operacional de teste;
- ao final, a intenção é preservar os cadastros úteis de categorias/produtos e remover dados operacionais de teste;
- será testado o reaproveitamento de categorias/produtos em outra loja/empresa do grupo.

**Recomendação:** não “mover” linhas com `store_id` de uma loja para outra. Implementar/importar por cópia/template, gerando novos IDs e mantendo preço, estoque e políticas próprios de cada loja. Uma futura camada de catálogo mestre de grupo pode reduzir duplicação sem misturar ownership.

---

## 4. Baseline técnico confirmado

### GitHub

Antes da nova branch, o head operacional era `4ca2a4ab0407e2286516b1fe58dd49f7307ff93c`, com a correção de tipagem da tabela de itens de transferência.

### Vercel

O preview associado a esse head está `READY`. A sequência imediatamente anterior teve alguns deploys com erro de TypeScript, mas os erros foram corrigidos por commits posteriores. Nesta rodada, qualquer novo head deverá ser novamente validado em build/deploy.

### Testes existentes

O projeto já possui Vitest e Testing Library. Há testes unitários para pricing, telefone, permissões, checkout validation, adapters/mappers e PermissionGuard. **Não há E2E Playwright consolidado ainda.**

Scripts existentes no `package.json`:

```text
npm run build
npm run lint
npm test
npm run test:watch
```

### Supabase — auditoria read-only de 20/08/2026

Resultados de integridade:

- slugs duplicadas: **0**;
- divergências entre `inventory_location_balances.reserved` e reservas ativas válidas: **0**;
- e-mails internos duplicados na mesma loja: **0**;
- telefones internos duplicados na mesma loja: **1 ocorrência a investigar**;
- Gelinhares: **32 lançamentos confirmados sem conta financeira atribuída**, saldo líquido **R$ 663,50**;
- saldo consolidado do cashbook da Gelinhares: **R$ 822,20**.

Distribuição já atribuída a contas na Gelinhares:

| Conta | Tipo | Saldo atual atribuído |
|---|---|---:|
| Caixa físico | caixa | -R$ 48,00 |
| Caixa Loja Centro | caixa | R$ 53,70 |
| InfinitePay | carteira Pix | R$ 65,00 |
| Recebíveis de cartão | recebíveis | R$ 88,00 |
| CEF | banco | R$ 0,00 |
| Carteira Pix | carteira Pix | R$ 0,00 |
| Maquininha | adquirente | R$ 0,00 |
| Cofre | cofre | R$ 0,00 |
| Proprietário | owner | R$ 0,00 |

O valor restante continua como **Não distribuído**, por decisão Q20, até classificação manual.

---

## 5. Bloqueadores P0 identificados

### P0.1 — Segurança das funções expostas do Supabase

O Security Advisor aponta muitas funções `SECURITY DEFINER` executáveis por `anon` e/ou `authenticated`.

Isso **não prova, isoladamente, uma vulnerabilidade**, porque algumas funções públicas precisam ser chamáveis pelo visitante e outras podem fazer autorização internamente. Porém, exige auditoria explícita antes da entrega externa.

Exemplos que merecem revisão prioritária por não serem naturalmente funções públicas anônimas:

- `admin_accept_public_order_safe`;
- `admin_finalize_public_order_with_payment`;
- `admin_mark_public_order_ready_safe`;
- `adjust_customer_loyalty_points_safe`;
- `complete_my_store_member_onboarding`;
- `create_pos_sale_safe`;
- `reverse_received_stock_transfer`;
- `reconcile_inventory_reservations`.

Funções naturalmente públicas, como catálogo/quote/criação de pedido por slug, precisam continuar públicas **somente se validarem rigorosamente slug, payload, preços, estoque, rate limit e campos retornados**.

Ação P0:

1. classificar cada RPC em `PUBLIC_ANON`, `AUTHENTICATED`, `INTERNAL/TRIGGER`;
2. revogar `EXECUTE` desnecessário;
3. revisar autorização interna de cada `SECURITY DEFINER`;
4. fixar `search_path` em funções sensíveis;
5. criar regressão automatizada de grants/RLS.

Security Advisor também aponta:

- `customer_credentials` com RLS habilitado e sem policy — aceitável apenas se acesso direto estiver completamente revogado e ocorrer por fronteira segura; precisa ser comprovado;
- `order_message_events` com RLS habilitado e sem policy;
- `reserved_store_slugs` com RLS habilitado e sem policy;
- leaked password protection do Supabase Auth atualmente desabilitada.

### P0.2 — Autenticação do cliente

Já existem scaffolds de `customer_credentials`, `customer_sessions`, `customer_otps` e RPCs de senha/OTP. Eles **não devem ser promovidos a login definitivo sem revisão de segurança**.

A área logada do cliente é próxima grande frente e a decisão é **senha + OTP via OptmaSMSGate**.

### P0.3 — Homologação multi-tenant

Todo fluxo que aceita `store_id`, `member_id`, `order_id`, `customer_id`, `transfer_id` ou entidade equivalente precisa ser testado contra troca maliciosa de ID entre lojas.

Critério: usuário de Loja A nunca pode ler, alterar, finalizar, transferir, pontuar ou auditar dados de Loja B sem membership/autorização prevista.

---

## 6. Performance e dívida estrutural do banco

O Performance Advisor aponta três grupos importantes:

1. **foreign keys sem índices de apoio** em tabelas operacionais (incluindo cashbook, orders, products, inventory, transfers, loyalty e fornecedores);
2. políticas RLS com chamadas como `auth.uid()` reavaliadas por linha (`auth_rls_initplan`);
3. múltiplas policies permissivas sobre a mesma tabela/ação, com destaque para áreas centrais como reservas, produtos, lojas e operações.

Também existem índices duplicados e índices marcados como não usados.

**Prioridade:** P1/P2, após segurança/correção. Não remover índices “não usados” automaticamente: a massa atual de homologação não representa tráfego real.

---

# 7. Estado por domínio solicitado

## 7.2a — Cadastro de nova loja, signup e onboarding

**Estado: 🟠 parcial.**

Já existe:

- formulário público de signup PF/PJ;
- verificação prévia de identidade/e-mail (`check_signup_availability`);
- `supabase.auth.signUp`;
- confirmação de e-mail com callback;
- tela de criação de loja;
- base de configuração da loja e slug;
- RPC `validate_store_slug` existente no banco.

Lacunas conhecidas:

- o fluxo atual de `CreateStore` ainda não segue exatamente o Q4;
- slug é sugerida localmente, mas o onboarding não apresenta ainda o fluxo completo “validar → detectar ocupada → sugerir alternativa → usuário aprovar”;
- após criação atual há rota histórica para `/pos`; o objetivo é finalizar onboarding, primeiro local e então `/admin`;
- logo da empresa e logo da loja pública/slug precisam virar conceitos separados;
- faltam todos os e-mails transacionais do Q5 como conjunto de produto;
- fluxo de encerramento/inativação/exclusão do Q6 não está fechado;
- planos pagos/benefícios ficam fora desta rodada.

### Decisão de encerramento Q6

- bloqueio/inativação reversível: 10 dias;
- entre 10 e 20 dias, se não reativada, enviar aviso de exclusão e recomendar backup;
- exclusão definitiva após o prazo e somente respeitando retenções legais/fiscais.

**Observação:** o e-mail de despedida solicitado deve ser preparado agora, mas o envio definitivo precisa acompanhar o estado real do fluxo de encerramento. Não enviar mensagem dizendo “dados excluídos” antes da exclusão efetiva.

## 7.2b — Usuários, papéis, permissões e área particular

**Estado: 🟡 substancial, requer homologação.**

Já existe:

- store membership;
- papéis atuais;
- permissões por módulo/ação;
- `view=false` como porteira de rota/menu;
- `manage=false` como leitura em telas já saneadas;
- custom roles e overrides individuais;
- convites;
- bloqueio/status de membro;
- onboarding de membro;
- histórico/ocorrências e solicitações de alteração de perfil;
- dados como alias, cargo, departamento, endereço, telefone e avatar;
- suporte existente a alguns links sociais.

Decisões:

- papéis atuais permanecem por enquanto;
- template do papel fornece padrão e overrides individuais podem acrescentar/remover;
- proprietário e usuários com poder específico aprovam alterações sensíveis;
- atalhos da Home devem respeitar permissão/papel.

Pendências:

- padronizar spinner/loading;
- padronizar 403/Área não permitida e retorno para Home;
- logout deve retornar a `/admin` e não preservar menus expandidos da sessão anterior;
- revisar todas as rotas/atalhos contra permission catalog;
- validar unicidade de e-mail e telefone dentro da loja;
- auditoria atual detectou 1 telefone repetido em membership;
- ampliar perfil com redes fixas comuns + site pessoal + 2 campos livres;
- preferências de notificação;
- testar solicitação/aprovação de alteração;
- validar comportamento em tablet.

### Autenticação interna — recomendação para Q13

**Usar Supabase Auth como identidade e sessão dos funcionários. Não criar armazenamento próprio de senha.**

O Supabase Auth não representa sobrecarga indevida para esse cenário; é exatamente a camada que deve cuidar de senha, sessão, refresh e recuperação. O OptmaSMSGate entra como:

- validação do celular no onboarding/invite;
- OTP de step-up/MFA em ações sensíveis;
- recuperação/validação adicional conforme regra futura.

O membership continua por loja. Um mesmo `auth.user` pode pertencer a várias lojas sem duplicar identidade.

### Dados de saúde de funcionário

Tipo sanguíneo e alergias são dados sensíveis. A recomendação é **não coletá-los por padrão nesta rodada**. Se houver finalidade real de segurança ocupacional, devem ficar em área separada, acesso mínimo, justificativa, retenção e auditoria específicas — nunca simplesmente em “observações”.

## 7.2c — Estoque, produtos, categorias, fornecedores e compras

**Estado: 🟡 muito substancial.**

Já existe:

- categorias/produtos;
- estoque global e por local;
- estoque mínimo/máximo;
- movimentos;
- ajustes e contagem física;
- reservas;
- transferências em lote/manual;
- divergências;
- compras e documentos de entrada;
- cotações;
- Fornecedor 360º;
- Vida do Produto;
- regras de precificação e grupos combinados;
- catálogo público usando local de estoque vinculado à slug;
- reserva mínima presencial/teto online/baixo estoque;
- publicação por produto na slug.

Correções anteriores já validadas:

- reservas órfãs foram reconciliadas e a auditoria atual retornou 0 divergências;
- estoque público deixou de usar saldo global indevidamente;
- quantidade exata pública aparece apenas quando o produto está em baixo estoque, conforme decisão.

Pendências importantes:

- editar quantidade e remover/adicionar item em transferência ainda em rascunho;
- preservar filtros ao abrir detalhe e voltar;
- esclarecer/corrigir “Enviadas por este local” versus “Recebidas neste local”;
- retestar cancelamento, devolução, estorno e divergências;
- concorrência entre dois operadores;
- preço/snapshot/regra aplicada precisa ser rastreável;
- import/bootstrap de categorias, produtos, fornecedores e estoque inicial;
- testar reaproveitamento de catálogo entre lojas via clone/import, sem reassinar `store_id`.

## 7.2d — Comercial, clientes e canais de venda

**Estado: 🟠 parcial/substancial.**

Já existe:

- clientes 360º/administrativos;
- origem/data ownership/editabilidade;
- pedidos públicos;
- PDV;
- vendas diretas;
- mesa/QR;
- canais comerciais;
- snapshots comerciais em pedido/venda;
- dashboard comercial inicial.

Lacunas:

- modelo `customers` possui `person_type`, mas o cadastro PJ precisa ser homologado/expandido; atualmente há campo `cpf`, não um modelo completo de CNPJ/razão social/inscrição para PJ;
- criar cliente genérico `Consumidor Final` por loja;
- garantir que nome/CPF/CNPJ/telefone/endereço informados no PDV sem cadastro fiquem no snapshot da venda e não criem cliente;
- cliente só é criado quando ação de cadastro é explícita;
- cadastro por slug exige vontade do cliente + aceite dos termos;
- cadastro/logged area pública ainda é uma próxima grande entrega;
- canal B2B/empresa→empresa mais completo fica como frente premium/futura, embora venda para PJ deva ser suportada no modelo básico quando aplicável;
- documento auxiliar de venda deve ser claramente **não fiscal**.

## 7.2e — Efeitos de vendas, cancelamentos e devoluções

**Estado: 🟠 exige matriz de regressão.**

Já houve saneamento importante:

- pedidos concluídos em 31/07 que não geraram cashbook foram recompostos;
- fluxo financeiro de pedido foi ajustado para não ignorar pagamento confirmado na finalização;
- usuário confirmou posteriormente que os pedidos passaram a aparecer no cashbook.

Ainda precisa comprovar, por canal e forma de pagamento:

- reserva → consumo;
- baixa física;
- cashbook;
- origem comercial;
- cancelamento antes/depois da confirmação;
- devolução parcial/total;
- estorno de estoque;
- estorno financeiro idempotente;
- fidelidade/pontos se aplicável;
- não duplicação após retry/refresh.

## 7.2f — Configuração e apresentação da slug

**Estado: 🟡 substancial.**

Já existe:

- slug pública;
- catálogo;
- configuração de estoque online;
- carrossel de imagens/vídeos;
- links legais por slug;
- consentimento de cookies;
- contatos/redes públicos;
- regras por produto;
- mobile-first evoluído.

Decisão de identidade:

- logo da empresa é administrativa;
- logo da slug é pública/PWA;
- cada unidade/slug pode ter logo própria;
- cores, nome, redes, atendimento e futuramente domínio são responsabilidade/configuração do lojista.

Domínio customizado fica **deferido**; pode haver campo visual desabilitado/“em breve”, sem prometer provisionamento nesta rodada.

## 7.2g — Carrinho e checkout

**Estado: 🟡 substancial, exige E2E.**

Já existe:

- carrinho persistente;
- alterações de quantidade;
- promoções/precificação;
- checkout;
- entrega/retirada;
- endereço/CEP;
- meios de pagamento;
- troco;
- WhatsApp;
- acompanhamento público;
- validação autoritativa final de preço/estoque.

Matriz obrigatória:

- preço muda com carrinho aberto;
- produto fica sem estoque;
- baixa disponibilidade;
- remoção/publicação muda;
- minimum order entrega versus retirada;
- refresh/back/duplicação de aba;
- checkout simultâneo;
- rede lenta/offline/reconexão;
- celular/tablet/desktop e larguras intermediárias;
- teclado/acessibilidade;
- pagamento pendente versus confirmado.

## 7.2h — Financeiro

**Estado: 🟠 funcional, mas distribuição por conta é lacuna prioritária.**

Já existe:

- Livro Diário;
- entradas/saídas;
- pendentes;
- fechamento do dia;
- plano de contas;
- contas financeiras;
- transferências entre contas/base de conciliação;
- cashbook ligado a pedidos;
- estornos/ocorrências em partes do fluxo.

Prioridade Q19:

Criar `Financeiro → Saldos por conta` antes da área logada do cliente.

Deve mostrar no mínimo:

- caixa físico;
- banco/Pix;
- adquirente/maquininha;
- recebíveis de cartão;
- cofre;
- proprietário quando aplicável;
- **Não distribuído**.

Decisão Q20:

- os 32 lançamentos históricos atualmente não atribuídos não serão classificados automaticamente;
- devem aparecer em consulta própria;
- classificação será manual e auditada.

Testar ainda:

- plano de contas não oferecer receita em lançamento exclusivamente de despesa e vice-versa quando a natureza impedir;
- baixa/estorno;
- venda cancelada → evento/estorno financeiro;
- conciliação manual;
- cartão: venda → recebível → liquidação → banco;
- Pix: destino financeiro configurável;
- dinheiro: caixa/local correto.

Importação de extrato fica futura.

## 7.2i — Cadastro/login do cliente + OptmaSMSGate

**Estado: 🟠 scaffold de banco existente; entrega funcional ainda pendente.**

Decisões:

- senha + OTP;
- cliente da slug só se cadastra voluntariamente;
- termos/privacidade aceitos no cadastro;
- não vincular retroativamente pedidos de visitante ao novo cadastro;
- OTP será enviado/validado pelo OptmaSMSGate.

Existe base de `customer_credentials`, `customer_sessions`, `customer_otps` e RPCs de customer self, mas a auditoria de grants indica que essa fronteira precisa ser redesenhada/hardened antes da exposição.

**Recomendação:** tratar autenticação de cliente como boundary própria e não permitir acesso direto a credenciais. A escolha final entre Supabase Auth compartilhado e sessão customer própria deve priorizar isolamento por loja e segurança. Para funcionários, a decisão recomendada é Supabase Auth; para clientes, não promover a implementação custom atual sem threat model, rate limit, hashes fortes, tokens opacos e revisão de grants.

## 7.2j — Fidelidade e raspadinha

**Estado: 🟡 fidelidade existe; campanha de raspadinha não.**

Já existe base para:

- pontos;
- níveis/tiers;
- regras avançadas;
- benefícios;
- histórico/extrato;
- recompensas/resgate.

A rodada deve validar:

- ganho de pontos;
- estorno por cancelamento/devolução;
- expiração;
- saldo/extrato;
- troca/resgate;
- idempotência;
- regras por canal/categoria/produto quando aplicáveis.

Decisão Q18:

A **raspadinha digital será campanha promocional independente**, podendo conceder:

- pontos;
- cupom;
- produto;
- mensagem/prêmio.

Não acoplar obrigatoriamente a raspadinha ao ledger de fidelidade.

## 7.2k — Marketing e consultor de marketing

**Estado: 🟠 base de marketing existente, consultor final é frente posterior.**

Já existe Central de Marketing/campanhas/segmentos em estágio inicial. O comportamento histórico do WhatsApp é manual: o sistema prepara/abre mensagem; não deve fingir confirmação de entrega/leitura sem API oficial.

Ao final da homologação funcional, criar a etapa **Consultor de Marketing**, referenciando a documentação de segmentos, promoções, comunicações dirigidas e canais.

## 7.2l — Termos, documentação, suporte, ajuda e consentimentos

**Estado: 🟡 legal básico substancial; suporte/documentação operacional incompletos.**

Já existe:

- termos/políticas públicas;
- política de cookies;
- consentimento de cookies versionado;
- documentos legais por slug;
- rodapé de privacidade/transparência;
- canais institucionais.

Precisa concluir:

- termos/privacidade do cadastro de cliente;
- versões e aceite auditável;
- consentimentos por canal;
- encerramento/exclusão;
- central de ajuda/suporte;
- manual/FAQ administrativo sem substituir o futuro atendente virtual;
- documentos de impressão não fiscais.

---

# 8. Frentes transversais adicionais

## 8.1 Segurança e LGPD

- isolamento tenant;
- grants de RPC;
- RLS;
- storage/buckets;
- sessões;
- dados sensíveis;
- exportação/eliminação de dados;
- retenção legal;
- consentimentos versionados;
- rate limiting em signup/login/OTP/pedidos públicos;
- proteção contra enumeração de e-mails/telefones/slugs sensíveis.

## 8.2 Concorrência e idempotência

Testar:

- duas vendas simultâneas do último item;
- duas transferências usando o mesmo saldo;
- duplo clique;
- retry automático;
- refresh durante finalização;
- perda de rede após servidor confirmar mas antes do cliente receber resposta;
- eventos financeiros e de estoque com idempotency key.

## 8.3 Observabilidade

Meta de homologação:

- console sem erro relevante nos fluxos aprovados;
- toast traduz regra operacional, não UUID/SQL;
- logs distinguem erro esperado de falha inesperada;
- cada venda deve ser rastreável por origem/canal;
- pedido deve ser rastreável até estoque e cashbook.

## 8.4 Acessibilidade e responsividade

Matriz oficial Q26:

- Chrome/Chromium desktop;
- Firefox desktop;
- Android/Chrome;
- iPhone/Safari quando disponível;
- tablet Android;
- larguras intermediárias;
- Edge não obrigatório;
- iPad não obrigatório nesta rodada.

Navegação/layout será uma frente própria após os saneamentos, com prioridade forte para tablet e redução de densidade visual.

---

# 9. Offline operacional — decisão Q27

O OptmaMenu deverá suportar operação em conexão instável, inclusive PDV/estoque.

### Arquitetura recomendada

- PWA app shell cacheado;
- IndexedDB para dados operacionais mínimos;
- fila local de operações;
- `client_operation_id` único por mutação;
- estado `pending_sync` visível;
- sync/retry idempotente;
- resolução de conflito ao reconectar;
- logs de operação offline e sync.

### Limites obrigatórios

Não é tecnicamente seguro afirmar consistência forte de estoque entre **dois terminais simultaneamente offline** sem um coordenador local. Portanto:

- venda offline pode ser registrada como pendente local e sincronizada;
- estoque exibido offline é snapshot, não garantia global;
- fechamento financeiro, transferência e operações críticas devem ficar “pendentes de sincronização” até ACK do servidor;
- checkout público que exige preço/estoque autoritativo depende de conexão para concluir;
- no futuro, um hub/edge local pode ampliar a consistência em lojas rurais/instáveis.

Essa restrição deve ser explícita no produto, não escondida.

---

# 10. PWA, atendimento e canais

Decisão Q21:

- PWA shell do OptmaMenu administrativo;
- PWA próprio por slug, com identidade da loja.

O PWA da slug deverá permitir, progressivamente:

- nome/ícone/logo/cores da loja;
- catálogo;
- carrinho/pedidos;
- conta do cliente;
- fidelidade;
- notificações;
- atendimento virtual/humano.

Custom domain fica pós-lançamento; nesta rodada apenas placeholder desabilitado e desenho arquitetural.

Decisão Q22:

O assistente virtual deve responder **somente a partir de fontes autorizadas da loja** e de APIs do OptmaMenu. Não deve inventar preço, estoque, alergênicos, política, horário ou status de pedido. Deve oferecer escalonamento humano.

Decisão Q23 — consentimentos separados:

- SMS;
- WhatsApp;
- push/web push;
- e-mail;
- Telegram/outros no futuro;
- comunicação operacional separada de marketing.

Decisão Q24 — alerta de novo pedido:

- visual persistente;
- som configurável;
- push opcional;
- modo operador em celular/tablet;
- futura tela dedicada/TV para fila de pedidos.

---

# 11. Importação, bootstrap e impressão

Decisão Q29: incluir agora.

Importação inicial deve cobrir, por etapas:

- categorias;
- produtos;
- fornecedores;
- clientes;
- estoque inicial;
- regras essenciais quando seguro.

Regras:

- preview antes de aplicar;
- validação de linhas;
- relatório de erros;
- idempotência/chave externa opcional;
- nunca sobrescrever silenciosamente;
- import deve obedecer `store_id` e permissões.

### PDF/Impressão

Primeira opção recomendada:

- templates HTML/CSS próprios de impressão;
- `@media print`;
- `window.print()`/Salvar como PDF do navegador.

É gratuito, leve e mantém o layout sob controle. Bibliotecas de PDF entram apenas se precisarmos gerar binário determinístico sem diálogo do navegador.

---

# 12. E-mails transacionais obrigatórios

Q5 definiu todos nesta rodada:

1. confirmação de e-mail/auth;
2. boas-vindas após ativação/onboarding;
3. convite de usuário;
4. alteração de e-mail;
5. redefinição de senha;
6. aviso de alteração sensível de segurança;
7. solicitação de encerramento/inativação;
8. lembrete entre D+10 e D+20 com orientação de backup/reativação;
9. despedida/confirmação quando a exclusão definitiva for efetivamente processada.

Templates devem ser versionados, responsivos e testáveis em ambiente de homologação.

---

# 13. Roadmap preservado — não esquecer

Itens conhecidos que podem ficar para depois sem desaparecer:

- domínio customizado e provisionamento;
- templates profissionais pagos por slug;
- fiscal NF-e/NFC-e/DANFE;
- importação de extrato bancário;
- integrações oficiais de WhatsApp com delivery/read status;
- Telegram/outro mensageiro;
- app/wrapper nativo se houver vantagem comercial;
- grupo/franquia com consolidação avançada;
- catálogo mestre de grupo;
- B2B/pedidos empresariais avançados/premium;
- avaliações reais e moderação;
- rankings reais (mais vendidos/recomprados/favoritos) calculados no backend;
- BI avançado;
- integração n8n/automação;
- servidor/SQL próprio no futuro;
- módulo fiscal completo;
- geração/impressão administrativa de QR por mesa;
- taxa de entrega por km/meios de transporte;
- fidelidade/campanhas adicionais;
- Consultor de Marketing.

---

# 14. Ordem recomendada da homologação

## H0 — Baseline e segurança

- alinhar branch/PR/documentação;
- rodar test/build/lint;
- auditar grants/RLS;
- comparar migrations repo × Supabase;
- corrigir blockers P0.

## H1 — Nova loja e onboarding completo

- signup com e-mail novo;
- confirmação;
- criação da loja;
- slug única + sugestão;
- identidade empresa × slug;
- primeiro local;
- `/admin`;
- templates de e-mail;
- import bootstrap.

## H2 — Usuários e permissões

- usuários/papéis/overrides;
- OTP interno;
- perfil/alterações;
- Home/atalhos;
- spinner/403/logout/menu;
- multi-tenant.

## H3 — Estoque e suprimentos

- categorias/produtos;
- fornecedor 360;
- compras/cotações;
- movimentos;
- transferências;
- cancelamentos/devoluções;
- pricing groups;
- concorrência e reservas.

## H4 — Comercial e efeitos da venda

- PF/PJ/Consumidor Final;
- PDV/venda direta/mesa/slug;
- snapshots;
- cancelamento/devolução;
- estoque + cashbook + origem comercial.

## H5 — Loja pública e carrinho

- configuração/media/layout;
- catálogo;
- carrinho;
- checkout;
- tracking;
- responsividade/acessibilidade;
- limites/rede lenta.

## H6 — Financeiro

- Saldos por conta;
- Não distribuído;
- classificação manual;
- plano de contas;
- baixa/estorno;
- fechamento;
- conciliação manual.

## H7 — Área logada do cliente + OptmaSMSGate

Somente após H0–H6 estarem sólidos o bastante para não construir identidade sobre fluxo operacional quebrado.

## H8 — Fidelidade + campanhas

- ledger;
- expiração;
- resgate;
- estorno;
- raspadinha como campanha independente.

## H9 — PWA/offline/assistente/canais

Construção incremental sobre os contratos já homologados.

## H10 — Homologação do parceiro e redesign de navegação

- critérios Q30;
- link público;
- limitações conhecidas;
- feedback externo;
- revisão de navegação/tablet/densidade visual.

---

# 15. Critério “pronto para parceiro” — Q30

Todos precisam estar verdadeiros:

- [ ] build/deploy sem erro;
- [ ] zero erro relevante de console nos fluxos homologados;
- [ ] testes automatizados críticos passando;
- [ ] cadastro completo de uma loja nova;
- [ ] estoque/comercial/financeiro reconciliados;
- [ ] permissões validadas por papéis;
- [ ] slug pública + carrinho + checkout validados em mobile e desktop;
- [ ] limitações conhecidas documentadas.

Não incluir funcionalidades deferidas nesse gate apenas para “engordar release”.

---

# 16. Regra de continuidade

Toda frente concluída deverá produzir pelo menos um destes registros:

- teste automatizado;
- checklist com evidência;
- migration versionada;
- documentação de decisão;
- relatório de homologação.

Nenhuma migration aplicada remotamente deve permanecer sem arquivo correspondente no Git. Nenhuma correção manual de dados deve virar regra implícita: se puder voltar a acontecer, precisa de prevenção, reconciliação ou teste.

Este documento deve ser atualizado sempre que uma decisão aqui passar de pendente para implementada/homologada.

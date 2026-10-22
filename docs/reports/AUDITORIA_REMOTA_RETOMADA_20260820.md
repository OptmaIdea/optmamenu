# Auditoria remota de retomada — GitHub, Vercel e Supabase

**Data:** 20/08/2026  
**Branch:** `agent/homologacao-geral-20260820`  
**Supabase:** `lgkkfmqzaorrutuoqeax`  
**Vercel:** `optmaidea/optmamenu`

Esta auditoria foi feita com consultas remotas e read-only. Nenhum dado operacional foi alterado.

---

## 1. GitHub

### Governança

- PR #7 estava aberta/mergeável, mas descrevia como bloqueio uma inconsistência de reservas que já havia sido saneada.
- Decisão de produto Q1 executada: PR #7 encerrada.
- Nova branch criada: `agent/homologacao-geral-20260820`.
- O conteúdo acumulado da frente anterior foi preservado; a mudança é de governança, não rollback.

### Testes

`package.json` já possui Vitest/Testing Library e scripts:

```text
npm test
npm run build
npm run lint
```

Não havia suíte Playwright consolidada na baseline auditada. O protocolo do Antigravity agora orienta instalação controlada e criação de E2E.

### Secrets

Busca por `SUPABASE_SERVICE_ROLE` encontrou scripts que referenciam variável de ambiente. Não foi encontrado literal `sb_secret_` na busca realizada.

Observação: `src/lib/supabase.ts` contém uma **publishable/anon key** de fallback no frontend. Uma anon/publishable key não é segredo de servidor e precisa ser protegida por RLS/grants corretos. Ainda assim, preferimos ambiente configurado explicitamente para reduzir ambiguidade entre ambientes.

### Migration drift — confirmado parcialmente

O banco remoto registra as migrations recentes:

- `20260801123553_storefront_inventory_location_and_online_availability`;
- `20260801141629_reconcile_reservations_and_backfill_completed_order_cashbook`;
- `20260801141735_fix_public_order_cashbook_completion_and_pending_receivables`;
- `20260801175630_normalize_transfer_insufficient_stock_message`.

As quatro **não existem no caminho versionado convencional** `supabase/migrations/<version>_<name>.sql` na branch auditada.

Isso confirma drift de reprodutibilidade para essas migrations. A auditoria completa de todas as versões deve ser executada no clone local pelo Antigravity com `supabase migration list`, porque o conector remoto não fornece listagem de diretório privada equivalente ao filesystem local.

**Severidade: P0 de governança/reprodutibilidade, não P0 de dado.** Não reconstruir SQL por adivinhação; recuperar a definição aplicada/documentação e versionar com fidelidade antes de novo push de schema.

---

## 2. Vercel

### Baseline anterior

O commit operacional anterior:

```text
4ca2a4ab0407e2286516b1fe58dd49f7307ff93c
fix(transfers): accept transfer item summary rows
```

está associado a deployment `READY`.

### Nova branch

O commit com o primeiro teste da nova branch:

```text
be503724739aba8822f2afd2e293696e233cfdef
test: cover storefront stock policy baseline
```

teve preview `READY`:

```text
optmamenu-1751vlswu-optmaidea.vercel.app
```

Alguns deploys intermediários de documentação/scripts foram cancelados automaticamente em favor de commits posteriores; isso não representa falha do build. O head com alteração TypeScript/teste compilou no preview da Vercel.

**Importante:** Vercel `READY` comprova o build configurado, não substitui `npm test`/Playwright local. Esses testes ficam obrigatórios no preflight do Antigravity.

---

## 3. Supabase — integridade de dados

### Resultado atual

| Auditoria | Resultado |
|---|---:|
| Slugs públicas duplicadas | 0 |
| Divergências `reserved` × reservas ativas válidas | 0 |
| E-mails ativos duplicados dentro da mesma loja | 0 |
| Chaves de telefone interno duplicadas dentro da mesma loja | 1 |
| Inconsistências tenant em relações operacionais testadas | 0 |

### Telefone interno duplicado

Foi identificada na Gelinhares uma chave de telefone compartilhada por dois memberships ativos, mascarada como:

```text
***3805
```

Aliases envolvidos:

- `Seu Madruga`;
- `Nino`.

Isso deve ser tratado durante H2B antes de criar constraint rígida, porque pode representar dado fictício/teste antigo. Depois da limpeza, a unicidade normalizada por loja deve ser garantida também no backend, não apenas na UI.

### Multi-tenant — integridade relacional

Foram verificados e retornaram **0 findings**:

- produto × categoria com `store_id` divergente;
- item de pedido × pedido;
- item de pedido × produto;
- saldo local × produto/local;
- reserva × pedido/produto/local;
- transferência × locais de origem/destino;
- item de transferência × transferência/produto;
- item de compra × documento/produto;
- membership ativo duplicado para mesmo `user_id` dentro da loja.

Isso é um bom sinal de integridade dos dados atuais, mas **não prova a autorização RLS/RPC**; testes de acesso cruzado continuam obrigatórios.

---

## 4. Supabase — financeiro

Gelinhares:

```text
Saldo consolidado do cashbook: R$ 822,20
Não distribuído:              R$ 663,50
Lançamentos não distribuídos: 32
```

Saldos já atribuídos:

| Conta | Tipo | Saldo |
|---|---|---:|
| Caixa físico | cash_drawer | -R$ 48,00 |
| Caixa Loja Centro | cash_drawer | R$ 53,70 |
| InfinitePay | pix_wallet | R$ 65,00 |
| Recebíveis de cartão | card_receivable | R$ 88,00 |
| Carteira Pix | pix_wallet | R$ 0,00 |
| CEF | bank | R$ 0,00 |
| Cofre | safe | R$ 0,00 |
| Maquininha | card_acquirer | R$ 0,00 |
| Proprietário | owner | R$ 0,00 |

A soma atribuída + `Não distribuído` fecha com o saldo consolidado atual. Decisão Q20: não inferir historicamente; criar lista e classificação manual auditada.

---

## 5. Supabase — Security Advisor e grants

O banco possui **303 funções `SECURITY DEFINER`** no schema público.

Na consulta de grants:

- **57** são executáveis pelo papel `anon`;
- **206** são executáveis pelo papel `authenticated`.

Esse número isolado não significa 57 vulnerabilidades: várias funções públicas precisam ser chamadas anonimamente. O problema é que a classificação/grant ainda não está formalmente auditada.

### Exemplos anon-executable que exigem revisão imediata

- `adjust_customer_loyalty_points_safe(...)`;
- `admin_accept_public_order_safe(uuid)`;
- `admin_finalize_public_order_with_payment(uuid,text)`;
- `admin_mark_public_order_ready_safe(uuid)`;
- `admin_set_public_order_payment_status_safe(uuid,text)`;
- `complete_my_store_member_onboarding(...)`;
- `create_pos_sale_safe(...)`;
- `reconcile_inventory_reservations(uuid,boolean)`;
- `reverse_received_stock_transfer(uuid,text)`.

Também aparecem funções de consulta/loyalty que podem ser legitimamente públicas, mas precisam ser avaliadas contra enumeração/exposição de dados.

### Advisor

Pendências registradas para H0:

- tabelas com RLS habilitado sem policy (`customer_credentials`, `order_message_events`, `reserved_store_slugs`) — pode ser intencional se acesso direto estiver revogado, mas precisa comprovação;
- função com `search_path` mutável;
- proteção contra senhas vazadas do Supabase Auth desabilitada;
- várias funções SECURITY DEFINER com grants amplos.

**Ação:** classificar RPCs em `PUBLIC_ANON`, `AUTHENTICATED`, `INTERNAL`, revisar checks internos, fixar `search_path` e revogar grants excedentes.

---

## 6. Supabase — Performance Advisor

Os advisors apontam dívida estrutural relevante, mas posterior aos blockers funcionais/segurança:

- foreign keys sem índice de apoio em tabelas operacionais;
- policies RLS com `auth.uid()`/funções reavaliadas por linha;
- múltiplas permissive policies na mesma ação/tabela;
- índices duplicados;
- índices marcados como não usados.

**Não remover índices “não usados” automaticamente** com a massa de teste atual. Primeiro medir em carga representativa.

---

## 7. Findings priorizados

### P0

1. auditar grants/RLS/SECURITY DEFINER antes de exposição externa ampla;
2. resolver migration drift confirmado e tornar Git fonte reproduzível;
3. executar preflight local `npm test` + `npm run build` + E2E crítico.

### P1

1. cadastro completo de nova loja conforme Q4;
2. tela `Saldos por conta` + `Não distribuído`;
3. unicidade de telefone interno após saneamento do dado duplicado;
4. editar/remover itens de transferência `draft` e preservar filtros;
5. alertas fortes de pedido online;
6. área customer senha + OTP somente após hardening da boundary.

### P2

1. performance/RLS policy optimization;
2. acessibilidade e padronização loading/403;
3. redesign de navegação/tablet;
4. import/bootstrap e templates de impressão.

---

## 8. Próxima evidência esperada

O Antigravity deve rodar o protocolo `docs/ANTIGRAVITY_HOMOLOGACAO_AUTONOMA_20260820.md` no clone local e gerar relatório em `docs/reports/`, incluindo:

- test;
- build;
- lint real;
- Playwright disponível/indisponível;
- migration list local × remoto;
- E2E público inicial;
- findings de código local.

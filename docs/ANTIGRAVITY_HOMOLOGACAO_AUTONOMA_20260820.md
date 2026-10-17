# Protocolo autônomo para o Antigravity IDE — Homologação OptmaMenu

**Data-base:** 20/08/2026  
**Branch obrigatória:** `agent/homologacao-geral-20260820`

Este documento é um prompt operacional para o co-agente local. Ele deve executar diagnóstico, testes e produzir evidências **sem corrigir banco remoto automaticamente**.

---

## Prompt para entregar ao Antigravity IDE

```text
Você está atuando como co-agente de homologação do projeto OptmaMenu.

REPOSITÓRIO
- OptmaIdea/optmamenu
- branch obrigatória: agent/homologacao-geral-20260820
- stack: React + TypeScript + Vite + Supabase/Postgres + Vercel
- Supabase principal/HML atual: lgkkfmqzaorrutuoqeax

LEIA PRIMEIRO
1. .agents/AGENTS.md
2. docs/MASTER_RETOMADA_HOMOLOGACAO_OPTMAMENU_20260820.md
3. docs/CHECKLIST_HOMOLOGACAO_SEGMENTADA_OPTMAMENU_20260820.md
4. docs/BRIEFING_PWA_SLUG_ASSISTENTE_CANAIS_OPTMAMENU_20260820.md
5. docs/QUESTIONARIO_RETOMADA_GERAL_OPTMAMENU_20260820.md
6. documentação mais recente das áreas que qualquer teste tocar.

OBJETIVO
Produzir uma fotografia reprodutível do estado local e criar/rodar testes automatizados úteis, sem maquiar falhas. Não altere regras de negócio apenas para fazer um teste passar.

REGRAS INEGOCIÁVEIS
- Nunca exponha, imprima ou versione secrets, tokens, service-role keys ou senhas.
- Nunca rode DELETE/TRUNCATE/DROP/UPDATE massivo no Supabase remoto durante diagnóstico.
- Nunca aplique migration remota sem pedido explícito do mantenedor.
- Nunca force push.
- Não faça merge na main.
- Não desabilite RLS, permission guards, validação de estoque, pricing ou regras financeiras para fazer testes passarem.
- Não substitua erro por try/catch silencioso.
- Não marque PASS sem evidência.
- Não invente credenciais ou dados reais. Para dados de teste use prefixo HML e massa claramente identificada.
- Se houver alteração de código necessária para tornar a suíte executável, faça commit pequeno e descritivo somente nesta branch.

ETAPA A — PREFLIGHT
1. Rode:
   git status --short
   git branch --show-current
   git log -1 --oneline
   node --version
   npm --version
2. Confirme a branch. Se estiver em outra, PARE e registre BLOCKED; não troque branch se houver mudanças locais não commitadas.
3. Rode `npm ci`.
4. Rode `node scripts/homologation/preflight.mjs` se existir.
5. Se o script não existir, rode manualmente:
   npm test
   npm run build
   npm run lint
6. Capture exit code e resumo de cada comando. Não esconda lint existente.

ETAPA B — PLAYWRIGHT
1. Rode `npx playwright --version`.
2. Se Playwright não estiver instalado:
   - verifique se há política/instrução do repo impedindo nova dependência;
   - caso não haja, instale apenas como dev dependency: `npm install -D @playwright/test`;
   - rode `npx playwright install chromium firefox`.
3. Se instalação de browser for bloqueada pelo ambiente, registre BLOCKED e continue com Vitest/build/lint.
4. Não instale WebKit como requisito desta rodada. Safari/iPhone será teste manual em dispositivo real quando disponível.

ETAPA C — CRIAR E2E MÍNIMO SE AINDA NÃO EXISTIR
Crie uma estrutura `e2e/` e `playwright.config.ts` com:
- Chromium desktop;
- Firefox desktop;
- viewport Android-like de Chromium para smoke responsivo;
- screenshot somente em falha;
- trace on-first-retry;
- video retain-on-failure;
- baseURL por env `E2E_BASE_URL`, default local `http://127.0.0.1:5173`.

Não crie E2E destrutivo remoto sem credenciais HML fornecidas via env.

ETAPA D — TESTES PÚBLICOS SEM LOGIN
Automatize primeiro o que não exige secret:
1. rota pública institucional abre sem crash;
2. política de cookies abre;
3. slug pública configurada via env `E2E_STORE_SLUG` abre;
4. catálogo não exibe erro de console fatal;
5. card indisponível não adiciona ao carrinho;
6. card disponível abre detalhe;
7. carrinho soma/retira item;
8. footer legal aponta para o slug correto;
9. layout smoke em 360x800, 412x915, 768x1024 e 1440x900;
10. nenhum scroll horizontal global indevido.

Se `E2E_STORE_SLUG` não existir, marque os testes dependentes como skipped com motivo, não hardcode Gelinhares no código de teste.

ETAPA E — TESTES DE AUTENTICAÇÃO/ADMIN
Somente com env HML dedicado, nunca credenciais pessoais no código:
- E2E_HML_EMAIL
- E2E_HML_PASSWORD
- E2E_HML_STORE_ID (se necessário)

Smoke:
1. login válido;
2. login inválido;
3. rota admin protegida;
4. logout;
5. após logout menus não preservam estado da sessão;
6. 403 volta para início;
7. atalhos da Home respeitam permissões.

ETAPA F — SUPABASE READ-ONLY
Se Supabase CLI/psql estiver configurado de forma segura, rode os SQLs em:
- scripts/homologation/sql/01_security_grants_audit.sql
- scripts/homologation/sql/02_data_integrity_audit.sql
- scripts/homologation/sql/03_financial_accounts_audit.sql
- scripts/homologation/sql/04_multitenancy_audit.sql

Esses scripts devem ser SELECT-only.

Também rode `supabase migration list` se o projeto estiver linkado. Compare migrations remotas e locais. NÃO faça `db push`, `migration repair` ou apply automático.

ETAPA G — BUSCA ESTÁTICA DE RISCOS
Procure no frontend/repo:
- service_role
- SUPABASE_SERVICE_ROLE
- senhas/tokens hardcoded
- `.from(` direto em tabelas sensíveis quando deveria haver RPC boundary
- `console.error` em regras de negócio esperadas
- `any` em guards/permission/auth críticos
- TODO/FIXME em auth, finance, stock, checkout

Não trate toda ocorrência como bug. Classifique e explique contexto.

ETAPA H — EVIDÊNCIAS
Crie `docs/reports/HOMOLOGACAO_LOCAL_<YYYYMMDD_HHmm>.md` contendo:
- commit/branch;
- ambiente Node/npm;
- resultado npm ci;
- Vitest;
- build;
- lint;
- Playwright/version/browser install;
- E2E executados e resultados;
- console errors relevantes;
- SQL audits read-only;
- drift de migrations;
- findings por severidade P0/P1/P2/P3;
- itens do checklist relacionados;
- arquivos alterados;
- próximos passos concretos.

SEVERIDADES
P0 = risco de segurança/tenant, perda/corrupção de dados, duplicação financeira/estoque, login quebrado, build/deploy quebrado.
P1 = fluxo crítico incompleto ou inconsistente que impede homologação.
P2 = UX importante, performance, acessibilidade ou dívida controlável.
P3 = melhoria/deferido.

CRITÉRIO DE SAÍDA
- Rode novamente npm test e npm run build após qualquer alteração.
- Não diga “tudo OK” se lint/E2E tiverem falhas.
- Faça commits pequenos.
- Ao terminar, responda ao mantenedor com: commits, relatório criado, PASS/FAIL/BLOCKED e os 5 próximos itens de maior impacto.
```

---

## Comandos rápidos para o mantenedor

Primeira rodada:

```bash
git checkout agent/homologacao-geral-20260820
git pull
npm ci
node scripts/homologation/preflight.mjs
```

Com instalação incluída no preflight, se desejar:

```bash
node scripts/homologation/preflight.mjs --install
```

Playwright, após o co-agente validar que pode instalar:

```bash
npm install -D @playwright/test
npx playwright install chromium firefox
```

---

## O que o Antigravity NÃO deve decidir sozinho

Exigir resposta em documento antes de:

- mudar modelo de autenticação customer;
- alterar retenção/exclusão de conta;
- alterar modelo de tenant/store_id;
- aplicar migration no remoto;
- reconciliar/modificar dados financeiros históricos;
- excluir dados HML;
- introduzir service worker/offline para mutações críticas;
- mudar precedência de pricing;
- mudar política fiscal;
- abrir novos dados sensíveis de usuários.

Quando encontrar uma dessas decisões, criar `docs/questions/QUESTIONARIO_<tema>_<data>.md` com contexto, alternativas e recomendação, em vez de adivinhar.

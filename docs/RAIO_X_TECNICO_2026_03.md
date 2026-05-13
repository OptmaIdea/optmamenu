# Raio-X Técnico OptmaMenu (Mar/2026)

## Escopo e método

Este diagnóstico foi feito com base em:

- Leitura de arquitetura, configuração e trechos críticos de runtime.
- Build e testes automatizados locais.
- Priorização por impacto (produção, segurança, receita, velocidade de entrega).

## Resumo executivo (prioridade por impacto)

### P0 — Corrigir regressão funcional em preço por volume (impacto direto em receita)

**Sintoma**
- A suíte de testes falha em 5 cenários de precificação por volume no carrinho.
- Os testes indicam não aplicação dos descontos esperados (R$5,00 permanecendo onde deveria ser R$4,50 / R$4,00).

**Evidência técnica**
- O cálculo de preço depende de `use_category_pricing` para habilitar regra por categoria, com fallback para `originalPrice` quando não habilitado.
- As falhas estão concentradas exatamente nos cenários de regra de volume por categoria.

**Risco de negócio**
- Cobrança incorreta no checkout (overcharge ou undercharge), potencial impacto em conversão e confiança.

**Ação recomendada (imediata)**
1. Revisar contrato de `Product/CartItem` para garantir que `use_category_pricing` seja populado com consistência na origem dos dados.
2. Ajustar `recalculatePrices` para um comportamento explícito quando produto pertence a categoria com regra ativa.
3. Revalidar todos os cenários de volume pricing com novos testes de integração do carrinho.

---

### P1 — Melhorar baseline de segurança/configuração de produção

#### 1) Placeholder de chave anon no cliente

**Evidência**
- Há fallback para `SEU_ANON_KEY_AQUI` quando variável de ambiente não está definida.

**Risco**
- Ambientes mal configurados sobem “aparentemente funcionando”, mas com falhas sutis de autenticação e chamadas API.

**Ação**
- Falhar fast no bootstrap se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` não existirem em produção.

#### 2) Persistência de token de cliente em `localStorage`

**Evidência**
- JWT de cliente e estado de autenticação persistem em `localStorage`.

**Risco**
- Exposição a exfiltração via XSS (risco padrão de qualquer token em storage web).

**Ação**
- Endurecer CSP + sanitização + revisão de superfícies HTML dinâmicas.
- Considerar migração para sessão com menor janela de validade e renovação controlada.

---

### P1 — Qualidade de entrega (CI) e previsibilidade

**Evidência**
- Build local passa.
- Testes falham (5 testes), indicando gap entre “buildável” e “releaseável”.

**Risco**
- Deploy de regressões de regra de negócio quando pipeline aceitar apenas build.

**Ação**
1. Gate de CI obrigatório: `npm run test` e `npm run build`.
2. Opcional: adicionar `npm run lint` no gate para prevenir drift de qualidade.

---

### P2 — Performance e experiência de carregamento

**Evidência**
- Bundle principal ainda relevante em tamanho (chunk principal grande).
- Roteamento já usa `lazy`/`Suspense`, o que é um ponto positivo.

**Risco**
- First load mais lento em redes móveis, especialmente no admin.

**Ação**
1. Quebrar módulos administrativos de maior peso por sub-rotas internas e componentes “on-demand”.
2. Auditar dependências grandes não críticas no caminho inicial.
3. Medir Web Vitals (LCP/INP/CLS) em ambiente real e tratar gargalos com dados.

---

### P3 — Governança técnica e documentação operacional

**Evidência**
- README da raiz ainda está em formato de template e não representa o estado real do produto.

**Risco**
- Onboarding lento, setup inconsistente, maior custo de manutenção.

**Ação**
- Atualizar README com: visão do produto, setup local completo (frontend + supabase), variáveis de ambiente, fluxo de testes, convenções de branch/release.

## Dívida técnica mapeada

- **Testes quebrados em regra crítica de negócio** (dívida funcional alta).
- **Contrato implícito de precificação por categoria** dependente de flag possivelmente inconsistente (`use_category_pricing`).
- **Configuração de produção permissiva** (fallback de env no cliente).
- **Documentação de entrada desalinhada** (README genérico).

## Checklist de produção (objetivo e prático)

### Segurança
- [ ] Garantir env vars obrigatórias em build/deploy (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- [ ] Revisar política de CSP e superfícies de injeção.
- [ ] Revisar tempo de expiração/renovação de JWT de cliente.

### Qualidade
- [ ] Pipeline bloqueia merge com teste quebrado.
- [ ] Cobertura mínima para fluxos de carrinho/preço/checkout.
- [ ] Testes de regressão para volume pricing por categoria.

### Performance
- [ ] Acompanhar tamanho dos principais chunks por release.
- [ ] Definir orçamento de bundle (budget) para rota inicial.
- [ ] Instrumentar Web Vitals e alertas.

### Operação
- [ ] README operacional atualizado.
- [ ] Runbook de incidentes (pagamento, estoque, auth, checkout).
- [ ] Checklist de rollback por release.

## Plano de execução sugerido (2 semanas)

### Semana 1
1. Corrigir regressão de pricing + testes (P0).
2. Fechar gate de CI (build + test) (P1).
3. Bloquear fallback de env em produção (P1).

### Semana 2
1. Hardening de sessão/token + CSP (P1).
2. Auditoria de bundle e code-splitting adicional no admin (P2).
3. Atualização de README e runbook mínimo (P3).

## Indicadores de sucesso

- 0 falhas em suíte de carrinho/preço por 4 releases consecutivas.
- Build + test obrigatórios antes de merge.
- Redução mensurável no tamanho do chunk inicial e melhora de LCP em mobile.
- Tempo de onboarding técnico reduzido com documentação atualizada.

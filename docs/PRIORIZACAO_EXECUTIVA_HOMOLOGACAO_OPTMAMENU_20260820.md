# Priorização executiva da homologação — OptmaMenu

**Data-base:** 20/08/2026  
**Referência:** `MASTER_RETOMADA_HOMOLOGACAO_OPTMAMENU_20260820.md`

Este quadro serve para o mantenedor escolher urgência sem precisar percorrer todo o checklist técnico.

## Regra de prioridade

- **P0 — antes de expor mais:** segurança, build, migração/reprodutibilidade e risco de dado.
- **P1 — fecha produto palpável:** fluxos que o lojista realmente precisa operar.
- **P2 — robustez e experiência:** qualidade, performance, acessibilidade e escala.
- **P3 — expansão:** diferenciais e frentes posteriores que não devem bloquear a homologação atual.

---

## P0 — recomendação: executar primeiro

| Frente | Motivo | Estado atual |
|---|---|---|
| Grants/RLS/SECURITY DEFINER | 57 funções SECURITY DEFINER aparecem executáveis por `anon`; precisam ser classificadas e ter autorização comprovada | auditoria iniciada |
| Drift de migrations | pelo menos 4 migrations remotas recentes não têm arquivo versionado equivalente confirmado no caminho convencional | confirmado |
| Preflight local | precisamos de `npm test`, build, lint real e início de E2E no clone | script/prompt prontos |
| Multi-tenant adversarial | integridade relacional atual está limpa, mas autorização cruzada precisa de teste real | pendente |
| Customer auth scaffold | não promover credencial/sessão própria sem hardening | bloqueado até revisão |

**Saída P0:** podemos confiar que a aplicação que estamos testando é reproduzível e que Loja A não opera Loja B.

---

## P1-A — nova loja e identidade

| Frente | Entrega palpável |
|---|---|
| signup + confirmação de e-mail | novo proprietário começa sem intervenção manual |
| onboarding da loja | empresa, identidade, primeiro local e `/admin` |
| slug única + sugestão | endereço público não colide |
| logo empresa × logo pública | identidade interna e experiência customer separadas |
| e-mails transacionais | boas-vindas, convite, segurança e ciclo de conta |
| import/bootstrap | cadastrar operação real sem digitação exaustiva |

**Resultado:** conseguimos criar uma segunda loja do zero e demonstrar onboarding real.

---

## P1-B — usuários e governança

- unicidade de e-mail/telefone por loja;
- saneamento da chave de telefone duplicada já encontrada na Gelinhares;
- OTP OptmaSMSGate para validar telefone interno;
- papéis atuais + overrides;
- Home/atalhos por permissão;
- 403 padrão;
- spinner/loading padrão;
- logout sem menu herdado;
- solicitações de alteração de perfil.

**Resultado:** proprietário consegue montar uma equipe sem risco de acesso indevido ou UX incoerente.

---

## P1-C — estoque/suprimentos

- categorias/produtos/import;
- fornecedor 360º;
- compras/cotações;
- Vida do Produto;
- reservas;
- editar/remover/adicionar item de transferência `draft`;
- filtros persistentes;
- envio/recebimento/cancelamento/estorno/divergência;
- pricing por categoria e grupos combinados;
- concorrência de último saldo.

**Resultado:** operação de estoque fica demonstrável sem depender de vendas.

---

## P1-D — comercial + efeito da venda

- PF/PJ;
- `Consumidor Final`;
- snapshot de CPF/CNPJ/nome/telefone/endereço sem cadastro automático;
- PDV;
- venda direta;
- mesa;
- slug visitante;
- origem comercial rastreável;
- cancelamento/devolução → estoque + financeiro + fidelidade conforme aplicável;
- documento auxiliar não fiscal.

**Resultado:** conseguimos provar o ciclo completo da venda.

---

## P1-E — slug + carrinho + checkout

- mídia/configuração/branding;
- estoque online por local;
- catálogo;
- promoções;
- carrinho;
- checkout;
- tracking;
- mobile/tablet/desktop;
- concorrência, rede lenta e mudança de preço/estoque.

**Resultado:** experiência que pode ser mostrada ao parceiro/cliente externo.

---

## P1-F — financeiro antes da área customer

Prioridade já aprovada:

1. `Financeiro → Saldos por conta`;
2. `Não distribuído` visível;
3. lista dos 32 lançamentos históricos atuais;
4. classificação manual auditada;
5. dinheiro/Pix/cartão/recebível → conta correta;
6. estorno automático/idempotente de venda cancelada;
7. fechamento e conciliação manual;
8. validar plano de contas receita × despesa.

**Resultado:** saldo deixa de ser apenas número total e passa a responder “onde está o dinheiro?”.

---

## P1-G — alertas operacionais

- novo pedido visual persistente;
- som configurável;
- push opcional;
- contador/ack;
- futura rota fullscreen para tablet/TV.

**Resultado:** o canal online fica operacional no balcão sem depender de alguém olhando o sino.

---

## P1-H — área logada do cliente + OptmaSMSGate

Executar depois das frentes acima estarem sólidas:

- cadastro voluntário;
- senha + OTP;
- consentimentos;
- login/logout/recuperação;
- pedidos futuros vinculados;
- sem vinculação retroativa;
- isolamento por loja.

**Resultado:** abre caminho para fidelidade real, preferências e PWA customer.

---

## P2 — robustez e UX

- Playwright amplo;
- acessibilidade;
- performance/RLS optimizations;
- FKs sem índices;
- redução de policies redundantes;
- navegação menos truncada;
- redesign para tablet;
- modo offline com fila/idempotência;
- PWA admin e por slug;
- impressão/PDF padronizada;
- observabilidade e métricas.

Alguns itens P2, especialmente offline, podem subir para P1 antes do release comercial se o primeiro cliente depender de internet instável.

---

## P3 — roadmap preservado

- raspadinha/campanhas avançadas;
- Consultor de Marketing;
- assistente IA da loja;
- custom domains;
- serviço de templates;
- WhatsApp Business oficial;
- Telegram/outros mensageiros;
- B2B premium avançado;
- grupo/franquia `business_groups`;
- depósito central/catálogo compartilhado;
- conciliação OFX/CSV automática;
- DRE/fluxo avançado;
- fiscal NF-e/NFC-e/DANFE;
- BI avançado;
- n8n;
- infraestrutura SQL/servidor próprio;
- app/wrapper nativo se um caso real justificar.

---

## Sequência sugerida para amanhã

1. Rodar Antigravity preflight e receber relatório local.
2. Fechar P0 grants/RLS + migrations drift.
3. Criar a nova loja HML pelo fluxo público e registrar cada falha.
4. Corrigir onboarding antes de continuar cadastro operacional.
5. Usar a nova loja para homologar usuários → estoque → comercial → financeiro.
6. Só então iniciar customer auth/OTP.

Esse encadeamento evita criar massa de teste sobre contratos ainda instáveis e transforma a nova loja em uma regressão viva do produto.

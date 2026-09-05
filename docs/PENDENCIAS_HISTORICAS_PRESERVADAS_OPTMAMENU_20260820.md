# Apêndice do documento mestre — Pendências históricas preservadas do OptmaMenu

**Data-base:** 20/08/2026  
**Documento pai:** `MASTER_RETOMADA_HOMOLOGACAO_OPTMAMENU_20260820.md`

Este apêndice preserva itens históricos que não devem desaparecer só porque não são prioridade da homologação atual. Ele complementa o documento mestre e deve ser tratado como backlog autorizado.

---

## P0/P1 histórico operacional — fechar ou reavaliar nesta homologação

### Caixa/PDV

- abertura formal de caixa/turno;
- fechamento por sessão/turno, não apenas visão diária;
- conciliação financeira específica do PDV;
- divergência de caixa integrada às ocorrências/auditoria;
- reforço e sangria como transferência real entre contas financeiras;
- métricas de sessão/operador;
- retomar o restante do fluxo de comanda quando aplicável.

### Pedido Online

- configuração completa da loja pública;
- QR por mesa e geração/impressão administrativa;
- entrega por km e meios de transporte;
- benefício/desconto por cliente/nível;
- segmentos/campanhas respeitando consentimento;
- relatórios/exportações do canal online.

---

## Multi-loja, grupo e franquia — pós-release base

Preservar a direção arquitetural:

- `store` continua sendo unidade operacional;
- Owner pode ter visão global/seletor de loja;
- gerente local deve permanecer restrito à store autorizada;
- operador PDV recebe conjunto mínimo;
- clientes continuam isolados por loja no modelo atual;
- slug permanece globalmente única.

Evoluções futuras:

- `business_groups`/grupo empresarial;
- visão consolidada por grupo;
- depósito central;
- transferências interunidades;
- catálogo compartilhado com sobrescrita local;
- fornecedores globais/compartilhados;
- indicadores consolidados;
- futura identidade única de cliente no nível Owner/Tenant, sem quebrar o isolamento atual antes de existir governança própria.

### Reaproveitamento de produtos na homologação atual

Testar agora o caso real solicitado: copiar categorias/produtos da Gelinhares para a nova loja HML. A implementação deve clonar/importar e gerar ownership/IDs próprios na loja destino. Não reassinar `store_id` do cadastro origem.

---

## Financeiro avançado — preservar

A evolução financeira deve distinguir:

- Livro Diário/caixa físico;
- Livro Caixa/visão gerencial;
- contas financeiras para dinheiro, Pix, bancos, cofre, adquirentes e recebíveis;
- contas locais ou futuramente de grupo;
- transferências entre contas sem distorcer resultado.

Backlog posterior:

- contas consolidadas de grupo;
- cartões e recebíveis avançados;
- taxas de adquirentes;
- conciliação automática;
- importação OFX/CSV/extrato;
- DRE;
- fluxo de caixa gerencial/projetado.

A rodada atual já traz para P1 `Saldos por conta`, `Não distribuído` e conciliação manual.

---

## Clientes, fidelidade e marketing

Preservar:

- Vida/Cliente 360º;
- clientes originados pela slug com ownership e edição diferente dos cadastrados pela administração;
- benefícios/descontos por cliente/nível;
- seleção de clientes para campanhas;
- fidelidade avançada por categoria/produto;
- multiplicadores, bônus, expiração, tiers e recompensas;
- segmentos;
- promoções;
- comunicações dirigidas;
- consentimentos por canal;
- Central de Marketing inicialmente honesta sobre WhatsApp manual;
- etapa futura denominada **Consultor de Marketing**.

Integrações futuras preservadas:

- WhatsApp Business Platform;
- Telegram/outro mensageiro;
- push;
- n8n/automações.

---

## Fiscal e documentos

Nesta rodada:

- CPF/CNPJ no snapshot/documento da venda quando informado;
- documento auxiliar claramente não fiscal;
- templates HTML/CSS próprios de impressão/PDF.

Futuro:

- módulo fiscal próprio;
- NF-e/NFC-e;
- DANFE/documentos fiscais correspondentes;
- retenções e regras fiscais formais.

---

## Infraestrutura e autonomia futura

Preservar como direção estratégica, não prioridade da homologação atual:

- possibilidade de migrar do Supabase/Postgres gerenciado para infraestrutura SQL própria quando houver justificativa econômica/técnica;
- servidor pequeno/barato ou infraestrutura controlada;
- backups e disaster recovery;
- BI avançado;
- reduzir dependência de serviços externos onde fizer sentido sem sacrificar segurança/operabilidade.

---

## Offline ampliado

A homologação atual assumirá offline operacional controlado para PDV/estoque. Evoluções futuras podem incluir:

- hub/edge local para lojas com internet instável;
- coordenação de múltiplos terminais locais;
- sincronização mais forte entre caixa/estoque enquanto WAN estiver indisponível.

Isso é distinto de simplesmente cachear uma PWA.

---

## Conteúdo/loja pública pós-release

- domínio customizado;
- serviço adicional de criação de templates;
- páginas institucionais extras;
- SEO avançado;
- avaliações reais com moderação;
- nota média baseada em dados reais;
- mais vendidos/recomprados/favoritos calculados no backend;
- rankings somente quando houver dados reais;
- FAQ tradicional pode existir, mas não substitui o futuro atendente virtual.

---

## Regra de preservação

Um item deste apêndice só pode ser removido se:

1. for implementado e documentado;
2. for explicitamente descartado pelo mantenedor em documento de decisão;
3. for substituído por decisão arquitetural mais recente claramente registrada.

Silêncio ou passagem de tempo não significam cancelamento do requisito.

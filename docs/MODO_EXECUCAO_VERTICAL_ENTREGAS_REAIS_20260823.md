# OptmaMenu — Modo de execução vertical por entregas reais

Data: 2026-08-23

## Decisão

A partir desta etapa, a homologação deixa de avançar principalmente por microauditorias isoladas e passa a avançar por **entregas verticais funcionais**.

Cada entrega deve, sempre que aplicável, incluir de uma só vez:

- banco/RPC/migration;
- regras de autorização e isolamento por loja;
- service/frontend/UX;
- integração com os módulos relacionados;
- build/deploy;
- teste automatizado ou verificação objetiva de invariantes;
- documentação somente do que for necessário para continuidade.

## Regra de velocidade

Não abrir uma nova subcamada de auditoria quando o risco já estiver suficientemente delimitado para implementar a funcionalidade com segurança.

Auditorias continuam obrigatórias quando houver risco real de:

- perda ou corrupção de dados;
- quebra multi-tenant;
- bypass de autorização;
- divergência financeira/estoque;
- autenticação/identidade;
- migration destrutiva.

Fora desses casos, a validação deve ocorrer dentro da própria entrega vertical.

## Regra de homologação com o usuário

O usuário não deve ser convocado para testar cada microcorreção.

A entrega só deve voltar para homologação manual quando estiver funcionalmente completa o bastante para um **checklist final do módulo**, cobrindo os fluxos principais e regressões relevantes.

## Critério de conclusão de uma entrega

Uma entrega vertical só é considerada pronta quando:

1. o fluxo principal funciona ponta a ponta;
2. permissões de leitura/gestão estão coerentes;
3. o backend é a autoridade das regras críticas;
4. build/deploy não apresentam erro bloqueante;
5. invariantes de dados relacionadas à entrega foram verificadas;
6. limitações restantes estão explicitamente separadas do fluxo entregue.

## Sequência executiva imediata

1. Financeiro — Saldos por conta + classificação manual de não distribuídos.
2. Comercial — vendas realizadas, detalhe e rastreabilidade operacional.
3. Onboarding — cadastro de proprietário/loja conforme decisão Q4.
4. Estoque + vendas + financeiro — reconciliação ponta a ponta dos fluxos críticos.
5. Usuários/permissões — checklist funcional final, sem reabrir auditoria geral já concluída.
6. Loja pública/checkout — checklist mobile/desktop e estabilidade comercial.
7. Portal do cliente/OTP — somente após identidade segura e integração real com OptmaSMSGate.

## Princípio

O objetivo agora é transformar o estado técnico já construído em módulos utilizáveis e homologáveis, evitando tanto regressões quanto ciclos intermináveis de preparação.

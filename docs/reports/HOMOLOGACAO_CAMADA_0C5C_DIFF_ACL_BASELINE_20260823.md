# Homologação — Camada 0C.5C — Diff da baseline reconstruída

Data: 2026-08-23

## Resultado do redump

Foram comparados:

- `remote_public_schema_20260823.sql` — dump do schema `public` do Supabase remoto;
- `local_reconstructed_schema_20260823.sql` — redump do Supabase local após aplicar a baseline remota em transação única.

SHA256:

- remoto: `14EA1546C0A19BA0F8B377B318C250B000E0F01D43D2E6A6DFFC0DA76DE5A36B`;
- local reconstruído: `3179D5C822DF7ADC9B9BD8FFDD1C30A92421BE72D5CAB32647B06AF429C83209`.

`git diff --no-index --stat`:

- 1 arquivo alterado;
- 40 inserções;
- 5 remoções.

## Classificação inicial

A primeira diferença é apenas o token aleatório `\\restrict` emitido pelo `pg_dump`, portanto ruído de serialização.

As demais diferenças observadas são de ACL/GRANT e **não devem ser tratadas como ruído**.

O redump local passou a conter privilégios adicionais em objetos como:

- `store_security_logs`;
- `customer_addresses`;
- `customer_consent_logs`;
- `customer_contacts`;
- `customer_credentials`;
- `customer_legal_profiles`;
- `customer_notifications`;
- `customer_otps`;
- `customers`;
- `operational_timeline_events`;
- `order_message_events`;
- `otp_codes`;
- e possivelmente outros objetos no restante do diff.

Exemplos observados:

- `GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ... TO anon`;
- `GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ... TO authenticated`;
- em `operational_timeline_events`, o grant remoto restrito a `SELECT` para `authenticated` foi redumpado localmente como `SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN`.

## Interpretação técnica

A reconstrução estrutural foi perfeita em contagem de tabelas, views, funções, policies, triggers, índices e tabelas com RLS. Porém, a aplicação do dump sobre um Supabase local novo ocorreu em um ambiente que já possui `DEFAULT PRIVILEGES` próprios para os papéis padrão do Supabase.

Esses privilégios ambientais podem ser materializados no momento da criação dos objetos. Quando o dump remoto não contém `REVOKE` explícito para todas as capacidades herdadas do ambiente local, o objeto reconstruído pode terminar com ACL mais ampla que o objeto remoto original.

Portanto:

- a baseline atual é estruturalmente reproduzível;
- **a equivalência de segurança/ACL ainda não está provada**;
- não é seguro promover o dump bruto como migration baseline definitiva sem normalização explícita de privilégios.

## Evidência read-only do remoto

Os `DEFAULT PRIVILEGES` do schema `public` no projeto remoto estão configurados para `postgres` e `supabase_admin` e concedem, por padrão, privilégios amplos a `anon`, `authenticated` e `service_role` para relações, sequências e funções.

Isso reforça que o estado ACL final de objetos históricos depende de revogações/grants específicos aplicados ao longo do tempo, e não apenas do default atual.

## Estado da camada

0C.5C: PARCIAL / BLOQUEADA PARA BASELINE FINAL.

A equivalência estrutural foi confirmada, mas há divergência real de ACL a classificar e normalizar.

## Próxima ação segura

1. extrair todas as linhas de ACL divergentes do diff completo;
2. comparar o estado remoto e local por objeto/grantee/privilege;
3. gerar uma normalização ACL explícita apenas para o ambiente local de teste;
4. redumpar e exigir equivalência de ACL antes de formalizar a baseline;
5. não alterar o projeto remoto nesta etapa.

Não executar `db push`, `migration repair`, `migration up` ou qualquer mutation no remoto.
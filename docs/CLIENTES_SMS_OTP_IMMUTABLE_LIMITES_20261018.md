# Clientes / Autenticação — limites SMS/OTP (18/10/2026)

**Escopo exclusivo:** corrigir limites por telefone no OptmaMenu, sem alteração nas frentes Pedidos, Estoque, Fidelidade ou OptmaPay.  
**Ambiente:** Supabase `lgkkfmqzaorrutuoqeax` / branch `agent/homologacao-geral-20260820`.

## Reprodução e causa

`issue_customer_otp_for_sms_safe` originalmente contava `customer_otps` por `store_id`, `phone` e `created_at`:
- 3 registros nos últimos 10 minutos;
- 10 registros nas últimas 24 horas.

A alteração administrativa do número em um registro operacional retira essa tentativa do conjunto original. Não há evidência de que um cliente anônimo/autenticado possa executar o UPDATE: `customer_otps` possui RLS e não concede acesso direto a essas roles. Essa é uma falha de integridade do contador operacional, **não uma exploração pública demonstrada**.

A RPC legada `send_customer_otp` também inseria em `customer_otps`, com limite antigo dependente da tabela operacional; ela não é a Edge Function de envio mas precisava ser incluída na contabilização.

## Implementação

### Migration 1: `20261018070000_customer_sms_otp_immutable_quota_ledger.sql`

- `customer_sms_otp_issue_ledger` separado do registro operacional, com apenas `otp_id`, `store_id`, **HMAC** da chave canônica de telefone (não o telefone em claro), `issued_at`, `purpose` e proveniência.
- Segredo HMAC aleatório de 256 bits em `customer_sms_otp_rate_secret`, restrito ao proprietário do banco. Nem o segredo nem o digest são retornados à aplicação.
- Telefone canonizado por `normalize_br_customer_phone` / `match_key`; variantes com e sem o nono dígito compartilham contador.
- Fonte da quota **não lê `customer_otps`**. Alterações, consumo, mudança de telefone ou data do OTP operacional não alteram eventos contabilizados.
- `pg_advisory_xact_lock` sobre a identidade canônica do telefone, **compartilhado entre lojas**, adquirido na pré-verificação e novamente pelo gatilho `BEFORE INSERT`. Assim verificação, lançamento e registro de tentativa estão serializados na mesma transação.
- Gatilho único em `customer_otps` também contabiliza a rota legada de emissão. Insert transacional: se emissão falhar, não persiste recibo isolado.
- Gatilhos negam UPDATE, DELETE e TRUNCATE da trilha operacionalmente imutável; somente a função de retenção pode apagar eventos vencidos.
- Sem acesso direto a segredo, ledger, função de contagem ou limpeza para `anon`, `authenticated` e `service_role`. A RPC principal de emissão continua **exclusiva de `service_role`**.

Limites:
- por telefone **em cada loja**: 3 por 10 minutos e 10 por 24 horas, **inalterados**;
- barreira contra abuso **entre lojas**: 6 por 10 minutos e 20 por 24 horas por telefone;
- janelas deslizantes, com `retry_after_seconds` calculado do histórico e sem contagem separada por propósito (login, recuperação e alteração de telefone contam juntos).

No momento da implantação, a migration importa o histórico disponível das últimas 24 horas de `customer_otps`, marcado como `legacy_backfill`. **Dados de telefone modificados antes desse backfill não podem ser reconstruídos**; a contabilidade é inviolável do ponto de vista da aplicação **a partir da implantação**. O ledger usa HMAC e não armazena OTP, código ou texto de SMS.

### Migration 2: `20261018071000_customer_sms_otp_ledger_retention_cron.sql`

Rotina diária `customer-sms-otp-ledger-prune-90d` apaga eventos com mais de 90 dias via procedimento privilegiado, sem conceder DELETE à aplicação. O histórico de segurança tem retenção limitada.

## Validação executada no banco

Todos os cenários abaixo usam SQL Editor com transação `BEGIN ... ROLLBACK`, **sem chamada à Edge Function nem envio de SMS real**:

1. Emitir três OTPs para o mesmo telefone normalizado; modificar o telefone e `created_at` do primeiro `customer_otps`; nova emissão com outra representação do mesmo número permaneceu bloqueada por `rate_limited`. **PASS**.
2. Tentar UPDATE e DELETE do lançamento HMAC em `customer_sms_otp_issue_ledger`; ambos negados pelo gatilho. **PASS**.
3. Simular dez tentativas históricas distribuídas em 24 horas diretamente no ledger sob contexto SQL privilegiado; emitir a 11ª retornou `daily_limit_reached`. **PASS**.
4. Verificar privilégios negativos de tabelas/segredo/RPC contra `anon`, `authenticated` e `service_role`. **PASS**.
5. Invocar `send_customer_otp` legado sem envio ao gateway; confirmar que o gatilho gera um evento imutável. **PASS**.
6. Confirmar job de retenção ativo. **PASS**.

`supabase/tests/customer_sms_otp_immutable_quota_20261018.sql` está versionado com cenários de regressão e ROLLBACK. A execução desse arquivo por leitura direta foi bloqueada pela ferramenta; os cenários que o compõem foram **executados separadamente** e passaram.

**Concorrência real:** o código protege explicitamente pelo advisory lock no PostgreSQL. Uma tentativa de teste simultâneo por duas chamadas no conector foi inconclusiva — as sessões aparentaram ser serializadas pelo próprio conector. Não afirmar teste de corrida paralela com conexões independentes aprovado. Recomenda-se teste automatizado com duas conexões PostgreSQL distintas, comprometendo uma emissão e verificando que a outra reconta após aguardar o lock, em ambiente isolado.

## Decisão de homologação

Os limites reais de produção **não foram elevados**. A abordagem de testes é simular OTP em transações revertidas sem consumir gateway nem a quota durável. Não existe lista pública de números isentos; eventual exceção de homologação deve ser separada, restrita por ambiente/loja/test number, ter expiração e jamais habilitar envio ilimitado para a produção.

**Limites não cobertos pelo escopo:** bots podem alternar *números distintos* ou IPs. Rate limit por dispositivo/IP, proteção de cadastro e custo do gateway devem ser tratados como camada adicional de defesa em outra auditoria específica, se necessário.

O projeto OptmaSMSGate não foi modificado.

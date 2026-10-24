# Verificação da correção de OTP multiloja — 24/10/2026

**Escopo:** OptmaMenu (`lgkkfmqzaorrutuoqeax`) enviando OTP pelo OptmaSMSGate (`uadkwkcvezuwpdziaunk`). **Base:** `agent/homologacao-geral-20260820`, commit `cb2f5cb765ecfedef8f4629dd3f8376115ac39de`. **Método:** inspeção de commit, Edge Function realmente implantada, deploy e CI, consultas SQL somente leitura e comparação de status agregados. Não foram consultados tokens, telefones, conteúdo de SMS ou OTPs. Nenhum SMS adicional foi disparado.

## 1. Diagnóstico e evidências

A alteração original foi feita em `supabase/functions/send-customer-otp-sms/index.ts`: o serviço passa a ler `stores.config.message_settings.sms.use_sms_gateway` e a usar a própria `stores.sms_gateway_token` quando a loja optou pelo gateway. Um token próprio inválido/ausente provoca `503 sms_gateway_not_configured`, **sem fallback silencioso para a chave global de outra conta**. Quando a loja não optou pelo gateway, mantém o comportamento legado de fallback global. A seleção de loja é por `.eq('id', storeId)`.

**Provas coletadas:**

- Supabase Edge Function `send-customer-otp-sms`: `ACTIVE`, versão **14**, com código **byte a byte idêntico** ao GitHub no commit original `cb2f5cb7`.
- GitHub Actions `Verify` do commit original [40130123605](https://github.com/OptmaIdea/optmamenu/actions/runs/40130123605): `SUCCESS`. Inclui testes, build, grants e cenários JWT/RLS; não contém ainda teste específico da nova chave por loja.
- Vercel deployment do commit `cb2f5cb7`: `dpl_4iVy2wXCCV5bwMmcJEBc5hraPZXQ`, estado `READY`. O campo `target` não foi identificado como Production; a prova de produção do fluxo é a **Edge Function ativa**, independente desse deploy de UI.
- Configuração atual: `logmytravellunch` (nome LogLunch) optou por gateway, tem token em formato `osg_live_` válido; `gelinharessjn` (Gelinhares) tem gateway próprio desativado e nenhum token próprio.
- OptmaSMSGate: duas contas distintas com aplicação `optmamenu` ativa. **Após 20:30:54Z de 24/10/2026** (commit), a conta nova registrou **5 mensagens `sent` e 0 `failed`** até 21:38:47Z; a outra conta não registrou envio após esse marco na janela consultada. Não há prova de um novo login completo por ambas as lojas após o commit, nem associação criptográfica externa entre cada OTP e uma loja sem cruzar identificadores individuais.

**Resultado:** correção de envio por chave de loja **funcionando nos registros reais disponíveis**, sem sinal de falha de transporte no segundo tenant. Sem evidência de regressão no ramo global; para garantir o fluxo da primeira loja pós-correção, manter smoke consentido em momento oportuno (não enviar SMS de teste sem autorização).

## 2. Teste novo reproduzível e sem SMS

A branch de auditoria `agent/otp-multistore-regression-security-20261024` extrai a decisão de roteamento em `supabase/functions/_shared/otpGatewayRouting.mjs`, que é importado pela Edge Function. O contrato de entrada, seleção da loja, envio ao provedor, idempotência e auditoria não são alterados.

A suíte `supabase/tests/otp_multistore_routing.test.mjs` executa com Node 22 e prova:

1. Loja com gateway ativado usa **sua própria API key**, jamais a global.
2. Token próprio ausente/inválido é erro controlado; não usa a chave de outra conta.
3. Loja sem gateway próprio preserva a credencial global.
4. Configuração explícita moderna desligada prevalece sobre legado `use_sms_gateway=true`.
5. Configuração legado continua compatível sem perder a separação por conta.
6. Ausência de credenciais é falha controlada.
7. Config inválida é tolerada sem falha de runtime.
8. A Edge Function importadora mantém lookup por `storeId`, idempotência e auditoria pós-solicitação.

O workflow `.github/workflows/verify.yml` passa a executar o teste a cada PR contra homologação. O helper é extraído do código já em produção: não faz solicitação de rede nem envia mensagens.

## 3. Achado de segurança que BLOQUEIA declaração de isolamento completo da credencial

O banco **atual** do OptmaMenu concede `SELECT` em `public.stores.sms_gateway_token` a `authenticated` (consulta `has_column_privilege=true`). Há policy `stores_select_by_active_store_permission` que autoriza visualizar o registro da própria loja inclusive com `products.view`, `stock.view`, `orders.view` e outras permissões operacionais. Assim, um funcionário com acesso a sua loja pode potencialmente ler uma **credencial de envio** que deveria ser restrita ao serviço e a gerentes de mensagens autorizados. Isso não comprova vazamento nem acesso entre **lojas sem vínculo**; é exposição intraloja por papel amplo.

A UI `MessageSettings.tsx` também consulta `.from('stores').select('id, name, sms_gateway_token, config')` e mostra a chave em `<input type="text">`, além de atualizar o registro por Data API. **Revogar a coluna bruscamente quebraria essa tela, pois ela é lida e escrita hoje no navegador.**

### Remediação segura em fases, sem desligar OTP real

- **Etapa V1 — cofre:** nova tabela de credenciais em schema não exposto, com acesso só a serviço, funções de leitura para serviço e de substituição restrita a proprietário. Retornar aos navegadores apenas `configured: boolean`, nunca token existente. Testes PostgreSQL 17 como owner, operador `products.view`, anon e serviço.
- **Etapa V2 — compatibilidade:** Edge Function lê primeiro o cofre, com fallback legado *temporário* exclusivamente durante migração. Tela passa a usar RPC restrita para cadastrar/substituir token, com input vazio por padrão e opção explícita de revogar; jamais devolver token ao navegador.
- **Etapa V3 — corte:** conferir que a Edge implantada lê o cofre, migrar a credencial existente e limpar `stores.sms_gateway_token`, desautorizar alteração de credencial fora da RPC, remover fallback legado depois da validação, rotacionar a chave antiga se necessário.
- **Etapa V4 — aceite:** testar OTP real com contas distintas, Gelinhares e LogLunch e negativas para chave inválida / loja alheia, monitorar `401/403/429`, `sent`/falha, idempotência, rate limit e exposição da API. Sem novo SMS de teste enquanto não autorizado.

**NÃO aplicar agora apenas `REVOKE SELECT` na coluna:** uma revogação de tabela/coluna incompleta pode quebrar `SELECT *` ou filtros existentes no painel. Não permitir credencial de gateway em localStorage, logs, PR, UI não administrativa ou payload público.

## 4. Limites, decisões e liberação

Esta investigação não fez mudanças nos projetos Supabase nem publicou Edge Function / frontend. A branch e o PR Draft de regressão são **isolados** da branch de homologação em uso; os novos testes são independentes de OTPs reais.

A segurança do OptmaSMSGate referente aos grants foi aplicada ao banco em 22/10/2026 (39 migrations), mas a sua branch web `agent/supabase-explicit-grants-20261020` permanece em PR Draft #4, sem promoção Vercel Production. **A manutenção e governança de segredos da integração OptmaMenu são um trabalho distinto e não devem impedir a versão existente de transportar OTP enquanto preparamos o corte.**

**GO:** manter o roteamento implantado e adicionar regressão automatizada. **BLOQUEIO:** não declarar privacidade de API key de loja resolvida até retirar a credencial de `public.stores` e validar a UI/Edge com cofre. **NO-GO:** deploy não coordenado da migração de cofre ou revogação abrupta das colunas de `stores` em produção.

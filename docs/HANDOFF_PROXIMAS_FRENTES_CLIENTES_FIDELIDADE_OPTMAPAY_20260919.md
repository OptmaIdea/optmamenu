# Handoff — próximas frentes após Clientes / Slug

Atualizado em: 2026-09-19

Este documento separa as próximas conversas técnicas para evitar misturar fechamento de Clientes, refinamentos, Fidelidade e integração OptmaPay.

## Chat 1 — Fechamento real de Clientes e Slug

Objetivo: encerrar a frente atual com validação ponta a ponta antes de abrir Fidelidade.

Estado já validado:
- apelido / identificação separado de nome completo;
- idade mínima de 18 anos na fidelidade;
- confirmação de e-mail enviada via Brevo;
- pedidos do cliente usando `status_changed_at`;
- pontuação de pedido concluído chegando automaticamente;
- saída voluntária da fidelidade limpando dados exclusivos da fidelidade;
- pedido anterior / consumo e demais recursos da conta disponíveis no portal;
- carrinho autenticado persistido no servidor;
- confirmação de e-mail corrigida para não depender de rota protegida de Preview da Vercel.

Teste pendente imediato:
1. solicitar NOVO e-mail de confirmação após o deploy atual;
2. o link deve apontar diretamente para `/functions/v1/confirm-customer-email` no Supabase;
3. não deve abrir login da Vercel;
4. a página deve renderizar HTML amigável;
5. o e-mail deve ficar confirmado;
6. após confirmação, deve chegar um segundo e-mail transacional informando que a verificação foi concluída.

Pendência obrigatória antes de considerar Clientes fechado:
- direito do cliente de solicitar exclusão da conta;
- reautenticação forte para exclusão;
- invalidação imediata de sessões/dispositivos;
- remoção ou anonimização de dados não sujeitos a retenção;
- preservação isolada somente do que tiver obrigação legal/fiscal/contábil;
- trilha mínima de auditoria da solicitação e execução;
- exportação dos dados do titular antes da exclusão como melhoria desejável.

A política não deve prometer exclusão de documentos fiscais quando houver obrigação legal de conservação. O mapa exato de prazo e campos preservados deve ser definido por tipo de documento e obrigação, não por retenção genérica.

## Chat 2 — Refinamento final de Clientes: UX, segurança e legalidade

Objetivo: revisar o portal do cliente como produto maduro antes de encerrar a frente.

Checklist de pesquisa/execução:
- arquitetura de navegação mobile-first do modal/portal;
- acessibilidade, foco, teclado, contraste e estados vazios;
- central de privacidade e consentimentos;
- exportar meus dados;
- excluir minha conta;
- sessões/dispositivos confiáveis e opção de encerrar sessões;
- alteração segura de telefone, e-mail, CPF e data de nascimento;
- histórico de segurança relevante ao cliente;
- proteção contra enumeração de conta, brute force e abuso de OTP;
- comunicação transacional separada de marketing;
- revisão de termos, política de privacidade, programa de fidelidade e retenção;
- testes controlados desde cadastro novo até exclusão final.

### Arquitetura de autenticação a analisar

O cliente atualmente possui credenciais próprias em `customer_credentials`, OTP próprio e trusted-device próprio, mas a sessão ainda é transportada por um usuário sintético do Supabase Auth:
- e-mail sintético: `customer-{customer_id}@auth.optmamenu.com.br`;
- a Edge Function `customer-auth-session` gera magic link interno;
- o front troca o token hash por sessão Supabase e usa o JWT resultante.

Portanto, o e-mail real do cliente NÃO é hoje a identidade Supabase Auth e não colide com e-mail de lojista.

Alternativas a analisar:
A. manter Supabase Auth somente como transporte de sessão do cliente;
B. substituir os usuários sintéticos por JWT próprio de cliente, mantendo PostgreSQL/RLS com claims `portal=customer`, `customer_id`, `store_id`, expiração curta, refresh token próprio, revogação e binding de dispositivo;
C. avaliar separadamente autenticação própria para owners/colaboradores.

Para owners/colaboradores, o modelo atual `auth.users -> profiles -> store_members` permite uma identidade global vinculada a várias lojas. Antes de remover Supabase Auth desta camada, levantar o custo de substituir:
- login;
- recuperação de senha;
- convites;
- MFA/reauth;
- revogação;
- auditoria;
- RLS que hoje usa `auth.uid()`;
- seleção de múltiplas lojas e permissões.

## Chat 3 — OptmaPay ↔ OptmaMenu

Documento de referência recebido: `INTEGRACAO_OPTMAPAY_OPTMAMENU.md`.

O repositório `OptmaIdea/optmapay` está acessível e foi analisado.

### Compatibilidade já existente no OptmaMenu

O OptmaMenu já possui:
- provider code `optma_sandbox`;
- `store_online_payment_providers`;
- `online_payment_intents`;
- `online_payment_events`;
- rotas de recebimento;
- liquidação autoritativa no Livro Caixa;
- laboratório Sandbox;
- padrão robusto de adapter + webhook já usado pelo Asaas.

Portanto a integração OptmaPay não deve criar um segundo sistema paralelo. O caminho correto é substituir/evoluir o simulador local `optma_sandbox` para um adapter real contra o OptmaPay.

### Arquitetura proposta

- `optmapay-sandbox-adapter` no Supabase do OptmaMenu;
- `optmapay-sandbox-webhook` no Supabase do OptmaMenu;
- credenciais somente server-side;
- `online_payment_intents` continua sendo a fonte interna de intenção;
- `online_payment_events` continua sendo a fonte de auditoria/idempotência;
- `apply_online_payment_settlement_internal` continua sendo a autoridade para pedido + financeiro;
- roteamento para conta financeira interna preservado;
- Pix, cartão e estorno entram como capacidades do provider `optma_sandbox`.

### Gaps encontrados no OptmaPay antes de integração forte

1. `api/sandbox/v1/cards/charge.ts` não valida API key e hoje apenas retorna uma aprovação simulada; não liquida conta nem persiste transação bancária.
2. `api/sandbox/v1/transactions.ts` também retorna transação simulada sem autenticação/persistência.
3. `api/sandbox/v1/account.ts` exige presença de uma chave, mas não valida a chave contra `api_keys`.
4. As chaves no `DevPanel` são geradas no browser com `Math.random()` + timestamp e armazenadas em texto puro.
5. Existem dois padrões incompatíveis de webhook:
   - frontend `webhookEngine.ts`: `x-optmapay-signature: sha256_mock_{secret}`;
   - Edge `webhook-dispatcher`: `x-optmapay-secret: {secret}`.
   O manual fala em assinatura/HMAC, mas isso ainda não está implementado de verdade.
6. O `webhook-dispatcher` usa service role e deve receber validação explícita do chamador, ownership da configuração, SSRF server-side e idempotência/retry robustos.
7. O disparo de webhook do Pix hoje parte do cliente depois da RPC. Para integração confiável, a emissão do evento deve ser backend-authoritative após a transação confirmada.
8. O OptmaPay já possui `transfer_pix` e `refund_pix` atômicos com vínculo de devolução, o que é uma boa base para testar pagamento e estorno ponta a ponta.

Conclusão: OptmaPay já é suficientemente real para virar o sandbox oficial do ecossistema, mas antes de o OptmaMenu confiar nele como provider externo é necessário endurecer autenticação de API, chaves, HMAC, webhook server-side e idempotência.

## Fidelidade — decisão de navegação para etapa posterior

Não manter dois itens irmãos `Fidelidade` e `Fidelidade avançada`.

A página canônica deverá ser uma única área **Fidelidade**, baseada na infraestrutura segura da página avançada, com abas internas:

1. Visão geral
2. Regras e pontuação
3. Níveis
4. Benefícios e prêmios
5. Clientes participantes
6. Ajustes / extrato
7. Bloqueios e reentrada
8. Termos e privacidade

A rota antiga `Fidelidade` contém componentes legados que ainda fazem acesso direto a tabelas. Eles não devem ser a base final. Funcionalidades úteis devem ser migradas para RPCs seguras e incorporadas como abas na página canônica.

Decisão registrada para bônus de reentrada:
- primeira adesão: bônus integral configurável;
- reentrada: `nenhum | percentual | fixo`;
- percentual sugerido como opção: 30%;
- carência configurável;
- para diferenciar reentrada de primeira adesão é necessário reter um marcador mínimo de participação anterior, o que exige decisão explícita de retenção/transparência antes de implementar.

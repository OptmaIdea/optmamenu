# Handoff segurança — limite de SMS por telefone (18/10/2026)

**Fronteira:** Frente Clientes/Autenticação/OTP, não modificar neste pacote de Vida do Produto.

## Relato do teste
O usuário atingiu o limite de 10 SMS por 24h para um telefone; por acesso administrativo ao Supabase alterou o campo `customer_otps.phone` de um registro histórico e conseguiu solicitar SMS novamente para o telefone original.

## Causa técnica confirmada
A função `public.issue_customer_otp_for_sms_safe` normaliza o telefone E.164 e faz `count(*)` na tabela `customer_otps` filtrando `store_id`, `phone` e `created_at`. Limites existentes:
- `>=3` solicitações em 10 minutos;
- `>=10` solicitações em 24 horas.

Alterar o telefone armazenado num registro que fazia parte da contagem altera o resultado do COUNT. Os registros operacionais de SMS não funcionam, assim, como ledger imutável de consumo.

**Limite da evidência:** alteração feita diretamente com poderes administrativos no banco. Isso **não demonstra** que um usuário comum pode alterar os dados e burlar o sistema.

## Proteções já verificadas
- `issue_customer_otp_for_sms_safe` e `mark_customer_otp_sms_delivery_safe` exigem `service_role`, sem EXECUTE para `anon` nem `authenticated`.
- RLS em `customer_otps` bloqueia UPDATE direto para `anon` e `authenticated`.

## Revisão de segurança proposta (não implementada)
1. Contador imutável separado do conteúdo mutável do OTP, incluindo telefone normalizado com hash/identificador seguro, loja, data/hora e contexto. Operadores não devem modificar a identidade contada por um simples UPDATE de OTP.
2. Idempotência e serialização por chave de cobrança/telefone antes de contar e emitir (evitar bypass por requisições concorrentes).
3. Controles complementares por dispositivo/origem/IP confiável e por loja, além de monitoramento de custo, lockout progressivo e mensagens amigáveis.
4. Para homologação, decidir limite maior **apenas** para telefones de teste previamente autorizados ou ambiente Sandbox: exemplo a avaliar 20 solicitações/24h, sem expor produção e sem enfraquecer a janela de 10 minutos. Melhor ainda é simulador SMS para testes automatizados.
5. Investigar troca de telefone legítima e exclusão de conta, que não podem apagar a trilha de consumo das últimas 24h.
6. Testar chamadas simultâneas, mudança de telefone via fluxo permitido, acesso anônimo/autenticado e bloqueio de UPDATE direto; não usar ou divulgar dados pessoais nos testes.

**Status:** diagnosticado; exige execução/validação da frente Clientes. Não atualizar produção sem plano de migração e aceite.

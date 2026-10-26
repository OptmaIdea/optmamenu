# S08/S09 — Pacote final de segurança de credenciais e ACLs (25/10/2026)

## Evidência técnica aplicada, não apenas planejada

- **S08 vault:** `20261025211710` aplicada ao Supabase do OptmaMenu; tabela em `private` com RLS habilitado e sem USAGE/SELECT de anon/authenticated.
- **S08 owner/status RPC:** `20261025211716` aplicada; owner cadastra/rotaciona/revoga sem revelar chave anterior; gerentes veem apenas status booleano. Serviço consulta segredo por RPC exclusiva service_role.
- **LogLunch:** chave existente preservada no cofre e conferida sem imprimir segredo. Gelinhares permanece usando fallback global quando o gateway próprio está desativado.
- **Edge Function:** `send-customer-otp-sms` versão **15**, ACTIVE, conteúdo idêntico ao branch S08; não lê mais `stores.sms_gateway_token`.
- **UI:** PR #23 integrado no commit `512dbe52a21d6b64ae552fb9ff215f3d3b975a25`. GitHub Actions completo SUCCESS, Vercel `dpl_8kjicHfoYQpy9Z2zBjj9Hvw63uEY` READY e HTML da Gelinhares HTTP 200.
- **S08 corte:** `20261025212734` aplicada somente após código da Edge e UI estarem publicados. Todas as 3 lojas têm `stores.sms_gateway_token IS NULL`. Trigger `stores_sms_gateway_token_no_plaintext` impede gravar plaintext por qualquer cliente antigo.
- **S09 ACL:** `20261025212614` aplicada. A contagem de SEC. DEFINER executáveis como `anon` caiu de **42 para 26**. 16 funções de uso administrativo passaram a exigir autenticação; `authenticated` e `service_role` preservados.
- Testes no PG17 para cofre, owner, gerente, leitor, duas lojas, rotação, atualização por cliente antigo e negação de 16 RPCs administrativas; código de checkout e pagamentos não foi alterado.

## Limites de aceitação

Não foram enviados SMS reais novos, cobrados pagamentos ou alterados pedidos. A análise automatizada de CI confirma compatibilidade de código, grants e API, mas **não substitui teste de login real em duas lojas**. A configuração atual da LogLunch e os logs anteriores de envio já foram observados antes do corte.

O Supabase Security Advisor ainda aponta RPCs públicas **legitimamente necessárias** para loja, checkout, token de pedido e pagamentos Sandbox, além de funções autenticadas cuja autorização é feita internamente. Tratar achados novos por risco, sem impedir o fechamento da frente Clientes.

**Atenção:** `public.stores.stock_password_hash` ainda é uma coluna com SELECT amplo para authenticated. Necessita alteração coordenada da validação de estoque e das funções que consomem hash; revogação indiscriminada pode quebrar entrada e ajuste de estoque. Não alegar que este risco esteja resolvido.

## Rollback

- Para código de frontend, reverter PR #23 é **incompatível** com a coluna antiga limpa; só reverter com rota de UI adaptada ao cofre.
- Para Edge, manter v15 ou superior que busca cofre. Nunca restaurar tokens em `public.stores` por SQL.
- Se gateway da LogLunch apresentar falha, inspeccionar status da chave no cofre e logs por loja, sem exibir valor. O envio não deve fazer fallback para outra conta.

# Clientes — Mensagens em lote e sincronização do carrinho após senha (19/10/2026)

## Aceite informado

- O e-mail transacional de alteração de senha foi entregue na Brevo com a logo da loja.
- O novo dispositivo pediu e recebeu OTP/SMS corretamente.
- Não reabrir cadastro, carrinho anônimo/autenticado, recuperação de senha ou fidelidade já homologados.

## Achados

### Mensagens

Já existia a RPC `mark_customer_self_notification_read_safe(uuid,boolean)` com `p_all=true`, restrita a `app_current_customer_id()` e `app_current_store_id()`. O botão já existia dentro da área Mensagens, mas aparecia somente em condições limitadas e sem feedback. No serviço, erros de RPC eram apenas logados: a interface marcava as mensagens como lidas mesmo com erro do servidor.

**Correção:** `CustomerService.markAsRead` e `markAllAsRead` passam a lançar falha quando a RPC não confirma `ok`. Na UI, o botão `Marcar todas como lidas` fica junto ao contador de não lidas, com estado desabilitado quando vazio, loading, toast amigável de sucesso/erro e atualização local somente após confirmação. Não muda mensagens nem permissões de outras lojas.

### Carrinho / access_denied

A rotina `get_customer_self_cart_draft_safe()` responde `access_denied` quando a identidade/relação sessão-dispositivo não está mais ativa. A redefinição ou alteração de senha revoga sessões para proteger os dados, e o sincronizador fazia polling a cada 5 segundos, podendo produzir warnings antes do heartbeat de 8 segundos detectar a revogação.

**Correção:** quando o carrinho recebe `access_denied` no polling, hidratação ou salvamento, chama `AuthService.checkSessionAlive()`. Se a sessão estiver confirmadamente revogada, interrompe timers e desativa a visualização do carrinho privado; o snapshot permanece vinculado à conta e só será restaurado após autenticação válida. Se a sessão continuar válida ou o estado for inconclusivo, mantém o aviso para investigação, sem mascarar defeitos reais. Não altera RLS/RPC do banco.

## Provas no Supabase (transações revertidas)

1. Dois titulares/lojas distintos e mensagens sintéticas: `p_all=true` de A alterou somente A; mensagem de B permaneceu não lida — **PASS**.
2. JWT contextual de sessão ativa: consulta de carrinho autorizada; revogação temporária da sessão na mesma transação fez a RPC responder `access_denied` — **PASS**.
3. Ambas as transações finalizaram em `ROLLBACK`, sem notificações nem revogações de teste persistidas.

## Roteiro manual curto

1. Em uma conta com mensagens não lidas, abrir `Minha conta → Mensagens`; botão visível ao lado do contador. Clicar e confirmar toast, badge zerado, persistência após reabrir e ausência de alterações em outra conta/loja.
2. Após mudança voluntária de senha, manter outro dispositivo aberto: deve receber informação amigável de sessão encerrada e perder acesso ao carrinho privado, **sem warning repetido** de `CUSTOMER_CART access_denied`. Após novo login validado por SMS, confirmar restauração do carrinho daquela conta.
3. Caso o warning continue **com a sessão válida**, capturar horário e stack: não é tratado como erro benigno.

## Limites

- O warning sozinho não prova vazamento de dados: nesse caso é uma resposta de bloqueio de acesso. Persistência do problema em sessão válida é bug e exige nova análise.
- Nenhuma mudança no backend, SMS, Fidelidade, Pagamentos ou Pedidos.

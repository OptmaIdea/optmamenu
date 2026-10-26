# P11 — Caixa de mensagens do Cliente utilizável sem riscos ao checkout

**26/10/2026** · Baseline `371aad3b11b76a2e9ac0791322e1eed6cec43399`, CI e Vercel READY.

## Pacote visível ao cliente

1. Busca por título e texto da mensagem, ignorando maiúsculas/acentos.
2. Filtro **Somente não lidas**, combinável com filtros de categoria e busca, com opção de limpar.
3. **Ações contextuais**: mensagem de pedido abre aba de pedidos do próprio cliente; fidelidade abre fidelidade; segurança abre segurança; perfil abre meus dados; marketing abre preferências. IDs e links contidos na mensagem **não são interpretados** como permissões ou rotas.
4. **Marcar como lida** explicitamente por mensagem, com indicação de processamento. A leitura só aparece após confirmação do servidor.
5. Resposta HTTP/RPC inválida não zera a caixa de mensagens: mostra aviso amigável, mantém mensagens anteriormente carregadas e oferece atualização manual.
6. Resposta de leitura atrasada após logout/troca de loja ou cliente não modifica a tela de outro titular.

## Fronteira de regressão

- Não alteradas Edge Functions, SQL, RLS, SMS/OTP, Auth, fornecedores, pedidos, cancelamentos, estoque, financeiro e OptmaPay.
- Filtragem executada somente no conjunto retornado pela RPC autocontextualizada `get_customer_self_notifications_safe` (JWT de cliente + loja) e limitada a 50 registros.
- Ações seguem as abas já existentes do Portal: não extraem IDs de pedidos do corpo da mensagem. 
- Testes: filtros, busca com acentos, destinos permitidos, rejeição de destino injetado e erros da RPC vs caixa realmente vazia.
- O CI valida a interface/serviço. A homologação manual deve confirmar categoria, busca, mark read, persistência após reabrir e botão de pedidos em uma conta de teste.

## Aceites anteriores preservados

- Bloqueio da exclusão com pedido ativo (aceito).
- Apelidos de dispositivos Cris persistem (aceito).
- Vida do Cliente em português (aceito).
- Login SMS, pedido e OptmaPay previamente homologados permanecem intocados.

Nota: o bloqueio de `stock_password_hash` é pendência de segurança separada; não deve induzir revogação genérica de colunas de stores nem regressão dos fluxos de estoque.

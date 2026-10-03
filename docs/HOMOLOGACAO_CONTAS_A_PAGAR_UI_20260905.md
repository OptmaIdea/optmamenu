# Block 2 — roteiro de homologação rápida

1. Acessar `/admin/accounts-payable` como owner/admin com `accounts_payable.view`.
2. Validar filtros de título e abertura do painel de detalhe.
3. Abrir `?tab=terms`, criar uma condição de teste como 30/60 e depois inativá-la.
4. Em uma compra com condição financeira, confirmar que o título aparece sem movimentar saldo.
5. Baixar parcialmente uma parcela escolhendo forma de pagamento e conta financeira.
6. Conferir a saída correspondente no Livro Diário/Conta Financeira.
7. Estornar a baixa e confirmar o movimento inverso, preservando o histórico.
8. Aplicar um abatimento e confirmar que `original_amount` permanece intacto e `net_amount` é ajustado.
9. Com usuário sem `accounts_payable.pay`, validar que o botão de baixa não aparece e que a RPC bloqueia a operação.
10. Repetir em modo escuro e mobile, verificando o contorno dos modais e o painel lateral.

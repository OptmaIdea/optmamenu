-- Teste transacional de referência do Bloco 1.
-- Executar somente em ambiente de homologação. A subtransação é revertida intencionalmente.
-- O teste real de 05/09/2026 utilizou os IDs da loja Gelinhares e retornou todos os asserts como true.

-- Critérios cobertos no teste executado:
-- 1. 30/60 gera duas parcelas e preserva o total.
-- 2. Vencimentos a partir de 05/09/2026: 05/10/2026 e 04/11/2026.
-- 3. Criar o título não cria movimento de caixa.
-- 4. Abatimento de R$ 100 em título de R$ 1.000 gera líquido R$ 900.
-- 5. Pagamento parcial de R$ 300 gera saldo total R$ 600.
-- 6. Pagamento acima do saldo da parcela falha.
-- 7. Estorno do pagamento zera o efeito líquido financeiro.
-- 8. Estorno do abatimento restaura R$ 1.000.
-- 9. Nova cotação do fornecedor sugere a condição recente 30/60.
-- 10. Resposta do fornecedor em 45 dias não sobrescreve a sugestão; torna-se proposta respondida.
-- 11. Ao aprovar/converter, a compra herda 45 dias, com vencimento em 20/10/2026.
-- 12. À vista gera uma parcela no próprio dia.
-- 13. Confirmar a compra sem alterar valor/condição preserva o ID da parcela.
-- 14. Pagamento integral encerra o título como paid.
-- 15. Título com pagamento confirmado não pode ser cancelado.
-- 16. Condição pertencente a outra loja é rejeitada.
-- 17. Staff sem permissão financeira não consegue operar o título.
-- 18. Após o rollback: zero documentos, cotações, títulos e movimentos de teste residuais.

-- Consultas de segurança executadas:
-- authenticated: SELECT=true, INSERT=false, UPDATE=false, DELETE=false em accounts_payable.
-- anon: SELECT=false em accounts_payable; EXECUTE=false em register_accounts_payable_payment_safe.
-- authenticated: EXECUTE=true na RPC de pagamento, sujeito à autorização interna.

select 'Este arquivo documenta os asserts transacionais executados em homologação; veja docs/COMPRAS_CONTAS_A_PAGAR_FUNDACAO_20260905.md.' as block_1_test_reference;

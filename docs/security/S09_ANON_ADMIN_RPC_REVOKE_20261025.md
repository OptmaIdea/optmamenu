# S09 — Retirar acesso anônimo a 16 RPCs administrativas

Data: 25/10/2026. Base de auditoria: Supabase `lgkkfmqzaorrutuoqeax`, 42 SECURITY DEFINER executáveis por anon e 318 por authenticated, antes desta etapa.

## Escopo

Estas 16 funções são relacionadas a operações administrativas: ajustes de vendas, gestão de pedidos, cotações, contas financeiras, calendário e pagamentos a fornecedores. O acesso anônimo era desnecessário para operadores autenticados. A migration altera **somente grants EXECUTE**, preservando assinatura, função, regras de negócio, dono, autenticação e permissões de service_role.

- `adjust_completed_sale_safe`
- `admin_dispatch_public_order_safe`
- `admin_dispatch_public_order_safe_internal_0d`
- `create_purchase_quotation`
- `create_store_financial_account_with_opening_safe`
- `delete_store_financial_calendar_exception_safe`
- `delete_store_financial_holiday_safe`
- `get_sale_adjustments_safe`
- `list_accounts_payable_due_alerts_safe`
- `list_financial_account_statement_safe`
- `list_store_financial_holidays_safe`
- `mark_purchase_quotations_expired_safe`
- `register_accounts_payable_payment_with_charges_safe`
- `save_store_financial_calendar_exception_safe`
- `save_store_financial_holiday_safe`
- `set_order_payment_finalization_account_safe`

## Proteções de regressão

Não revogar as funções de catálogo, loja pública, carrinho/checkout, link de pagamento, upload de comprovantes, pagamentos OptmaPay Sandbox e consulta pública de pedido por token. O fixture PostgreSQL 17 prova 16 negativas anônimas e preserva a execução dos demais papéis e uma função pública legítima.

Após aplicar, executar `get_advisors` e conferir queda esperada de 42 para 26. Isso **não** equivale a zerar a auditoria de todas as 318 RPCs autenticadas; essas operações exigem autorização específica por loja e podem ser legitimamente chamadas por administradores.

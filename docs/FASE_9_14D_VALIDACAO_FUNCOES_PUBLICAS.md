# Fase 9.14D — Validação das funções públicas intencionais

## Status

**Concluída funcionalmente.**

Esta frente auditou e ajustou funções públicas intencionais que permaneceram como `SECURITY DEFINER` executáveis por `anon` após a 9.14B e 9.14C.

---

## Base

Diagnóstico usado:

- `docs/sql_diagnostics/diagnose_advisors_914d_public_functions.sql`

Migration aplicada:

- `supabase/migrations/20260627211000_harden_public_customer_functions.sql`

---

## Resultado pós-migration

O diagnóstico confirmou o estado esperado.

### `cancel_reserved_public_order`

Estado final:

- `anon_can_execute=false`;
- `authenticated_can_execute=false`;
- `service_role_can_execute=true`.

Decisão:

- removida da superfície pública;
- mantida apenas para manutenção/uso operacional privilegiado;
- não foi concedida para `authenticated` nesta rodada.

Motivo:

- apesar do nome público, a própria função bloqueava uso real por `anon`;
- não havia uso direto identificado no frontend;
- o fluxo público de pedido continua sustentado por `create_public_order_by_slug`.

---

## Funções públicas preservadas

As funções abaixo permaneceram com:

- `anon_can_execute=true`;
- `authenticated_can_execute=false`;
- `service_role_can_execute=true`.

### Cliente/OTP/fidelidade

- `customer_login_with_password`;
- `send_customer_otp`;
- `verify_customer_otp`;
- `get_public_customer_loyalty_by_phone`.

### Loja pública/catálogo

- `get_store_by_slug`;
- `get_public_storefront_by_slug`;
- `get_public_catalog_by_slug`;
- `get_public_delivery_methods_by_slug`;
- `get_public_payment_methods_by_slug`;
- `get_public_sales_channels_by_slug`.

### Pedido público

- `create_public_order_by_slug`.

---

## Ajustes validados

### `get_store_by_slug`

Validação:

- passou a exigir `public_store_enabled=true`.

Impacto:

- evita retorno de loja por slug quando a loja pública estiver desabilitada;
- preserva compatibilidade da assinatura.

---

### `customer_login_with_password`

Validação:

- exige `public_store_enabled=true`;
- mantém normalização de telefone;
- mantém validação de senha por `crypt`;
- retorna payload reduzido de cliente.

Payload público preservado:

- `id`;
- `store_id`;
- `full_name`;
- `phone`;
- `is_whatsapp`;
- `contact_preference`;
- `loyalty_points`;
- `loyalty_tier`;
- `current_tier_id`;
- `loyalty_opt_in`;
- `status`.

---

### `send_customer_otp`

Validação:

- exige `public_store_enabled=true`;
- mantém rate limit lógico atual de 3 envios em 10 minutos por loja + telefone;
- substitui exceções de loja inválida por resposta genérica.

---

### `verify_customer_otp`

Validação:

- exige `public_store_enabled=true`;
- mantém limite de tentativas por OTP;
- retorna payload reduzido de cliente;
- preserva comportamento de novo cliente quando OTP é válido e cliente ainda não existe.

---

### `get_public_customer_loyalty_by_phone`

Validação:

- mantém exigência de `public_store_enabled=true`;
- remove exposição de `customer.id`;
- remove exposição de `order_id`;
- remove transações detalhadas recentes;
- preserva consulta pública de pontos, programa e níveis.

Payload público final:

- últimos 4 dígitos do telefone;
- opt-in de fidelidade;
- última atividade de pontos;
- dados do programa ativo;
- pontos;
- nível atual;
- próximo nível;
- `recent_transactions` vazio por compatibilidade.

---

### `create_public_order_by_slug`

Validação:

- permaneceu pública sem alteração nesta rodada.

Motivo:

- já exige loja pública habilitada;
- valida canal público;
- valida método de entrega público;
- valida método de pagamento público;
- calcula valores no servidor;
- valida itens/produtos/estoque;
- sustenta o fluxo central do pedido online.

Ponto futuro:

- avaliar rate limit lógico e mensagens genéricas para erros inesperados em rodada própria.

---

## Resultado esperado nos Advisors

Após refresh dos Advisors:

- o warning de `cancel_reserved_public_order` como função executável por `anon` deve desaparecer;
- os warnings das funções públicas intencionais devem permanecer, mas agora documentados e com payload/escopo reforçados;
- os warnings de funções executáveis por `authenticated` permanecem fora do escopo desta frente.

---

## Fora do escopo

- Remover `anon` das funções públicas realmente necessárias;
- mexer em `create_public_order_by_slug`;
- criar rate limit por IP;
- criar sessão/token próprio de cliente;
- tratar warnings `authenticated_security_definer_function_executable`;
- mexer em Advisors de performance/sugestões.

---

## Próxima etapa recomendada

### 9.14E — Auditoria de funções `SECURITY DEFINER` autenticadas

Objetivo:

- separar funções autenticadas intencionais de funções internas que podem perder `authenticated`;
- classificar por módulo;
- evitar revogação em massa;
- tratar apenas funções com baixo risco primeiro.

Também há 2 sugestões do Advisor a avaliar em rodada separada, após estabilizar segurança funcional.

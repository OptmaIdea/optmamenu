# Fase 9.14D — Classificação das funções públicas intencionais

## Status

**Classificação concluída, com ajustes pontuais recomendados.**

Este documento registra a leitura do resultado de `docs/sql_diagnostics/diagnose_advisors_914d_public_functions.sql`.

---

## Resultado analisado

O diagnóstico retornou as definições das funções públicas intencionais que permanecem com:

- `anon_can_execute=true`;
- `authenticated_can_execute=false`;
- `service_role_can_execute=true`.

Essas funções aparecem como WARN no Advisor porque são `SECURITY DEFINER` executáveis por `anon`.

---

## Classificação final

### 1. Manter pública sem alteração estrutural

Funções de consulta pública com bom escopo atual:

- `get_public_catalog_by_slug(p_slug text)`;
- `get_public_delivery_methods_by_slug(p_slug text)`;
- `get_public_payment_methods_by_slug(p_slug text)`;
- `get_public_sales_channels_by_slug(p_slug text)`;
- `get_public_storefront_by_slug(p_slug text)`.

Motivo:

- filtram loja por `slug`;
- exigem `public_store_enabled=true`;
- quando aplicável, exigem recursos ativos e `public_enabled=true`;
- retornam dados esperados no fluxo público da loja.

Observação:

- `get_public_storefront_by_slug` retorna textos legais, visual_config e WhatsApp. Isso é intencional para a loja pública, mas deve continuar documentado como payload público.

---

### 2. Manter pública com ajuste interno

#### `get_store_by_slug(p_slug text)`

Achado:

- retorna loja por slug sem exigir `public_store_enabled=true`;
- retorna `address`, `contacts` e `config`;
- não apareceu uso direto atual no frontend;
- existe função mais adequada para a loja pública: `get_public_storefront_by_slug`.

Decisão:

- manter assinatura por compatibilidade;
- restringir para lojas com `public_store_enabled=true`;
- não ampliar payload;
- considerar deprecar no futuro.

---

#### `customer_login_with_password(p_phone text, p_password text, p_store_id uuid)`

Achados:

- normaliza telefone;
- valida existência de loja por `id`, mas não exige loja pública habilitada;
- retorna `to_jsonb(v_customer) - 'password_hash'`, expondo mais campos do que o necessário para um login público.

Decisão:

- exigir `public_store_enabled=true`;
- retornar payload reduzido de cliente público;
- manter `anon` por ser login de cliente público.

---

#### `send_customer_otp(p_phone text, p_store_id uuid)`

Achados:

- normaliza telefone;
- possui limite de 3 OTPs em 10 minutos;
- valida existência da loja, mas não exige loja pública habilitada;
- usa exceções para alguns erros de entrada.

Decisão:

- exigir `public_store_enabled=true`;
- manter `anon` por ser fluxo público de OTP;
- manter rate limit atual;
- em rodada posterior, considerar resposta genérica em vez de exception para todos os erros públicos.

---

#### `verify_customer_otp(p_phone text, p_otp text, p_store_id uuid)`

Achados:

- normaliza telefone e OTP;
- limita tentativas por registro OTP;
- valida existência da loja, mas não exige loja pública habilitada;
- retorna cliente quase inteiro, removendo apenas `password_hash`.

Decisão:

- exigir `public_store_enabled=true`;
- retornar payload reduzido de cliente público;
- manter `anon` por ser fluxo público de OTP.

---

#### `get_public_customer_loyalty_by_phone(p_slug text, p_phone text)`

Achados:

- exige `public_store_enabled=true`;
- consulta cliente por telefone;
- retorna nome do cliente, id do cliente, pontos, tier e transações recentes;
- transações recentes incluem `order_id`.

Decisão:

- manter `anon` por ser consulta pública de fidelidade por telefone;
- reduzir o payload para não expor `customer.id`, `order_id` e lista de transações detalhadas;
- manter apenas dados necessários ao card público de fidelidade: opt-in, últimos 4 dígitos, pontos e níveis.

---

### 3. Revogar `anon`

#### `cancel_reserved_public_order(p_order_id uuid, p_reason text)`

Achados:

- apesar do nome público, a função bloqueia chamadas reais de `anon` porque exige `auth.uid()` e `is_store_member(v_order.store_id)` quando `auth.role()` é `anon` ou `authenticated`;
- `authenticated_can_execute=false` no diagnóstico;
- não apareceu uso direto atual no frontend;
- existem funções administrativas de cancelamento de pedido público.

Decisão:

- revogar `anon` e `PUBLIC`;
- não conceder `authenticated` nesta rodada;
- manter apenas `service_role`/postgres para manutenção, salvo futura necessidade explícita.

---

### 4. Manter pública sem ajuste nesta rodada

#### `create_public_order_by_slug(...)`

Achados positivos:

- exige slug;
- exige carrinho não vazio;
- valida canal público ativo;
- exige loja com `public_store_enabled=true`;
- valida método de entrega público ativo;
- valida método de pagamento público ativo;
- calcula valores no servidor;
- valida produtos ativos e estoque;
- cria cliente e pedido reservado;
- usa token público do pedido.

Pontos de atenção futuros:

- resposta de erro genérica no bloco `EXCEPTION` ainda inclui `SQLERRM`;
- criação pública de pedido pode exigir rate limit lógico por telefone/IP no futuro;
- manter auditoria posterior de abuso operacional.

Decisão:

- manter pública nesta rodada;
- não alterar para evitar regressão no pedido online.

---

## Migration recomendada

Criar migration pontual para:

1. restringir `get_store_by_slug` a lojas públicas;
2. reduzir payload de cliente em `customer_login_with_password`;
3. exigir loja pública em `customer_login_with_password`;
4. exigir loja pública em `send_customer_otp`;
5. exigir loja pública em `verify_customer_otp`;
6. reduzir payload de cliente em `verify_customer_otp`;
7. reduzir payload de fidelidade em `get_public_customer_loyalty_by_phone`;
8. revogar `anon`/`PUBLIC` de `cancel_reserved_public_order`.

---

## Fora do escopo

- mexer em `create_public_order_by_slug` nesta rodada;
- remover `anon` das funções de catálogo/loja pública;
- tratar WARNs `authenticated_security_definer_function_executable`;
- adicionar rate limit por IP;
- criar sessão/token próprio de cliente.

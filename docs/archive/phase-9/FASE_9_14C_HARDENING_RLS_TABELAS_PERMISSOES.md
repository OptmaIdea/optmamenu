# Fase 9.14C — Hardening RLS das tabelas de permissões

## Status

**Concluída funcionalmente.**

Esta frente tratou os alertas `RLS Disabled in Public` apontados pelo Advisor para tabelas públicas de permissões.

---

## Tabelas tratadas

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

---

## Diagnóstico inicial

As duas tabelas estavam com:

- `rls_enabled=false`;
- `policies=[]`;
- grants diretos amplos para `anon`;
- grants diretos amplos para `authenticated`;
- grants para `service_role`;
- grants para `postgres`.

Privilégios expostos para `anon` e `authenticated` antes da correção:

- `SELECT`;
- `INSERT`;
- `UPDATE`;
- `DELETE`;
- `TRUNCATE`;
- `REFERENCES`;
- `TRIGGER`.

Contagem de registros:

- `store_permission_catalog`: 101 registros;
- `store_role_permission_templates_backup_910c`: 1008 registros.

---

## Conferência de uso no repositório

A busca no repositório não indicou uso direto das tabelas pelo frontend.

O acesso funcional ao catálogo e à matriz de permissões ocorre por RPCs `SECURITY DEFINER` controladas na 9.14B, como:

- `get_store_permission_catalog`;
- `get_store_permission_matrix`;
- `get_store_permission_matrix_v3`.

A tabela backup `store_role_permission_templates_backup_910c` apareceu apenas em documentação/diagnóstico, sem uso funcional direto identificado.

---

## Migration aplicada

Arquivo:

- `supabase/migrations/20260627205000_harden_permission_catalog_tables_rls.sql`

Escopo:

- habilitar RLS nas duas tabelas;
- revogar grants diretos de `anon`;
- revogar grants diretos de `authenticated`;
- revogar grants diretos de `PUBLIC`;
- preservar grants para `service_role`;
- não remover a tabela backup nesta etapa.

---

## Validação pós-migration

Após aplicação da migration, o diagnóstico confirmou:

### `store_permission_catalog`

- `rls_enabled=true`;
- `policies=[]`;
- grants diretos apenas para:
  - `postgres`;
  - `service_role`;
- sem grants diretos para:
  - `anon`;
  - `authenticated`.

### `store_role_permission_templates_backup_910c`

- `rls_enabled=true`;
- `policies=[]`;
- grants diretos apenas para:
  - `postgres`;
  - `service_role`;
- sem grants diretos para:
  - `anon`;
  - `authenticated`.

---

## Decisão sobre policies

Não foram criadas policies para essas tabelas nesta etapa.

Motivo:

- não há necessidade de acesso direto por `anon` ou `authenticated`;
- o acesso operacional deve ocorrer por RPCs controladas ou `service_role`;
- ausência de policy com RLS ativo bloqueia acesso direto por roles comuns.

---

## Fora do escopo

- Remover fisicamente `store_role_permission_templates_backup_910c`;
- mover backup para outro schema;
- mudar comportamento das RPCs de permissões;
- alterar UI de permissões;
- revisar funções públicas intencionais da loja pública.

---

## Resultado esperado nos Advisors

Os erros `RLS Disabled in Public` para:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`;

devem desaparecer após refresh dos Advisors.

---

## Próxima etapa recomendada

### 9.14D — Auditoria de funções públicas intencionais

Escopo sugerido:

- `get_store_by_slug`;
- `get_public_storefront_by_slug`;
- `get_public_catalog_by_slug`;
- `get_public_delivery_methods_by_slug`;
- `get_public_payment_methods_by_slug`;
- `get_public_sales_channels_by_slug`;
- `get_public_customer_loyalty_by_phone`;
- `create_public_order_by_slug`;
- `cancel_reserved_public_order`;
- `send_customer_otp`;
- `customer_login_with_password`.

Objetivo:

- manter `anon` apenas onde o uso público for realmente necessário;
- auditar dados expostos;
- auditar validações de slug/store/status;
- auditar dados sensíveis;
- registrar exceções públicas intencionais no documento de segurança.

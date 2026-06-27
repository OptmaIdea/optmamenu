# Fase 9.14A — Diagnóstico Advisors/RLS e classificação de funções

## Status

**Aberta para diagnóstico.**

Esta frente inicia a rodada própria de Advisors/RLS/hardening Supabase após o fechamento funcional da Fase 9.

A etapa 9.14A é apenas diagnóstica e documental. Não deve aplicar migrations de correção ainda.

---

## Diretriz principal

- Não misturar hardening Supabase com novas funcionalidades.
- Não alterar comportamento funcional validado sem diagnóstico prévio.
- Sempre desconsiderar o aviso `Leaked Password Protection Disabled`, conforme registrado em `docs/ADVISORS.md`.
- Separar funções públicas intencionais de funções privadas/internas que apenas estão expostas por grant padrão.

---

## Base analisada

Arquivo analisado:

- `docs/ADVISORS.md`

Commit informado como referência:

- `318cb4f782c7c7804d9be92ff07d269737161405`

---

## Achados principais

### 1. RLS Disabled in Public — ERROR

Tabelas apontadas:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

Leitura inicial:

- `store_permission_catalog` é ativa e alimenta o catálogo/matriz de permissões; precisa de RLS/policies ou encapsulamento seguro.
- `store_role_permission_templates_backup_910c` aparenta ser tabela backup/legado; candidata a remoção, arquivamento fora do schema exposto ou RLS fechado, mas antes precisa confirmação de uso.

---

### 2. SECURITY DEFINER executável por anon — WARN

O Advisor lista várias funções `SECURITY DEFINER` que podem ser chamadas por `anon` via `/rest/v1/rpc/...`.

A correção não deve ser um `REVOKE` cego em massa, porque algumas funções são públicas por design, como loja pública, catálogo por slug, OTP/login de cliente e pedido público.

---

## Classificação inicial

### A. Admin/privadas — candidatas a `authenticated` apenas

Exemplos identificados:

- `can_access_security_section`;
- `can_access_security_section_v3`;
- `can_access_settings_section`;
- `can_access_settings_section_v3`;
- `get_default_admin_landing_path_v3`;
- `get_effective_store_member_permissions_v2`;
- `get_login_store_options`;
- `get_my_visible_activity_logs`;
- `get_store_permission_matrix`;
- `get_store_permission_matrix_v3`;
- `get_store_security_activity_logs`;
- `get_store_security_settings`;
- `get_store_settings_center`;
- `update_security_log_member_visibility`;
- `update_store_identity_settings`;
- `update_store_idle_timeout_settings`;
- `update_store_member_permissions`;
- `update_store_role_permission_template`;
- `update_store_settings_section`.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter ou conceder `EXECUTE` para `authenticated`;
- preservar validações internas existentes por `auth.uid()`, vínculo e permissões granulares.

---

### B. Públicas intencionais — manter `anon`, mas auditar validações

Exemplos identificados:

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

Direção provável:

- manter `anon` quando for necessário ao fluxo público;
- auditar validações internas, rate limit lógico, escopo por slug/store e exposição de dados;
- documentar explicitamente como exceções intencionais.

---

### C. Internas/técnicas — candidatas a remoção de `anon`

Exemplos identificados:

- `register_store_permission_v3`;
- `seed_store_role_permissions_for_new_store_v3`;
- `sync_permission_catalog_v3`;
- `touch_store_permission_version`;
- `trg_touch_store_permission_version`;
- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`.

Direção provável:

- revogar `EXECUTE` de `anon`;
- avaliar se devem ficar apenas para `service_role`/owner de banco ou `authenticated` com validação forte;
- confirmar se são chamadas por frontend ou apenas por migrations/triggers/RPCs internas.

---

### D. Casos dependentes de uso

Exemplo:

- `validate_store_slug`.

Direção:

- se for usado em cadastro público/autocadastro de loja, pode precisar `anon`;
- se for usado apenas em Configurações/Admin, deve ser `authenticated`.

---

## Riscos de alteração sem diagnóstico

- Quebrar loja pública por slug.
- Quebrar pedido público.
- Quebrar OTP/login de cliente.
- Quebrar escolha de loja no login.
- Quebrar matriz de permissões/admin.
- Quebrar atualizações de Configurações.
- Reduzir warnings, mas criar regressões funcionais.

Por isso a 9.14A não deve aplicar migrations corretivas imediatamente.

---

## Plano da 9.14A

1. Criar SQL diagnóstico para listar:
   - funções `SECURITY DEFINER`;
   - grants por role (`anon`, `authenticated`, `service_role`);
   - assinatura e linguagem;
   - se aparecem no Advisor;
   - classificação proposta.
2. Criar SQL diagnóstico para RLS:
   - tabelas públicas sem RLS;
   - policies existentes;
   - grants diretos;
   - contagem aproximada de linhas;
   - possíveis dependências.
3. Gerar relatório de classificação.
4. Só depois propor migrations pequenas:
   - 9.14B para RLS/tabelas óbvias;
   - 9.14C para revogar anon de funções admin/internas;
   - 9.14D para auditar exceções públicas intencionais.

---

## Critérios de aceite da 9.14A

- Documento da frente criado.
- SQL diagnóstico criado.
- Sem migration corretiva aplicada.
- Funções classificadas por grupo inicial.
- Próxima rodada definida com baixo risco.

---

## Próxima ação

Rodar os diagnósticos SQL no Supabase e enviar os resultados para classificação final antes de qualquer migration de correção.

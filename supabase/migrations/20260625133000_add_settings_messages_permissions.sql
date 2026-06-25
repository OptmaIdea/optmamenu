-- Fase 9.13.1I — Configurações de Mensagens e Atendimento
-- Adiciona permissões específicas para a aba Configurações da Loja → Mensagens.
--
-- Escopo desta migration:
-- - criar/atualizar `settings.messages.view` e `settings.messages.manage` em `store_permission_catalog`;
-- - popular `store_role_permission_templates` por loja/papel;
-- - atualizar `store_permission_versions` para acionar realtime.
--
-- Não altera RLS, Advisors, RPCs ou tabelas estruturais.

BEGIN;

CREATE TEMP TABLE _settings_messages_permissions (
    permission_key text PRIMARY KEY,
    module text,
    action text,
    label text,
    description text,
    risk_level text,
    active boolean,
    sort_order integer,
    macro_group text,
    group_key text,
    group_label text,
    item_key text,
    item_label text,
    action_key text,
    action_label text,
    depends_on text,
    access_permission_key text,
    ui_sort_order integer,
    show_in_permission_ui boolean
) ON COMMIT DROP;

INSERT INTO _settings_messages_permissions (
    permission_key,
    module,
    action,
    label,
    description,
    risk_level,
    active,
    sort_order,
    macro_group,
    group_key,
    group_label,
    item_key,
    item_label,
    action_key,
    action_label,
    depends_on,
    access_permission_key,
    ui_sort_order,
    show_in_permission_ui
)
VALUES
    (
        'settings.messages.view',
        'settings',
        'view',
        'Ver Mensagens e Atendimento',
        'Permite visualizar as configurações de mensagens operacionais e atendimento da loja.',
        'medium',
        true,
        80,
        'settings',
        'settings',
        'Configurações',
        'messages',
        'Mensagens',
        'view',
        'Acessar',
        null,
        null,
        80,
        true
    ),
    (
        'settings.messages.manage',
        'settings',
        'manage',
        'Gerenciar Mensagens e Atendimento',
        'Permite alterar textos de atendimento, mensagens operacionais, consentimento e integração de mensagens da loja.',
        'high',
        true,
        81,
        'settings',
        'settings',
        'Configurações',
        'messages',
        'Mensagens',
        'manage',
        'Gerenciar',
        'settings.messages.view',
        'settings.messages.view',
        81,
        true
    );

-- Upsert defensivo no catálogo.
-- Usa apenas colunas que existem no schema atual de `store_permission_catalog`.
DO $$
DECLARE
    r record;
    payload jsonb;
    insert_columns text;
    insert_values text;
    update_sets text;
BEGIN
    FOR r IN SELECT * FROM _settings_messages_permissions LOOP
        payload := jsonb_build_object(
            'permission_key', r.permission_key,
            'module', r.module,
            'action', r.action,
            'label', r.label,
            'description', r.description,
            'risk_level', r.risk_level,
            'active', r.active,
            'sort_order', r.sort_order,
            'macro_group', r.macro_group,
            'group_key', r.group_key,
            'group_label', r.group_label,
            'item_key', r.item_key,
            'item_label', r.item_label,
            'action_key', r.action_key,
            'action_label', r.action_label,
            'depends_on', r.depends_on,
            'access_permission_key', r.access_permission_key,
            'ui_sort_order', r.ui_sort_order,
            'show_in_permission_ui', r.show_in_permission_ui,
            'created_at', now(),
            'updated_at', now()
        );

        SELECT
            string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
            string_agg(format('($1 ->> %L)::%s', a.attname, format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY a.attnum),
            string_agg(format('%I = EXCLUDED.%I', a.attname, a.attname), ', ' ORDER BY a.attnum)
        INTO insert_columns, insert_values, update_sets
        FROM pg_attribute a
        WHERE a.attrelid = 'public.store_permission_catalog'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname IN (
              'permission_key',
              'module',
              'action',
              'label',
              'description',
              'risk_level',
              'active',
              'sort_order',
              'macro_group',
              'group_key',
              'group_label',
              'item_key',
              'item_label',
              'action_key',
              'action_label',
              'depends_on',
              'access_permission_key',
              'ui_sort_order',
              'show_in_permission_ui',
              'created_at',
              'updated_at'
          );

        SELECT
            string_agg(format('%I = EXCLUDED.%I', a.attname, a.attname), ', ' ORDER BY a.attnum)
        INTO update_sets
        FROM pg_attribute a
        WHERE a.attrelid = 'public.store_permission_catalog'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname IN (
              'module',
              'action',
              'label',
              'description',
              'risk_level',
              'active',
              'sort_order',
              'macro_group',
              'group_key',
              'group_label',
              'item_key',
              'item_label',
              'action_key',
              'action_label',
              'depends_on',
              'access_permission_key',
              'ui_sort_order',
              'show_in_permission_ui',
              'updated_at'
          );

        IF insert_columns IS NULL OR insert_values IS NULL THEN
            RAISE EXCEPTION 'Não foi possível mapear colunas de store_permission_catalog.';
        END IF;

        EXECUTE format(
            'INSERT INTO public.store_permission_catalog (%s) SELECT %s ON CONFLICT (permission_key) DO UPDATE SET %s',
            insert_columns,
            insert_values,
            COALESCE(update_sets, 'permission_key = EXCLUDED.permission_key')
        ) USING payload;
    END LOOP;
END $$;

CREATE TEMP TABLE _settings_messages_role_defaults (
    role text,
    permission_code text,
    allowed boolean
) ON COMMIT DROP;

-- Padrão inicial conservador:
-- owner/admin/manager gerenciam; sales e viewer visualizam; demais papéis não recebem por padrão.
INSERT INTO _settings_messages_role_defaults (role, permission_code, allowed)
VALUES
    ('owner', 'settings.messages.view', true),
    ('owner', 'settings.messages.manage', true),
    ('admin', 'settings.messages.view', true),
    ('admin', 'settings.messages.manage', true),
    ('manager', 'settings.messages.view', true),
    ('manager', 'settings.messages.manage', true),
    ('sales', 'settings.messages.view', true),
    ('sales', 'settings.messages.manage', false),
    ('viewer', 'settings.messages.view', true),
    ('viewer', 'settings.messages.manage', false),
    ('cashier', 'settings.messages.view', false),
    ('cashier', 'settings.messages.manage', false),
    ('stock_operator', 'settings.messages.view', false),
    ('stock_operator', 'settings.messages.manage', false),
    ('staff', 'settings.messages.view', false),
    ('staff', 'settings.messages.manage', false);

-- Recria apenas os templates das duas permissões novas para todas as lojas.
DELETE FROM public.store_role_permission_templates
WHERE permission_code IN ('settings.messages.view', 'settings.messages.manage');

DO $$
DECLARE
    r record;
    payload jsonb;
    insert_columns text;
    insert_values text;
BEGIN
    FOR r IN
        SELECT
            s.id AS store_id,
            d.role,
            d.permission_code,
            d.allowed
        FROM public.stores s
        CROSS JOIN _settings_messages_role_defaults d
    LOOP
        payload := jsonb_build_object(
            'store_id', r.store_id,
            'role', r.role,
            'permission_code', r.permission_code,
            'allowed', r.allowed,
            'created_at', now(),
            'updated_at', now()
        );

        SELECT
            string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
            string_agg(format('($1 ->> %L)::%s', a.attname, format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY a.attnum)
        INTO insert_columns, insert_values
        FROM pg_attribute a
        WHERE a.attrelid = 'public.store_role_permission_templates'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname IN (
              'store_id',
              'role',
              'permission_code',
              'allowed',
              'created_at',
              'updated_at'
          );

        IF insert_columns IS NULL OR insert_values IS NULL THEN
            RAISE EXCEPTION 'Não foi possível mapear colunas de store_role_permission_templates.';
        END IF;

        EXECUTE format(
            'INSERT INTO public.store_role_permission_templates (%s) SELECT %s',
            insert_columns,
            insert_values
        ) USING payload;
    END LOOP;
END $$;

-- Atualiza versão central de permissões para acionar realtime.
INSERT INTO public.store_permission_versions (store_id, version, reason, changed_by, changed_at)
SELECT
    s.id,
    1,
    'settings.messages permissions added',
    null,
    now()
FROM public.stores s
ON CONFLICT (store_id) DO UPDATE
SET
    version = public.store_permission_versions.version + 1,
    reason = EXCLUDED.reason,
    changed_by = null,
    changed_at = now();

COMMIT;

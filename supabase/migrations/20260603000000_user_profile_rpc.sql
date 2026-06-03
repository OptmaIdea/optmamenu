-- Migration to create/update user profile RPC and get_current_user_security_context_v2

-- 0. Ensure profiles table has all necessary fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS internal_alias TEXT,
ADD COLUMN IF NOT EXISTS mobile_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
ADD COLUMN IF NOT EXISTS birthdate DATE,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 1. Create update_current_user_profile function
CREATE OR REPLACE FUNCTION public.update_current_user_profile(
    p_name TEXT DEFAULT NULL,
    p_internal_alias TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_mobile_phone TEXT DEFAULT NULL,
    p_whatsapp_phone TEXT DEFAULT NULL,
    p_birthdate DATE DEFAULT NULL,
    p_zip_code TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_address_number TEXT DEFAULT NULL,
    p_complement TEXT DEFAULT NULL,
    p_district TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_instagram_url TEXT DEFAULT NULL,
    p_facebook_url TEXT DEFAULT NULL,
    p_website_url TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_cpf TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    -- CPF check: empty CPF -> can fill once. filled CPF -> modification is blocked for the user
    SELECT cpf INTO v_current_cpf FROM public.profiles WHERE id = v_user_id;

    IF p_cpf IS NOT NULL AND p_cpf <> '' THEN
        IF v_current_cpf IS NOT NULL AND v_current_cpf <> '' AND v_current_cpf <> p_cpf THEN
            RAISE EXCEPTION 'A alteração de CPF exige permissão administrativa.';
        END IF;
    END IF;

    UPDATE public.profiles
    SET
        name = COALESCE(p_name, name),
        internal_alias = COALESCE(p_internal_alias, internal_alias),
        phone = COALESCE(p_phone, phone),
        mobile_phone = COALESCE(p_mobile_phone, mobile_phone),
        whatsapp_phone = COALESCE(p_whatsapp_phone, whatsapp_phone),
        birthdate = COALESCE(p_birthdate, birthdate),
        zip_code = COALESCE(p_zip_code, zip_code),
        address = COALESCE(p_address, address),
        address_number = COALESCE(p_address_number, address_number),
        complement = COALESCE(p_complement, complement),
        district = COALESCE(p_district, district),
        city = COALESCE(p_city, city),
        state = COALESCE(p_state, state),
        instagram_url = COALESCE(p_instagram_url, instagram_url),
        facebook_url = COALESCE(p_facebook_url, facebook_url),
        website_url = COALESCE(p_website_url, website_url),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        cpf = COALESCE(p_cpf, cpf),
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. Recreate get_current_user_security_context_v2 function to include profile avatar, name, and internal_alias details
CREATE OR REPLACE FUNCTION public.get_current_user_security_context_v2()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_profile JSONB;
    v_memberships JSONB;
    v_primary_membership JSONB;
    v_has_pin BOOLEAN;
    v_is_global_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'authenticated', false,
            'user_id', null,
            'email', null,
            'profile', null,
            'memberships', '[]'::jsonb,
            'primary_membership', null,
            'has_pin', false,
            'is_global_admin', false
        );
    END IF;

    -- Get user email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    -- Get profile details
    SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'phone', p.phone,
        'cpf', p.cpf,
        'city', p.city,
        'is_admin', COALESCE(p.is_admin, false),
        'is_active', COALESCE(p.is_active, true),
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'profile_avatar_url', p.avatar_url,
        'avatar_url', p.avatar_url,
        'internal_alias', p.internal_alias,
        'profile_name', p.name,
        'profile_internal_alias', p.internal_alias
    ) INTO v_profile
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- Check if user has a PIN
    v_has_pin := EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_user_id AND (is_admin = true)
    );

    v_is_global_admin := COALESCE((v_profile->>'is_admin')::BOOLEAN, false);

    -- Get memberships
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'member_id', m.id,
        'store_id', m.store_id,
        'store_name', s.name,
        'store_slug', s.slug,
        'store_logo_url', s.logo_url,
        'role', m.role,
        'status', m.status,
        'permissions', COALESCE(m.permissions, '{}'::jsonb),
        'sensitive_actions', COALESCE(m.sensitive_actions, '{}'::jsonb),
        'is_owner', (m.role = 'owner'),
        'is_primary_owner', COALESCE(m.is_primary_owner, false),
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'profile_avatar_url', p.avatar_url,
        'avatar_url', p.avatar_url,
        'profile_name', p.name,
        'profile_internal_alias', p.internal_alias
    )), '[]'::jsonb) INTO v_memberships
    FROM public.store_members m
    JOIN public.stores s ON s.id = m.store_id
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.user_id = v_user_id AND m.status = 'active';

    -- Find primary membership
    SELECT jsonb_build_object(
        'member_id', m.id,
        'store_id', m.store_id,
        'store_name', s.name,
        'store_slug', s.slug,
        'store_logo_url', s.logo_url,
        'role', m.role,
        'status', m.status,
        'permissions', COALESCE(m.permissions, '{}'::jsonb),
        'sensitive_actions', COALESCE(m.sensitive_actions, '{}'::jsonb),
        'is_owner', (m.role = 'owner'),
        'is_primary_owner', COALESCE(m.is_primary_owner, false),
        'created_at', m.created_at,
        'updated_at', m.updated_at,
        'profile_avatar_url', p.avatar_url,
        'avatar_url', p.avatar_url,
        'profile_name', p.name,
        'profile_internal_alias', p.internal_alias
    ) INTO v_primary_membership
    FROM public.store_members m
    JOIN public.stores s ON s.id = m.store_id
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.user_id = v_user_id AND m.status = 'active'
    ORDER BY (m.role = 'owner') DESC, m.created_at ASC
    LIMIT 1;

    RETURN jsonb_build_object(
        'authenticated', true,
        'user_id', v_user_id,
        'email', v_email,
        'profile', v_profile,
        'memberships', v_memberships,
        'primary_membership', v_primary_membership,
        'has_pin', COALESCE(v_has_pin, false),
        'is_global_admin', COALESCE(v_is_global_admin, false)
    );
END;
$$;

-- Migration: create_store_rpc
-- Description: Função RPC segura para criação de lojas
-- Date: 2026-02-23

CREATE OR REPLACE FUNCTION public.create_store(
    p_user_id UUID,
    p_name TEXT,
    p_slug TEXT,
    p_phone_number TEXT DEFAULT NULL,
    p_doc_type TEXT DEFAULT 'PF',
    p_legal_name TEXT DEFAULT NULL,
    p_document TEXT DEFAULT NULL,
    p_fantasy_name TEXT DEFAULT NULL,
    p_consents JSONB DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    slug TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    -- Validar permissões
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Validar slug único
    IF EXISTS (SELECT 1 FROM stores WHERE slug = p_slug) THEN
        RAISE EXCEPTION 'Este link da loja (slug) já está em uso. Escolha outro.';
    END IF;

    -- Inserir nova loja
    INSERT INTO stores (
        user_id,
        name,
        slug,
        phone_number,
        doc_type,
        legal_name,
        document,
        fantasy_name,
        consents,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_name,
        p_slug,
        p_phone_number,
        p_doc_type,
        p_legal_name,
        p_document,
        p_fantasy_name,
        p_consents,
        NOW(),
        NOW()
    ) RETURNING id INTO v_store_id;

    -- Retornar dados da loja criada
    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.name,
        s.slug,
        s.created_at
    FROM stores s
    WHERE s.id = v_store_id;
END;
$$;

-- Revogar acesso público
REVOKE EXECUTE ON FUNCTION public.create_store FROM PUBLIC;

-- Conceder acesso apenas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_store TO authenticated;

COMMENT ON FUNCTION public.create_store IS 'Cria uma nova loja para o usuário autenticado com validação de slug único';

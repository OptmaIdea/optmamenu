CREATE OR REPLACE FUNCTION public.update_current_user_profile(
  p_name text,
  p_internal_alias text,
  p_phone text,
  p_mobile_phone text,
  p_whatsapp_phone text,
  p_cpf text DEFAULT NULL::text,
  p_birthdate date DEFAULT NULL::date,
  p_zip_code text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_address_number text DEFAULT NULL::text,
  p_complement text DEFAULT NULL::text,
  p_district text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text,
  p_instagram_url text DEFAULT NULL::text,
  p_facebook_url text DEFAULT NULL::text,
  p_website_url text DEFAULT NULL::text
)
RETURNS TABLE(
  user_id uuid,
  name text,
  internal_alias text,
  phone text,
  mobile_phone text,
  whatsapp_phone text,
  cpf text,
  birthdate date,
  zip_code text,
  address text,
  address_number text,
  complement text,
  district text,
  city text,
  state text,
  instagram_url text,
  facebook_url text,
  website_url text,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT *
  FROM public.update_my_profile_details(
    p_name,
    p_internal_alias,
    p_phone,
    p_mobile_phone,
    p_whatsapp_phone,
    p_cpf,
    p_birthdate,
    p_zip_code,
    p_address,
    p_address_number,
    p_complement,
    p_district,
    p_city,
    p_state,
    p_instagram_url,
    p_facebook_url,
    p_website_url
  );
$function$;

GRANT EXECUTE ON FUNCTION public.update_current_user_profile(
  text, text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, text
)
TO authenticated;
-- Restore canonical reward-media association without direct client writes to prizes.
CREATE OR REPLACE FUNCTION public.set_loyalty_reward_media_safe(
 p_store_id uuid, p_reward_id uuid, p_media_asset_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_asset public.reward_media_assets%ROWTYPE; v_url text; v_updated uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission_v2(p_store_id,'loyalty.manage')
 ) THEN
   RETURN jsonb_build_object('ok',false,'error','access_denied');
 END IF;
 IF p_store_id IS NULL OR p_reward_id IS NULL THEN
   RETURN jsonb_build_object('ok',false,'error','invalid_scope');
 END IF;
 IF p_media_asset_id IS NOT NULL THEN
   SELECT * INTO v_asset FROM public.reward_media_assets
    WHERE id=p_media_asset_id AND store_id=p_store_id AND archived_at IS NULL;
   IF NOT FOUND THEN
     RETURN jsonb_build_object('ok',false,'error','image_not_found_for_store');
   END IF;
   v_url := v_asset.public_url;
 END IF;
 UPDATE public.fidelity_rewards r SET
   media_asset_id=p_media_asset_id, image_url=v_url
 FROM public.fidelity_programs fp
 WHERE r.id=p_reward_id AND r.program_id=fp.id AND fp.store_id=p_store_id
 RETURNING r.id INTO v_updated;
 IF v_updated IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','reward_not_found_for_store');
 END IF;
 RETURN jsonb_build_object('ok',true,'reward_id',v_updated,'image_url',v_url);
END; $$;
REVOKE ALL ON FUNCTION public.set_loyalty_reward_media_safe(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_loyalty_reward_media_safe(uuid,uuid,uuid) TO authenticated, service_role;
grant execute on function public.review_store_profile_change_request(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

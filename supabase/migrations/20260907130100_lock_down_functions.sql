-- Applied to stock-tool-dev on 2026-09-07 ("lock_down_trigger_functions" + "revoke_rpc_from_anon").
-- Trigger functions are never meant to be called through the API, and Supabase's default
-- privileges grant EXECUTE to anon, which the watchlist RPC must not have.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_watchlist_items(uuid, text[]) from anon;

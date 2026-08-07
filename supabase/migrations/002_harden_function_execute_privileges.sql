-- Harden function execute privileges for Supabase
-- This migration mirrors the privilege hardening already applied on the remote database.

revoke execute on function public.set_timestamps() from public, anon, authenticated;
revoke execute on function public.set_created_at() from public, anon, authenticated;
revoke execute on function public.set_profile_id() from public, anon, authenticated;
revoke execute on function public.protect_profile_role_change() from public, anon, authenticated;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.get_public_products(uuid) from public;
grant execute on function public.get_public_products(uuid) to authenticated, anon;

-- 015: função de gatilho não deve ser chamável pela API (apontado pelo linter de segurança).
revoke all on function public.record_price_observation() from public, anon, authenticated;

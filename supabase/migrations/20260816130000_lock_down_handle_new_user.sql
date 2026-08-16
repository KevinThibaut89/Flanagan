-- `handle_new_user` is a SECURITY DEFINER trigger function: it writes a profile
-- row when an auth user is created. PostgREST exposes every function in `public`
-- as an RPC endpoint, so without this it is reachable at
-- /rest/v1/rpc/handle_new_user by anyone, signed in or not.
--
-- Calling it outside a trigger would fail anyway — it reads NEW — but a
-- definer-rights function should never be callable by a role that has no reason
-- to call it. The trigger runs as the table owner and is unaffected.

revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- SHAKH: allow support staff to read support tickets
-- Backward-compatible: customers retain own-ticket access; admins retain admin access.
create policy support_role_read
on public.support_tickets
for select
to authenticated
using ((select current_user_role()) = 'support');

-- Add RLS policies for user_roles table to allow managers to view roles

-- Drop existing policies if they exist
drop policy if exists "Managers can view roles" on public.user_roles;
drop policy if exists "Users can view their own roles" on public.user_roles;

-- Allow managers (super_admin, super_manager, store_manager) to view all user roles
create policy "Managers can view roles"
on public.user_roles
for select
to authenticated
using (
  public.is_manager(auth.uid()) OR public.is_super_admin(auth.uid())
);

-- Allow users to view their own roles
create policy "Users can view their own roles"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());
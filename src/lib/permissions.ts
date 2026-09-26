import { supabase } from './supabase';

export const ROLE_PERMISSIONS = {
  customer: ['orders.read_own', 'orders.create', 'cart.manage', 'wallet.read_own', 'notifications.read_own'],
  captain: ['orders.read_assigned', 'orders.accept', 'orders.update_delivery', 'wallet.read_own', 'notifications.read_own'],
  restaurant_vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  supermarket_vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  fashion_vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  electronics_vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  jewelry_vendor: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  car_dealer: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  umrah_agency: ['orders.read_vendor', 'orders.accept', 'orders.update_vendor_status', 'notifications.read_own'],
  support: ['orders.read_support', 'notifications.read_support'],
  admin: ['dashboard.read', 'users.read', 'orders.read_all', 'vendors.read', 'captains.read', 'reports.read'],
  super_admin: ['*'],
} as const;

export type AppRole = keyof typeof ROLE_PERMISSIONS;

export function hasPermission(role: AppRole | null | undefined, permission: string) {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] as readonly string[];
  return permissions.includes('*') || permissions.includes(permission);
}

export async function getCurrentRole(): Promise<AppRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return (data?.role as AppRole) ?? null;
}

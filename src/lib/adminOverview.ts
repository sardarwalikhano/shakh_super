import { supabase } from './supabase';

export async function getAdminOverview() {
  const [orders, profiles, notifications] = await Promise.all([
    supabase.from('orders').select('id,status,total,delivery_fee,platform_fee,created_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,role,created_at'),
    supabase.from('notifications').select('id,type,is_read,created_at').order('created_at', { ascending: false }),
  ]);

  if (orders.error) throw orders.error;
  if (profiles.error) throw profiles.error;
  if (notifications.error) throw notifications.error;

  const orderRows = orders.data ?? [];
  const profileRows = profiles.data ?? [];
  const notificationRows = notifications.data ?? [];

  return {
    orders: orderRows,
    users: profileRows,
    notifications: notificationRows,
    metrics: {
      totalOrders: orderRows.length,
      activeOrders: orderRows.filter((o) => !['delivered', 'cancelled', 'completed'].includes(o.status)).length,
      completedOrders: orderRows.filter((o) => ['delivered', 'completed'].includes(o.status)).length,
      totalRevenue: orderRows.reduce((sum, o) => sum + Number(o.total ?? 0), 0),
      platformRevenue: orderRows.reduce((sum, o) => sum + Number(o.platform_fee ?? 0), 0),
      customers: profileRows.filter((p) => p.role === 'customer').length,
      vendors: profileRows.filter((p) => ['restaurant_vendor', 'fashion_vendor', 'car_dealer', 'umrah_agency'].includes(p.role)).length,
      captains: profileRows.filter((p) => p.role === 'captain').length,
      unreadNotifications: notificationRows.filter((n) => !n.is_read).length,
    },
  };
}

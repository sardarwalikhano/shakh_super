import { supabase } from './supabase';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'چاوەڕوانی قبوڵکردن',
  accepted: 'لە لایەن دوکانەوە قبوڵکرا',
  preparing: 'لە ئامادەکردندایە',
  ready_for_pickup: 'ئامادەی وەرگرتنە',
  assigned_to_captain: 'کاپتن دیاریکراوە',
  picked_up: 'کاپتن ئۆردەرەکەی وەرگرتووە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندرا',
  cancelled: 'هەڵوەشێنراوەتەوە',
};

export type OrderTimelineItem = {
  id: string;
  status: string;
  changed_by: string | null;
  created_at: string;
  label: string;
};

export async function getOrderTimeline(orderId: string): Promise<OrderTimelineItem[]> {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('id,status,changed_by,created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    label: ORDER_STATUS_LABELS[item.status] ?? item.status,
  }));
}

export async function getMyNotifications(limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,body,type,is_read,data,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export function subscribeToOrderUpdates(orderId: string, onChange: (payload: unknown) => void) {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, onChange)
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

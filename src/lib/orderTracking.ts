import { supabase } from './supabase';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned_to_captain'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export async function transitionOrderStatus(orderId: string, nextStatus: OrderStatus) {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_next_status: nextStatus,
  });

  if (error) throw error;
  return data;
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

export function subscribeToOrder(orderId: string, onChange: (payload: unknown) => void) {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToMyNotifications(userId: string, onChange: (payload: unknown) => void) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

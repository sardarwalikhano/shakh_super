import { supabase } from './supabase';

export type OrderTimelineItem = {
  id: string;
  status: string;
  changed_by: string | null;
  created_at: string;
};

export async function getOrderTimeline(orderId: string): Promise<OrderTimelineItem[]> {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('id,status,changed_by,created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMyNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,body,type,is_read,data,created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function subscribeToOrderUpdates(orderId: string, onChange: () => void) {
  return supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange)
    .subscribe();
}

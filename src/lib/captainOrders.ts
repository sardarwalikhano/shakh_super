import { supabase } from './supabase';

export async function getAvailableCaptainOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total,delivery_fee,created_at')
    .in('status', ['ready_for_pickup', 'ready'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function acceptCaptainOrder(orderId: string, captainId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'picked_up', captain_id: captainId })
    .eq('id', orderId)
    .eq('status', 'ready_for_pickup')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markOrderOnTheWay(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'on_the_way' })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markOrderDelivered(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'delivered' })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

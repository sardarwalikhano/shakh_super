import { supabase } from './supabase';

export async function claimOrder(orderId: string) {
  const { data, error } = await supabase.rpc('claim_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_next_status: status,
  });
  if (error) throw error;
  return data;
}

export async function markOrderOnTheWay(orderId: string) {
  return updateOrderStatus(orderId, 'on_the_way');
}

export async function markOrderDelivered(orderId: string) {
  return updateOrderStatus(orderId, 'delivered');
}

export async function getAvailableCaptainOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,created_at,delivery_fee_iqd,address_id')
    .in('status', ['pending', 'assigned_to_captain', 'picked_up', 'on_the_way'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

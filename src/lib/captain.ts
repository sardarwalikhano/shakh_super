import { supabase } from './supabase';

export type CaptainOrderStatus = 'assigned_to_captain' | 'picked_up' | 'on_the_way' | 'delivered';

export async function claimOrder(orderId: string) {
  const { data, error } = await supabase.rpc('claim_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: string, status: CaptainOrderStatus) {
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

export async function getCaptainOrders() {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user.user) throw new Error('پێویستە بچیتە ژوورەوە.');

  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,created_at,delivery_fee_iqd,address_id,captain_id,store_id,customer_id')
    .eq('captain_id', user.user.id)
    .in('status', ['assigned_to_captain', 'picked_up', 'on_the_way', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAvailableCaptainOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,created_at,delivery_fee_iqd,address_id,store_id,customer_id')
    .eq('status', 'ready_for_pickup')
    .is('captain_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

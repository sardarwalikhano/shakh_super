import { supabase } from './supabase';

export async function getVendorOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function acceptVendorOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'accepted' })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markOrderReady(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'ready_for_pickup' })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToVendorOrders(onChange: () => void) {
  return supabase
    .channel('vendor-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
    .subscribe();
}

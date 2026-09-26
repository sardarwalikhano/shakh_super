import { supabase } from './supabase';

export type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  delivery_fee_iqd?: number | null;
  created_at: string;
  store_id?: string | null;
  captain_id?: string | null;
  customer_id?: string | null;
  address_id?: string | null;
};

export async function getAvailableCaptainOrders(): Promise<CaptainOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,delivery_fee_iqd,created_at,store_id,captain_id,customer_id,address_id')
    .eq('status', 'ready_for_pickup')
    .is('captain_id', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaptainOrder[];
}

export async function claimCaptainOrder(orderId: string) {
  const { data, error } = await supabase.rpc('claim_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function markOrderPickedUp(orderId: string) {
  return transitionCaptainOrder(orderId, 'picked_up');
}

export async function markOrderOnTheWay(orderId: string) {
  return transitionCaptainOrder(orderId, 'on_the_way');
}

export async function markOrderDelivered(orderId: string) {
  return transitionCaptainOrder(orderId, 'delivered');
}

async function transitionCaptainOrder(orderId: string, status: 'picked_up' | 'on_the_way' | 'delivered') {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_new_status: status,
  });
  if (error) throw error;
  return data;
}

export function subscribeToCaptainOrders(captainId: string, onChange: () => void) {
  const channel = supabase
    .channel(`captain-orders-${captainId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `captain_id=eq.${captainId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

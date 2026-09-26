import { supabase } from './supabase';

export type VendorOrder = {
  id: string;
  status: string;
  store_id: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  platform_fee_iqd: number;
  total_iqd: number;
  created_at: string;
};

export async function getVendorOrders(storeId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,store_id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,total_iqd,created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VendorOrder[];
}

export async function updateVendorOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_new_status: status,
  });

  if (error) throw error;
  return data;
}

export function subscribeToVendorOrders(storeId: string, onChange: (payload: unknown) => void) {
  const channel = supabase
    .channel(`vendor-orders-${storeId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

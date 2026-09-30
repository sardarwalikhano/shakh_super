import { supabase } from './supabase';

export type VendorOrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_iqd: number;
};

export type VendorOrder = {
  id: string;
  status: string;
  store_id: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  platform_fee_iqd: number;
  total_iqd: number;
  created_at: string;
  store?: { name?: string | null; address?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null } | null;
  items: VendorOrderItem[];
  delivery_address?: { address?: string | null; label?: string | null; delivery_note?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null } | null;
};

export async function getVendorOrders(storeId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,store_id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,total_iqd,created_at,store:stores(name,address,city,latitude,longitude),delivery_address:delivery_addresses(address,label,delivery_note,city,latitude,longitude),order_items(product_id,product_name,quantity,unit_price_iqd)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((order: any) => ({
    ...order,
    delivery_address: Array.isArray(order.delivery_address) ? (order.delivery_address[0] ?? null) : (order.delivery_address ?? null),
    store: Array.isArray(order.store) ? (order.store[0] ?? null) : (order.store ?? null),
    items: (order.order_items ?? []).map((item: any) => ({
      product_id: item.product_id ?? null,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price_iqd: Number(item.unit_price_iqd),
    })),
  })) as VendorOrder[];
}

export async function updateVendorOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_next_status: status,
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

import { supabase } from './supabase';

export type CaptainOrderStatus = 'assigned_to_captain' | 'picked_up' | 'on_the_way' | 'delivered';

export type CaptainOrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_iqd: number;
  options?: Record<string, unknown> | null;
};

export type CaptainStore = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CaptainDeliveryAddress = {
  address?: string | null;
  label?: string | null;
  delivery_note?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  subtotal_iqd?: number | null;
  delivery_fee_iqd?: number | null;
  platform_fee_iqd?: number | null;
  discount_iqd?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at: string;
  updated_at?: string | null;
  delivered_at?: string | null;
  address_id?: string | null;
  items?: CaptainOrderItem[];
  store?: CaptainStore | null;
  delivery_address?: CaptainDeliveryAddress | null;
};

function normalizeCaptainOrder(row: any): CaptainOrder {
  return {
    ...row,
    store: Array.isArray(row.store) ? (row.store[0] ?? null) : (row.store ?? null),
    delivery_address: Array.isArray(row.delivery_address)
      ? (row.delivery_address[0] ?? null)
      : (row.delivery_address ?? null),
  };
}

export async function claimOrder(orderId: string) {
  const { data, error } = await supabase.rpc('claim_order', { p_order_id: orderId });
  if (error) throw error;
  if (data !== true) {
    throw new Error('ئەم ئۆردەرە پێشتر لەلایەن کاپتنێکی ترەوە وەرگیراوە.');
  }
  return data;
}

export type CaptainCustomerContact = {
  full_name: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
};

export async function getCaptainCustomerContact(orderId: string): Promise<CaptainCustomerContact | null> {
  const { data, error } = await supabase.rpc('get_captain_customer_contact', {
    p_order_id: orderId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
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

export async function getCaptainOrders(): Promise<CaptainOrder[]> {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user.user) throw new Error('پێویستە بچیتە ژوورەوە.');

  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,payment_method,payment_status,created_at,updated_at,delivered_at,address_id,captain_id,store_id,customer_id,delivery_address:delivery_addresses(address,label,delivery_note,city,latitude,longitude),items:order_items(product_id,product_name,quantity,unit_price_iqd,options),store:stores(name,address,city,latitude,longitude)')
    .eq('captain_id', user.user.id)
    .in('status', ['assigned_to_captain', 'picked_up', 'on_the_way', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeCaptainOrder);
}

export async function getAvailableCaptainOrders(): Promise<CaptainOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,payment_method,payment_status,created_at,updated_at,address_id,store_id,customer_id,delivery_address:delivery_addresses(address,label,delivery_note,city,latitude,longitude),items:order_items(product_id,product_name,quantity,unit_price_iqd,options),store:stores(name,address,city,latitude,longitude)')
    .eq('status', 'ready_for_pickup')
    .is('captain_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeCaptainOrder);
}

import { supabase } from './supabase';

export type CaptainOrderStatus = 'assigned_to_captain' | 'picked_up' | 'on_the_way' | 'delivered';

export type CaptainOrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_iqd: number;
};

export type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  updated_at?: string | null;
  delivery_fee_iqd?: number | null;
  address_id?: string | null;
  items?: CaptainOrderItem[];
};

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
    .select('id,status,total_iqd,created_at,updated_at,delivery_fee_iqd,address_id,captain_id,store_id,customer_id,delivery_address:delivery_addresses(address,label,city,latitude,longitude),items:order_items(product_id,product_name,quantity,unit_price_iqd)')
    .eq('captain_id', user.user.id)
    .in('status', ['assigned_to_captain', 'picked_up', 'on_the_way', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAvailableCaptainOrders(): Promise<CaptainOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status,total_iqd,created_at,delivery_fee_iqd,address_id,store_id,customer_id,items:order_items(product_id,product_name,quantity,unit_price_iqd)')
    .eq('status', 'ready_for_pickup')
    .is('captain_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

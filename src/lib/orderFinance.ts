import { supabase } from './supabase';

export type OrderFinance = {
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
};

export function calculateOrderFinance(subtotal: number, deliveryFee: number, platformFee = 0): OrderFinance {
  return {
    subtotal,
    delivery_fee: deliveryFee,
    platform_fee: platformFee,
    total: subtotal + deliveryFee + platformFee,
  };
}

export async function getOrderFinance(orderId: string): Promise<OrderFinance & { id: string; status: string }> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,total_iqd,status')
    .eq('id', orderId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    status: data.status,
    subtotal: Number(data.subtotal_iqd ?? 0),
    delivery_fee: Number(data.delivery_fee_iqd ?? 0),
    platform_fee: Number(data.platform_fee_iqd ?? 0),
    total: Number(data.total_iqd ?? 0),
  };
}

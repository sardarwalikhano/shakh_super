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

export async function getOrderFinance(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,subtotal,delivery_fee,platform_fee,total,status')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

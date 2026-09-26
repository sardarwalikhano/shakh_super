import { supabase } from './supabase';

export type CommissionBreakdown = {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  vendorEarnings: number;
  captainEarnings: number;
  customerTotal: number;
};

export function calculateCommission(subtotal: number, deliveryFee: number, platformFee: number, captainShare = deliveryFee) : CommissionBreakdown {
  const safeSubtotal = Math.max(0, subtotal);
  const safeDelivery = Math.max(0, deliveryFee);
  const safePlatform = Math.max(0, platformFee);
  const safeCaptain = Math.min(safeDelivery, Math.max(0, captainShare));

  return {
    subtotal: safeSubtotal,
    deliveryFee: safeDelivery,
    platformFee: safePlatform,
    vendorEarnings: safeSubtotal,
    captainEarnings: safeCaptain,
    customerTotal: safeSubtotal + safeDelivery + safePlatform,
  };
}

export async function getOrderCommission(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,subtotal,delivery_fee,platform_fee,total,status')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

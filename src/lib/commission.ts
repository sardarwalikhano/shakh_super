import { supabase } from './supabase';

export type CommissionBreakdown = {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  vendorEarnings: number;
  captainEarnings: number;
  customerTotal: number;
};

export function calculateCommission(
  subtotal: number,
  deliveryFee: number,
  platformFee: number,
  captainShare = deliveryFee,
): CommissionBreakdown {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDelivery = Math.max(0, Number(deliveryFee) || 0);
  const safePlatform = Math.max(0, Number(platformFee) || 0);
  const safeCaptain = Math.min(safeDelivery, Math.max(0, Number(captainShare) || 0));

  return {
    subtotal: safeSubtotal,
    deliveryFee: safeDelivery,
    platformFee: safePlatform,
    vendorEarnings: safeSubtotal,
    captainEarnings: safeCaptain,
    customerTotal: safeSubtotal + safeDelivery + safePlatform,
  };
}

export async function getOrderCommission(orderId: string): Promise<CommissionBreakdown & {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
}> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,total_iqd,status,payment_status,payment_method')
    .eq('id', orderId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    status: data.status,
    payment_status: data.payment_status,
    payment_method: data.payment_method,
    ...calculateCommission(
      Number(data.subtotal_iqd ?? 0),
      Number(data.delivery_fee_iqd ?? 0),
      Number(data.platform_fee_iqd ?? 0),
      Number(data.delivery_fee_iqd ?? 0),
    ),
  };
}

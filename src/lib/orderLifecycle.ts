import { supabase } from './supabase';

export type OrderStage = 'pending' | 'assigned_to_captain' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

const copy: Record<OrderStage, { title: string; body: string }> = {
  pending: { title: 'داواکارییەکە تۆمار کرا', body: 'داواکارییەکەت نێردراوە بۆ دوکان و چاوەڕوانییە.' },
  assigned_to_captain: { title: 'کاپتن دیاریکرا', body: 'داواکارییەکەت دراوەتە کاپتن و بەم زووانە وەری دەگرێت.' },
  picked_up: { title: 'داواکارییەکە وەرگیرا', body: 'کاپتن داواکارییەکەی لە دوکان وەرگرتووە.' },
  on_the_way: { title: 'داواکارییەکە لە ڕێگادایە', body: 'کاپتن بە داواکارییەکەتەوە لە ڕێگای گەیاندندایە.' },
  delivered: { title: 'گەیاندن تەواو بوو', body: 'داواکارییەکەت بە سەرکەوتوویی گەیەندرا.' },
  cancelled: { title: 'داواکاری هەڵوەشێنرایەوە', body: 'داواکارییەکەت هەڵوەشێنرایەوە.' },
};

export async function notifyUsers(userIds: string[], orderId: string, status: OrderStage) {
  if (!supabase || userIds.length === 0) return;
  const text = copy[status];
  const rows = [...new Set(userIds)].map((user_id) => ({
    user_id,
    order_id: orderId,
    type: 'order_update',
    title_ku: text.title,
    body_ku: text.body,
  }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
}

export async function recordOrderStage(orderId: string, status: OrderStage, changedBy?: string) {
  if (!supabase) return;
  const { error } = await supabase.from('order_status_history').insert({
    order_id: orderId,
    status,
    changed_by: changedBy ?? null,
  });
  if (error) throw error;
}

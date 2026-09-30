import type { CaptainOrderItem } from './captain';

export type WhatsAppOrderPacket = {
  orderId: string;
  status?: string | null;
  store?: { name?: string | null; address?: string | null; city?: string | null } | null;
  deliveryAddress?: {
    address?: string | null;
    delivery_note?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  items: CaptainOrderItem[];
  subtotal_iqd?: number | null;
  delivery_fee_iqd?: number | null;
  platform_fee_iqd?: number | null;
  discount_iqd?: number | null;
  total_iqd?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  customer?: {
    full_name?: string | null;
    phone?: string | null;
    whatsapp_phone?: string | null;
  } | null;
};

const statusLabel: Record<string, string> = {
  ready_for_pickup: 'ئامادەی وەرگرتن',
  assigned_to_captain: 'کاپتن دیاریکراوە',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
  pending: 'چاوەڕوان',
};

function money(value?: number | null) {
  return Number(value ?? 0).toLocaleString('ku-IQ') + ' د.ع';
}

function optionText(options?: Record<string, unknown> | null) {
  if (!options) return '';
  return Object.entries(options)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([key, value]) => key + ': ' + String(value))
    .join('، ');
}

export function buildWhatsAppOrderText(packet: WhatsAppOrderPacket) {
  const lines = [
    '🟠 شاخ — زانیاریی تەواوی ئۆردەر',
    'ژمارەی ئۆردەر: #' + packet.orderId.slice(0, 8),
    'دۆخ: ' + (statusLabel[packet.status || ''] || packet.status || '—'),
    '',
    '🏪 دوکان',
    packet.store?.name || '—',
    [packet.store?.address, packet.store?.city].filter(Boolean).join(' — ') || '—',
    '',
    '📍 شوێنی وردی گەیاندن',
    packet.deliveryAddress?.address || '—',
    packet.deliveryAddress?.city ? 'شار: ' + packet.deliveryAddress.city : '',
    packet.deliveryAddress?.delivery_note ? 'تێبینی: ' + packet.deliveryAddress.delivery_note : '',
    packet.deliveryAddress?.latitude != null && packet.deliveryAddress?.longitude != null
      ? 'کۆئۆردینات: ' + packet.deliveryAddress.latitude.toFixed(7) + ', ' + packet.deliveryAddress.longitude.toFixed(7)
      : '',
    '',
    '🛍️ لیستی بەرهەم',
    ...packet.items.map((item) => {
      const opts = optionText(item.options);
      return '• ' + item.product_name + ' × ' + item.quantity + ' = ' +
        money(Number(item.unit_price_iqd) * Number(item.quantity)) +
        (opts ? ' (' + opts + ')' : '');
    }),
    '',
    '💰 دارایی',
    'کۆی بەرهەم: ' + money(packet.subtotal_iqd),
    'گەیاندن: ' + money(packet.delivery_fee_iqd),
    'خزمەتی شاخ: ' + money(packet.platform_fee_iqd),
    ...(Number(packet.discount_iqd || 0) > 0 ? ['داشکاندن: -' + money(packet.discount_iqd)] : []),
    'کۆی گشتی: ' + money(packet.total_iqd),
    'شێوازی پارەدان: ' + (packet.payment_method || 'cash'),
    'دۆخی پارەدان: ' + (packet.payment_status || 'pending'),
  ];

  if (packet.customer) {
    lines.push(
      '',
      '👤 کڕیار',
      packet.customer.full_name || '—',
      packet.customer.phone ? 'مۆبایل: ' + packet.customer.phone : '',
      packet.customer.whatsapp_phone ? 'واتسئاپ: ' + packet.customer.whatsapp_phone : '',
    );
  }

  return lines.filter((line) => line !== '').join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('964')
    ? digits
    : digits.startsWith('0')
      ? '964' + digits.slice(1)
      : digits;

  return 'https://wa.me/' + normalized + '?text=' + encodeURIComponent(message);
}

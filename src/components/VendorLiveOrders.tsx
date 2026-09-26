import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChefHat, Package, RefreshCw, Truck, XCircle } from 'lucide-react';
import { getVendorOrders, subscribeToVendorOrders, updateVendorOrderStatus, type VendorOrder } from '../lib/vendorOrders';

const labels: Record<string, string> = {
  pending: 'چاوەڕوان',
  accepted: 'قبوڵکراو',
  preparing: 'لە ئامادەکردندایە',
  ready_for_pickup: 'ئامادەی وەرگرتن',
  assigned_to_captain: 'کاپتن دیاریکراوە',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
  cancelled: 'هەڵوەشێنراوەتەوە',
};

const actions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
  pending: [{ status: 'accepted', label: 'قبوڵکردن', icon: <CheckCircle2 size={16} /> }],
  accepted: [{ status: 'preparing', label: 'دەستپێکردنی ئامادەکردن', icon: <ChefHat size={16} /> }],
  preparing: [{ status: 'ready_for_pickup', label: 'ئامادەی وەرگرتن', icon: <Package size={16} /> }],
};

type Props = { storeId: string };

export default function VendorLiveOrders({ storeId }: Props) {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getVendorOrders(storeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا ئۆردەرەکان وەربگیرێن');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
    return subscribeToVendorOrders(storeId, () => void load());
  }, [load, storeId]);

  const changeStatus = async (orderId: string, status: string) => {
    setBusy(orderId);
    setError(null);
    try {
      await updateVendorOrderStatus(orderId, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا دۆخی ئۆردەر بگۆڕدرێت');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div dir="rtl"><RefreshCw className="animate-spin" /> ئۆردەرەکان بار دەکرێن...</div>;

  return (
    <section dir="rtl" aria-label="ئۆردەرەکانی دوکان">
      <div>
        <h3>ئۆردەرە زیندووەکان</h3>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={17} /></button>
      </div>
      {error && <p role="alert">{error}</p>}
      {orders.length === 0 ? (
        <p>هیچ ئۆردەرێکی ئەم دوکانە نییە.</p>
      ) : (
        <div>
          {orders.map((order) => (
            <article key={order.id}>
              <strong>#{order.id.slice(0, 8)}</strong>
              <span>{labels[order.status] ?? order.status}</span>
              <strong>{Number(order.total_iqd).toLocaleString('ku-IQ')} د.ع</strong>
              <small>{new Date(order.created_at).toLocaleString('ku-IQ')}</small>
              {actions[order.status]?.map((action) => (
                <button key={action.status} type="button" disabled={busy === order.id} onClick={() => void changeStatus(order.id, action.status)}>
                  {action.icon}{action.label}
                </button>
              ))}
              {order.status === 'ready_for_pickup' && <span><Truck size={16} /> چاوەڕێی کاپتن</span>}
              {order.status === 'cancelled' && <span><XCircle size={16} /> هەڵوەشێنراوەتەوە</span>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

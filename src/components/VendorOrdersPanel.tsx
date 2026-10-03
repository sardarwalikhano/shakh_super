import { useEffect, useState } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VendorLiveOrders from './VendorLiveOrders';

type Props = { userId: string };

export default function VendorOrdersPanel({ userId }: Props) {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('دوکانی من');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setMessage('');
      const { data, error } = await supabase
        .from('stores')
        .select('id,name')
        .eq('owner_id', userId)
        .eq('category', 'daily')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      setStoreId(data?.id || '');
      setStoreName(data?.name || 'دوکانی من');
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return <section className="vendorOrdersRoute" dir="rtl"><div className="vendorOrdersRouteState"><RefreshCw className="is-spinning" size={20} /> ئۆردەرەکانی دوکان بار دەکرێن...</div></section>;
  }

  if (message) {
    return <section className="vendorOrdersRoute" dir="rtl"><div className="msg" role="alert">{message}</div></section>;
  }

  if (!storeId) {
    return <section className="vendorOrdersRoute" dir="rtl"><div className="vendorOrdersRouteState"><Store size={32} /><h3>{storeName}</h3><p>دوکانی چالاک نەدۆزرایەوە؛ تکایە زانیاریی دوکان و هەژمارەکەت بپشکنە.</p></div></section>;
  }

  return <section className="vendorOrdersRoute" dir="rtl"><VendorLiveOrders storeId={storeId} /></section>;
}

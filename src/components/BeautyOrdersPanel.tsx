import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VendorLiveOrders from './VendorLiveOrders';

type Props = { userId: string };

export default function BeautyOrdersPanel({ userId }: Props) {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('دوکانی جوانکاریم');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setMessage('');
      const { data, error } = await supabase
        .from('stores').select('id,name').eq('owner_id', userId).eq('category', 'beauty').eq('is_active', true).limit(1).maybeSingle();
      if (!active) return;
      if (error) { setMessage(error.message); setLoading(false); return; }
      setStoreId(data?.id || ''); setStoreName(data?.name || 'دوکانی جوانکاریم'); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  if (loading) return <section className="beautyOrdersRoute" dir="rtl"><div className="beautyOrdersRouteState"><RefreshCw className="is-spinning" size={20} /> ئۆردەرەکانی جوانکاری بار دەکرێن...</div></section>;
  if (message) return <section className="beautyOrdersRoute" dir="rtl"><div className="msg" role="alert">{message}</div></section>;
  if (!storeId) return <section className="beautyOrdersRoute" dir="rtl"><div className="beautyOrdersRouteState"><Store size={32} /><Sparkles size={22} /><h3>{storeName}</h3><p>دوکانی جوانکاریی چالاک نەدۆزرایەوە؛ تکایە زانیاریی دوکان و هەژمارەکەت بپشکنە.</p></div></section>;

  return <section className="beautyOrdersRoute" dir="rtl"><VendorLiveOrders storeId={storeId} /></section>;
}

import { useEffect, useState } from 'react';
import { Laptop, RefreshCw, Smartphone, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VendorLiveOrders from './VendorLiveOrders';

type Props = { userId: string };

export default function ElectronicsOrdersPanel({ userId }: Props) {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('دوکانی ئەلیکترۆنیاتەکەم');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setMessage('');
      const { data, error } = await supabase
        .from('stores').select('id,name').eq('owner_id', userId).eq('category', 'electronics').eq('is_active', true).limit(1).maybeSingle();
      if (!active) return;
      if (error) { setMessage(error.message); setLoading(false); return; }
      setStoreId(data?.id || ''); setStoreName(data?.name || 'دوکانی ئەلیکترۆنیاتەکەم'); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  if (loading) return <section className="electronicsOrdersRoute" dir="rtl"><div className="electronicsOrdersRouteState"><RefreshCw className="is-spinning" size={20} /> ئۆردەرەکانی ئەلیکترۆنیات بار دەکرێن...</div></section>;
  if (message) return <section className="electronicsOrdersRoute" dir="rtl"><div className="msg" role="alert">{message}</div></section>;
  if (!storeId) return <section className="electronicsOrdersRoute" dir="rtl"><div className="electronicsOrdersRouteState"><Store size={32} /><Laptop size={22} /><Smartphone size={20} /><h3>{storeName}</h3><p>دوکانی ئەلیکترۆنیاتی چالاک نەدۆزرایەوە؛ تکایە زانیاریی دوکان و هەژمارەکەت بپشکنە.</p></div></section>;

  return <section className="electronicsOrdersRoute" dir="rtl"><VendorLiveOrders storeId={storeId} /></section>;
}

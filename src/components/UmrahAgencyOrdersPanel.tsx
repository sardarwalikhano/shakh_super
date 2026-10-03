import { useEffect, useState } from 'react';
import { Plane, RefreshCw, Store, UsersRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UmrahBookingModule from './UmrahBookingModule';

type Props = { userId: string };

export default function UmrahAgencyOrdersPanel({ userId }: Props) {
  const [agencyId, setAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setMessage('');
      const { data, error } = await supabase.from('umrah_agencies')
        .select('id').eq('owner_id', userId).maybeSingle();
      if (!active) return;
      if (error) { setMessage(error.message); setLoading(false); return; }
      setAgencyId(data?.id || ''); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  if (loading) return <section className="umrahAgencyOrdersRoute" dir="rtl"><div className="umrahAgencyOrdersRouteState"><RefreshCw className="is-spinning" size={20}/> حجزەکانی حەج و عومرە بار دەکرێن...</div></section>;
  if (message) return <section className="umrahAgencyOrdersRoute" dir="rtl"><div className="umrahAgencyOrdersRouteState"><Store size={30}/><p>{message}</p></div></section>;
  if (!agencyId) return <section className="umrahAgencyOrdersRoute" dir="rtl"><div className="umrahAgencyOrdersRouteState"><Store size={32}/><Plane size={22}/><UsersRound size={20}/><h3>کۆمپانیای حەج و عومرە</h3><p>کۆمپانیایەکی تۆمارکراوی چالاک نەدۆزرایەوە.</p></div></section>;

  return <section className="umrahAgencyOrdersRoute" dir="rtl">
    <UmrahBookingModule userId={userId} role="umrah_agency" />
  </section>;
}

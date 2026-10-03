import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, Car, CheckCircle2, ClipboardList, CircleDollarSign, FileText, LifeBuoy,
  Plus, RefreshCw, Settings2, ShieldCheck, Store, UserRound, WalletCards, Clock3,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type Listing = {
  id: string; title?: string | null; make?: string | null; model?: string | null;
  model_year?: number | null; price_iqd?: number | string | null; status?: string | null; created_at?: string | null;
};
type Payment = {
  id: string; amount_iqd?: number | string | null; status?: string | null; created_at?: string | null;
};
type Showroom = { id: string; business_name?: string | null; posting_fee_iqd?: number | string | null; created_at?: string | null };
type Metrics = {
  showroom: boolean; listings: number; approved: number; pendingPayment: number; pendingVerification: number;
  pendingApproval: number; sold: number; archived: number; submittedPayments: number; verifiedPayments: number;
  listingValue: number; postingFee: number;
};
const initial: Metrics = {
  showroom: false, listings: 0, approved: 0, pendingPayment: 0, pendingVerification: 0,
  pendingApproval: 0, sold: 0, archived: 0, submittedPayments: 0, verifiedPayments: 0, listingValue: 0, postingFee: 0
};
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';
const statusLabels: Record<string,string> = {
  pending_payment: 'چاوەڕوانی پارەدان',
  pending_payment_verification: 'چاوەڕوانی پشتڕاستکردنەوە',
  pending_approval: 'چاوەڕوانی پەسەند',
  approved: 'پەسەندکراو',
  sold: 'فرۆشراو',
  archived: 'ئەرشیفکراو',
  rejected: 'ڕەتکراوەتەوە',
};

export default function CarDealerControlCenter({ userId, onNavigate }: Props) {
  const [showroomName, setShowroomName] = useState('پێشانگای ئۆتۆمبێلەکەم');
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [recent, setRecent] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const [showroomResult, listingsResult, paymentsResult] = await Promise.all([
        supabase.from('vehicle_showrooms').select('id,business_name,posting_fee_iqd,created_at').eq('owner_id', userId).maybeSingle(),
        supabase.from('vehicle_listings').select('id,title,make,model,model_year,price_iqd,status,created_at').eq('owner_id', userId).order('created_at', { ascending: false }),
        supabase.from('vehicle_posting_payments').select('id,amount_iqd,status,created_at').eq('payer_id', userId).order('created_at', { ascending: false }),
      ]);
      const firstError = [showroomResult, listingsResult, paymentsResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const showroom = showroomResult.data as Showroom | null;
      const listings = (listingsResult.data || []) as Listing[];
      const payments = (paymentsResult.data || []) as Payment[];

      setShowroomName(showroom?.business_name || 'پێشانگای ئۆتۆمبێلەکەم');
      setRecent(listings.slice(0, 5));

      const approved = listings.filter(x => x.status === 'approved');
      setMetrics({
        showroom: !!showroom,
        listings: listings.length,
        approved: approved.length,
        pendingPayment: listings.filter(x => x.status === 'pending_payment').length,
        pendingVerification: listings.filter(x => x.status === 'pending_payment_verification').length,
        pendingApproval: listings.filter(x => x.status === 'pending_approval').length,
        sold: listings.filter(x => x.status === 'sold').length,
        archived: listings.filter(x => x.status === 'archived').length,
        submittedPayments: payments.filter(x => x.status === 'submitted').length,
        verifiedPayments: payments.filter(x => x.status === 'verified').length,
        listingValue: approved.reduce((sum, item) => sum + Number(item.price_iqd || 0), 0),
        postingFee: Number(showroom?.posting_fee_iqd || 0),
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی SHAKH Cars وەرگیرێت.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-car-dealer-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_showrooms', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_listings', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_posting_payments', filter: 'payer_id=eq.' + userId }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'کۆی پۆستەکانی ئۆتۆمبێل', value: metrics.listings, icon: Car, tone: 'orange' },
    { label: 'پەسەندکراو', value: metrics.approved, icon: CheckCircle2, tone: 'green' },
    { label: 'چاوەڕوانی پارەدان', value: metrics.pendingPayment, icon: WalletCards, tone: 'amber' },
    { label: 'چاوەڕوانی پشتڕاستکردنەوە', value: metrics.pendingVerification, icon: ShieldCheck, tone: 'violet' },
    { label: 'چاوەڕوانی پەسەند', value: metrics.pendingApproval, icon: Clock3, tone: 'blue' },
    { label: 'فرۆشراو', value: metrics.sold, icon: CircleDollarSign, tone: 'teal' },
    { label: 'وەسڵی نێردراو', value: metrics.submittedPayments, icon: ClipboardList, tone: 'rose' },
    { label: 'بەهای پۆستە پەسەندکراوەکان', value: money(metrics.listingValue), icon: CircleDollarSign, tone: 'gold', money: true },
  ], [metrics]);

  return <section className="shakhCarDealerCenter" aria-labelledby="car-dealer-center-title" dir="rtl">
    <div className="shakhCarDealerHero">
      <div className="shakhCarDealerHeroCopy">
        <span className="shakhCarDealerEyebrow"><Car size={15} /> SHAKH CARS</span>
        <h2 id="car-dealer-center-title">SHAKH Car Dealer Center</h2>
        <p>{showroomName} — بەڕێوەبردنی پێشانگا، پۆستی ئۆتۆمبێل، وەسڵی پارەدان و پەسەندکردن.</p>
      </div>
      <button type="button" className="shakhCarDealerRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە
      </button>
    </div>
    {message && <div className="msg" role="alert">{message}</div>}

    {!metrics.showroom && !loading && <div className="shakhCarDealerSetup">
      <div><strong>پێشانگاکەت هێشتا تۆمار نەکراوە</strong><span>بۆ پۆستکردنی ئۆتۆمبێل، سەرەتا پێویستە پێشانگا لە SHAKH Cars تۆمار بکەیت.</span></div>
      <button type="button" onClick={() => onNavigate('cars')}><Plus size={17}/> تۆمارکردنی پێشانگا</button>
    </div>}

    <div className="shakhCarDealerStats">
      {cards.map(({ label, value, icon: Icon, tone, money: isMoney }) => (
        <article className="shakhCarDealerStat" data-tone={tone} key={label}>
          <span className="shakhCarDealerStatIcon"><Icon size={19}/></span>
          <div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div>
        </article>
      ))}
    </div>

    <div className="shakhCarDealerWorkspace">
      <div className="shakhCarDealerWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>بەڕێوەبردنی SHAKH Cars</h3></div>
        <small>{metrics.postingFee ? 'کرێی هەر پۆست: ' + money(metrics.postingFee) : 'کرێی پۆستکردن هێشتا دیاری نەکراوە'}</small>
      </div>
      <div className="shakhCarDealerActionGrid">
        <button type="button" onClick={() => onNavigate('cars')}><Car/><span><b>پێشانگا و ئۆتۆمبێلەکان</b><small>{metrics.approved} پەسەندکراو</small></span></button>
        <button type="button" onClick={() => onNavigate('cars')}><Plus/><span><b>پۆستکردنی ئۆتۆمبێل</b><small>زیادکردنی ئۆتۆمبێلی نوێ</small></span></button>
        <button type="button" onClick={() => onNavigate('publish_post')}><FileText/><span><b>بڵاوکردنەوە</b><small>پۆستەکانی شاخ</small></span></button>
        <button type="button" onClick={() => onNavigate('manage_posts')}><ClipboardList/><span><b>بەڕێوەبردنی پۆستەکان</b><small>بینین و بەڕێوەبردن</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards/><span><b>جزدان</b><small>باڵانس و مامەڵەکان</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell/><span><b>ئاگادارییەکان</b><small>نوێترین ئاگاداری</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound/><span><b>پرۆفایل</b><small>زانیاری هەژمار و پێشانگا</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><LifeBuoy/><span><b>پشتگیری</b><small>تیکەت و یارمەتی</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2/><span><b>ڕێکخستنەکان</b><small>ڕێکخستنەکانی هەژمار</small></span></button>
      </div>
    </div>

    <div className="shakhCarDealerRecent">
      <div className="shakhCarDealerRecentHead"><div><span>نوێترین پۆستەکان</span><h3>دۆخی پۆستەکانی ئۆتۆمبێل</h3></div><small>{syncedAt ? 'sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small></div>
      {loading ? <div className="shakhCarDealerRecentEmpty">چاوەڕێ بکە...</div> : !recent.length ? <div className="shakhCarDealerRecentEmpty">هێشتا هیچ پۆستێکی ئۆتۆمبێلت نییە.</div> :
        <div className="shakhCarDealerRecentList">{recent.map(item =>
          <button type="button" className="shakhCarDealerRecentRow" key={item.id} onClick={() => onNavigate('cars')}>
            <span><b>{item.title || 'پۆستی ئۆتۆمبێل'}</b><small>{[item.make,item.model,item.model_year || ''].filter(Boolean).join(' · ')}</small></span>
            <strong>{statusLabels[item.status || ''] || item.status || '—'}</strong>
            <em>{Number(item.price_iqd || 0).toLocaleString('en-US')} د.ع</em>
          </button>
        )}</div>}
    </div>
  </section>;
}

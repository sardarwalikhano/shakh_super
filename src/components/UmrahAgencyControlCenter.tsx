import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, CheckCircle2, Clock3, FileText, LifeBuoy, Plane,
  Plus, RefreshCw, Settings2, ShieldCheck, Store, UserRound, WalletCards,
  UsersRound, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type Trip = {
  id: string; title?: string | null; destination?: string | null;
  departure_date?: string | null; return_date?: string | null;
  total_price_iqd?: number | string | null; capacity?: number | null;
  available_seats?: number | null; status?: string | null; created_at?: string | null;
};
type Booking = {
  id: string; passenger_name?: string | null; booking_payment_status?: string | null;
  travel_payment_status?: string | null; status?: string | null; created_at?: string | null;
};
type Payment = { id: string; payment_kind?: string | null; amount_iqd?: number | string | null; status?: string | null; };
type Agency = { id: string; business_name?: string | null; posting_fee_iqd?: number | string | null; license_number?: string | null };
type Metrics = {
  agency: boolean; trips: number; approvedTrips: number; pendingPayment: number;
  pendingVerification: number; pendingApproval: number; rejectedTrips: number;
  bookings: number; pendingBookings: number; confirmedBookings: number;
  travelPaymentDue: number; paymentVerifiedAmount: number; postingFee: number;
};
const initial: Metrics = {
  agency: false, trips: 0, approvedTrips: 0, pendingPayment: 0, pendingVerification: 0,
  pendingApproval: 0, rejectedTrips: 0, bookings: 0, pendingBookings: 0, confirmedBookings: 0,
  travelPaymentDue: 0, paymentVerifiedAmount: 0, postingFee: 0
};
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';
const statusLabels: Record<string,string> = {
  pending_payment: 'چاوەڕوانی پارەدان',
  pending_payment_verification: 'چاوەڕوانی پشتڕاستکردنەوە',
  pending_approval: 'چاوەڕوانی پەسەند',
  approved: 'پەسەندکراو',
  rejected: 'ڕەتکراوەتەوە',
  confirmed: 'حجزکراو',
  documents_pending: 'چاوەڕوانی بەڵگەنامە',
  travel_payment_due: 'پارەی سەفەر داواکراوە',
  ready_for_travel: 'ئامادەی سەفەر',
  completed: 'تەواوبوو',
  cancelled: 'هەڵوەشێنراوە',
};

export default function UmrahAgencyControlCenter({ userId, onNavigate }: Props) {
  const [agencyName, setAgencyName] = useState('کۆمپانیای حەج و عومرەکەم');
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const agencyResult = await supabase.from('umrah_agencies')
        .select('id,business_name,posting_fee_iqd,license_number')
        .eq('owner_id', userId).maybeSingle();
      if (agencyResult.error) throw agencyResult.error;
      const agency = agencyResult.data as Agency | null;
      if (!agency) {
        setAgencyName('کۆمپانیای حەج و عومرەکەم');
        setMetrics(initial);
        setRecentTrips([]);
        setSyncedAt(new Date());
        return;
      }

      const [tripsResult, bookingsResult, paymentsResult] = await Promise.all([
        supabase.from('umrah_trips').select('id,title,destination,departure_date,return_date,total_price_iqd,capacity,available_seats,status,created_at')
          .eq('agency_id', agency.id).order('created_at', { ascending: false }),
        supabase.from('umrah_bookings').select('id,passenger_name,booking_payment_status,travel_payment_status,status,created_at')
          .eq('agency_id', agency.id).order('created_at', { ascending: false }),
        supabase.from('umrah_payment_records').select('id,payment_kind,amount_iqd,status').eq('agency_id', agency.id),
      ]);
      const firstError = [tripsResult, bookingsResult, paymentsResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const trips = (tripsResult.data || []) as Trip[];
      const bookings = (bookingsResult.data || []) as Booking[];
      const payments = (paymentsResult.data || []) as Payment[];
      setAgencyName(agency.business_name || 'کۆمپانیای حەج و عومرەکەم');
      setRecentTrips(trips.slice(0, 5));

      setMetrics({
        agency: true,
        trips: trips.length,
        approvedTrips: trips.filter(t => t.status === 'approved').length,
        pendingPayment: trips.filter(t => t.status === 'pending_payment').length,
        pendingVerification: trips.filter(t => t.status === 'pending_payment_verification').length,
        pendingApproval: trips.filter(t => t.status === 'pending_approval').length,
        rejectedTrips: trips.filter(t => t.status === 'rejected').length,
        bookings: bookings.length,
        pendingBookings: bookings.filter(b => ['pending_payment', 'documents_pending', 'travel_payment_due'].includes(String(b.status))).length,
        confirmedBookings: bookings.filter(b => ['confirmed', 'ready_for_travel', 'completed'].includes(String(b.status))).length,
        travelPaymentDue: bookings.filter(b => b.status === 'travel_payment_due' || b.travel_payment_status === 'requested').length,
        paymentVerifiedAmount: payments.filter(p => p.status === 'verified' && ['booking_fee', 'travel_payment'].includes(String(p.payment_kind)))
          .reduce((sum, p) => sum + Number(p.amount_iqd || 0), 0),
        postingFee: Number(agency.posting_fee_iqd || 0),
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی کۆمپانیای حەج و عومرە وەرگیرێت.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-umrah-agency-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'umrah_agencies', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'umrah_trips' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'umrah_bookings' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'umrah_payment_records' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'کۆی گەشتەکان', value: metrics.trips, icon: Plane, tone: 'orange' },
    { label: 'گەشتە پەسەندکراوەکان', value: metrics.approvedTrips, icon: CheckCircle2, tone: 'green' },
    { label: 'چاوەڕوانی پارەدان', value: metrics.pendingPayment, icon: WalletCards, tone: 'amber' },
    { label: 'چاوەڕوانی پشتڕاستکردنەوە', value: metrics.pendingVerification, icon: ShieldCheck, tone: 'violet' },
    { label: 'چاوەڕوانی پەسەند', value: metrics.pendingApproval, icon: Clock3, tone: 'blue' },
    { label: 'کۆی حجزەکان', value: metrics.bookings, icon: UsersRound, tone: 'teal' },
    { label: 'حجزە چاوەڕوانەکان', value: metrics.pendingBookings, icon: CalendarDays, tone: 'rose' },
    { label: 'پارەی پشتڕاستکراو', value: money(metrics.paymentVerifiedAmount), icon: CircleMoney, tone: 'gold', money: true },
  ], [metrics]);

  return <section className="shakhUmrahAgencyCenter" aria-labelledby="umrah-agency-center-title" dir="rtl">
    <div className="shakhUmrahAgencyHero">
      <div>
        <span className="shakhUmrahAgencyEyebrow"><Plane size={15}/> ناوەندی حەج و عومرە</span>
        <h2 id="umrah-agency-center-title">SHAKH Umrah Agency Center</h2>
        <p>{agencyName} — بەڕێوەبردنی کۆمپانیا، گەشتەکان، کرێی پۆستکردن و حجزەکان.</p>
      </div>
      <button type="button" className="shakhUmrahAgencyRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''}/> نوێکردنەوە
      </button>
    </div>

    {message && <div className="msg" role="alert">{message}</div>}

    {!metrics.agency && !loading && <div className="shakhUmrahAgencySetup">
      <div><strong>کۆمپانیای حەج و عومرە هێشتا تۆمار نەکراوە</strong><span>بۆ زیادکردنی گەشت، سەرەتا کۆمپانیا تۆمار بکە.</span></div>
      <button type="button" onClick={() => onNavigate('umrah')}><Plus size={17}/> تۆمارکردنی کۆمپانیا</button>
    </div>}

    <div className="shakhUmrahAgencyStats">
      {cards.map(({label,value,icon:Icon,tone,money:isMoney}) =>
        <article className="shakhUmrahAgencyStat" data-tone={tone} key={label}>
          <span className="shakhUmrahAgencyStatIcon"><Icon size={19}/></span>
          <div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div>
        </article>
      )}
    </div>

    <div className="shakhUmrahAgencyWorkspace">
      <div className="shakhUmrahAgencyWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>بەڕێوەبردنی کۆمپانیا و گەشت</h3></div>
        <small>{metrics.postingFee ? 'کرێی پۆستکردن: ' + money(metrics.postingFee) : 'کرێی پۆستکردن هێشتا دیاری نەکراوە'}</small>
      </div>
      <div className="shakhUmrahAgencyActionGrid">
        <button type="button" onClick={() => onNavigate('umrah')}><Plane/><span><b>گەشت و پەکەجەکان</b><small>{metrics.trips} گەشت</small></span></button>
        <button type="button" onClick={() => onNavigate('umrah')}><Plus/><span><b>زیادکردنی گەشت</b><small>پەکەجی نوێ دروست بکە</small></span></button>
        <button type="button" onClick={() => onNavigate('umrah')}><UsersRound/><span><b>حجزەکان</b><small>{metrics.bookings} حجز</small></span></button>
        <button type="button" onClick={() => onNavigate('manage_posts')}><FileText/><span><b>پۆستەکانی حەج و عومرە</b><small>بەڕێوەبردنی ناوەڕۆک</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards/><span><b>جزدان</b><small>باڵانس و مامەڵەکان</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell/><span><b>ئاگادارییەکان</b><small>نوێترین ئاگاداری</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound/><span><b>پرۆفایل</b><small>زانیاری هەژمار و کۆمپانیا</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><LifeBuoy/><span><b>پشتگیری</b><small>تیکەت و یارمەتی</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2/><span><b>ڕێکخستنەکان</b><small>هەژمار و ئاگاداری</small></span></button>
      </div>
    </div>

    <div className="shakhUmrahAgencyRecent">
      <div className="shakhUmrahAgencyRecentHead"><div><span>نوێترین گەشتەکان</span><h3>دۆخی گەشتەکانی کۆمپانیا</h3></div><small>{syncedAt ? 'sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small></div>
      {loading ? <div className="shakhUmrahAgencyEmpty">چاوەڕێ بکە...</div> : !recentTrips.length ? <div className="shakhUmrahAgencyEmpty">هێشتا هیچ گەشتێکت تۆمار نەکردووە.</div> :
        <div className="shakhUmrahAgencyRecentList">{recentTrips.map(trip =>
          <button type="button" className="shakhUmrahAgencyRecentRow" key={trip.id} onClick={() => onNavigate('umrah')}>
            <span><b>{trip.title || 'گەشتی حەج و عومرە'}</b><small>{[trip.destination,trip.departure_date,trip.return_date || ''].filter(Boolean).join(' · ')}</small></span>
            <strong>{statusLabels[trip.status || ''] || trip.status || '—'}</strong>
            <em>{Number(trip.total_price_iqd || 0).toLocaleString('en-US')} د.ع</em>
          </button>
        )}</div>}
    </div>
  </section>;
}

function CircleMoney(props: { size?: number }) {
  return <CircleDollarSignIcon size={props.size || 19} />;
}

function CircleDollarSignIcon({ size = 19 }: { size?: number }) {
  return <span style={{ display: 'inline-grid', placeItems: 'center', width: size, height: size, border: '2px solid currentColor', borderRadius: '50%', fontSize: Math.max(9, size * 0.55), fontWeight: 900 }}>د</span>;
}

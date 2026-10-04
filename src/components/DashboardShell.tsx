import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, Car, ChevronLeft, ClipboardList, LayoutDashboard, LifeBuoy, MapPinned,
  Menu, Plane, RefreshCw, Settings2, Store, Truck, UserRound, Users, WalletCards, X,
} from 'lucide-react';
import './dashboard-shell.css';
import '../shakh-dashboard-final-v15.css';
import '../shakh-dashboard-clean-v16.css';
import '../shakh-dashboard-typography-colors-v17.css';
import '../shakh-dashboard-unified-content-v18.css';
import UmrahAgencyModule from './UmrahAgencyModule';
import SupportModule from './SupportModule';
import { supabase } from '../lib/supabase';

export type DashboardView =
  | 'home' | 'services' | 'publish_post' | 'manage_posts' | 'profile' | 'users'
  | 'orders' | 'delivery' | 'delivery_zones' | 'store' | 'wallet' | 'cars'
  | 'umrah' | 'notifications' | 'support' | 'settings';

type DashboardOrder = { id: string; status: string; total_iqd: number; created_at: string };
type NavItem = {
  id: DashboardView;
  label: string;
  description: string;
  icon: React.ElementType;
  group: string;
  show?: boolean;
  tone?: 'brand' | 'blue' | 'green' | 'neutral';
};
type Props = {
  user: { email?: string | null };
  role: string;
  roleLabel: string;
  view: DashboardView;
  orders: DashboardOrder[];
  dirty: boolean;
  onSelectView: (view: DashboardView) => void;
  onClose: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  homeContent: React.ReactNode;
  children?: React.ReactNode;
};

function CarDealerModule() {
  const [cars, setCars] = useState<Array<{
    id: string; title?: string | null; price_iqd?: number | null; city?: string | null; status?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult.user?.id;
    if (!userId) { setCars([]); setLoading(false); return; }
    const { data } = await supabase.from('posts')
      .select('id,title,price_iqd,city,status')
      .eq('author_id', userId)
      .or('section.ilike.%car%,post_type.ilike.%car%,publisher_role.eq.car_dealer')
      .order('created_at', { ascending: false })
      .limit(100);
    setCars(data || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-car-dealer-shell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const active = cars.filter((car) => !['sold', 'cancelled', 'archived', 'rejected'].includes(String(car.status || '').toLowerCase())).length;
  const pending = cars.filter((car) => ['pending', 'review', 'draft'].includes(String(car.status || '').toLowerCase())).length;
  const sold = cars.filter((car) => String(car.status || '').toLowerCase() === 'sold').length;
  const value = cars.filter((car) => String(car.status || '').toLowerCase() !== 'sold').reduce((sum, car) => sum + Number(car.price_iqd || 0), 0);
  const navigate = (next: DashboardView) => window.dispatchEvent(new CustomEvent('shakh-dashboard-navigate', { detail: next }));

  return (
    <section className="shakhCarDealerSurface" dir="rtl">
      <div className="shakhModuleHero">
        <div>
          <span>SHAKH CARS</span>
          <h2>ناوەندی پێشانگای ئۆتۆمبێل</h2>
          <p>لیستەکانی ئۆتۆمبێلت لەسەر داتای ڕاستەقینەی Supabase بەڕێوەببە.</p>
        </div>
        <button type="button" className="shakhModuleRefresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'shakhSpin' : ''} /> نوێکردنەوە
        </button>
      </div>
      <div className="shakhModuleMetrics">
        <article><small>هەموو لیستەکان</small><strong>{cars.length.toLocaleString('ku-IQ')}</strong></article>
        <article><small>چالاک</small><strong>{active.toLocaleString('ku-IQ')}</strong></article>
        <article><small>چاوەڕوان</small><strong>{pending.toLocaleString('ku-IQ')}</strong></article>
        <article><small>فرۆشراو</small><strong>{sold.toLocaleString('ku-IQ')}</strong></article>
        <article><small>بەهای ستۆکی چالاک</small><strong>{value.toLocaleString('ku-IQ')} د.ع</strong></article>
      </div>
      <div className="shakhModuleGrid">
        <section className="shakhModuleCard">
          <small>دەستگەیشتنی خێرا</small><h3>کارە سەرەکییەکان</h3>
          <div className="shakhModuleActions">
            <button type="button" onClick={() => navigate('publish_post')}><Car /> بڵاوکردنەوەی ئۆتۆمبێل</button>
            <button type="button" onClick={() => navigate('manage_posts')}><ClipboardList /> پۆستەکان</button>
            <button type="button" onClick={() => navigate('wallet')}><WalletCards /> جزدان و داهات</button>
            <button type="button" onClick={() => navigate('profile')}><UserRound /> پرۆفایل و پێشانگا</button>
          </div>
        </section>
        <section className="shakhModuleCard">
          <div className="shakhModuleCardHead">
            <div><small>ئۆتۆمبێلە نوێکان</small><h3>دواین لیستەکان</h3></div>
            <span>{cars.slice(0, 6).length.toLocaleString('ku-IQ')} دانە</span>
          </div>
          <div className="shakhModuleList">
            {cars.slice(0, 6).map((car) => (
              <article key={car.id}>
                <div><strong>{car.title || 'ئۆتۆمبێلی بێ ناونیشان'}</strong><small>{car.city || 'شار دیاری نەکراوە'}</small></div>
                <b>{car.price_iqd ? Number(car.price_iqd).toLocaleString('ku-IQ') + ' د.ع' : 'نرخ دانەنراوە'}</b>
              </article>
            ))}
            {!cars.length && !loading && (
              <div className="shakhModuleEmpty"><Car size={24}/><strong>هێشتا هیچ لیستێکی ئۆتۆمبێل نییە</strong><small>لە «بڵاوکردنەوەی ئۆتۆمبێل» یەکەم لیست دروست بکە.</small></div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

const money = (value: number) => Number(value || 0).toLocaleString('ku-IQ') + ' د.ع';

export default function DashboardShell({
  user, role, roleLabel, view, orders, dirty, onSelectView, onClose, onRefresh, homeContent, children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isVendor = ['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor','beauty_vendor'].includes(role);
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isCustomer = role === 'customer';
  const isCaptain = role === 'captain';
  const isCarDealer = role === 'car_dealer';
  const isUmrahAgency = role === 'umrah_agency';

  const navItems = useMemo<NavItem[]>(() => [
    { id:'home', group:'سەرەتا', label:'پوختەی هەژمار', description:'کورتەی دۆخی هەژمار و چالاکییەکان', icon:LayoutDashboard, tone:'brand' },
    { id:'services', group:'سەرەتا', label:'ناوەندی خزمەتگوزاری', description:'هەموو بەشە گرنگەکانی شاخ', icon:Store, tone:'blue' },
    { id:'publish_post', group:'بڵاوکردنەوە', label:'بڵاوکردنەوە', description:'پۆست، بەرهەم، ئۆتۆمبێل و ناوەڕۆک', icon:ClipboardList, show:isCustomer||isAdmin||isCarDealer||isUmrahAgency, tone:'brand' },
    { id:'manage_posts', group:'بڵاوکردنەوە', label:'پۆستەکان', description:'بینین و بەڕێوەبردنی پۆستەکانت', icon:ClipboardList, tone:'neutral' },
    { id:'store', group:'بازاڕ و مامەڵە', label:'دوکان و ستۆک', description:'دوکان، بەرهەم و بازاڕ', icon:Store, show:!isCaptain, tone:'blue' },
    { id:'orders', group:'بازاڕ و مامەڵە', label:'ئۆردەرەکان', description:'دۆخ و بەدواداچوونی داواکارییەکان', icon:ClipboardList, tone:'brand' },
    { id:'delivery', group:'گەیاندن', label:'گەیاندن', description:'شوێنکەوتن و دۆخی گەیاندن', icon:Truck, show:!isVendor||isAdmin, tone:'green' },
    { id:'delivery_zones', group:'گەیاندن', label:'سنوری گەیاندن', description:'ناوچە و سنوری خزمەتگوزاری', icon:MapPinned, show:isVendor||isAdmin, tone:'blue' },
    { id:'cars', group:'خزمەتگوزاری تایبەت', label:'SHAKH Cars', description:'پێشانگا و بازاڕی ئۆتۆمبێل', icon:Car, show:!isCaptain, tone:'brand' },
    { id:'umrah', group:'خزمەتگوزاری تایبەت', label:'حەج و عومرە', description:'پەکەج و حجزکردنی گەشت', icon:Plane, show:!isCaptain, tone:'green' },
    { id:'wallet', group:'هەژمار و دارایی', label:'جزدان', description:'باڵانس، داهات و خاڵەکان', icon:WalletCards, tone:'green' },
    { id:'notifications', group:'هەژمار و دارایی', label:'ئاگادارکردنەوەکان', description:'ئاگاداریی نوێی هەژمار و ئۆردەر', icon:Bell, tone:'blue' },
    { id:'support', group:'هەژمار و دارایی', label:'پشتگیری', description:'تیکەت و بەدواداچوونی کێشەکان', icon:LifeBuoy, tone:'neutral' },
    { id:'profile', group:'هەژمار و دارایی', label:'پرۆفایل', description:'زانیاری هەژمار و ناسنامە', icon:UserRound, tone:'neutral' },
    { id:'users', group:'بەڕێوەبردن', label:'بەکارهێنەران', description:'لیستی بەکارهێنەران و ڕۆڵەکان', icon:Users, show:isAdmin, tone:'blue' },
    { id:'settings', group:'بەڕێوەبردن', label:'ڕێکخستنەکان', description:'هەژمار، ئاگاداری، ڕوکار و پلاتفۆرم', icon:Settings2, tone:'neutral' },
  ], [isAdmin,isCaptain,isCustomer,isCarDealer,isUmrahAgency,isVendor]);

  const items = navItems.filter(item => item.show !== false);
  const activeItem = items.find(item => item.id === view) ?? items[0];

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<DashboardView>).detail;
      if (next) { setMenuOpen(false); onSelectView(next); }
    };
    window.addEventListener('shakh-dashboard-navigate', handler);
    return () => window.removeEventListener('shakh-dashboard-navigate', handler);
  }, [onSelectView]);

  useEffect(() => setMenuOpen(false), [view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) setMenuOpen(false); else void onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen,onClose]);

  const totalValue = orders.reduce((sum, order) => sum + Number(order.total_iqd || 0), 0);
  const activeOrders = orders.filter(order => !['delivered','cancelled'].includes(order.status)).length;
  const deliveredOrders = orders.filter(order => order.status === 'delivered').length;

  return (
    <div className="shakhDashboardBackdrop" dir="rtl" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) void onClose();
    }}>
      <section className="shakhDashboardShell" data-role={role} role="dialog" aria-modal="true" aria-labelledby="shakh-dashboard-title">
        <header className="shakhDashboardTopbar">
          <div className="shakhDashboardIdentity">
            <button type="button" className="shakhDashboardMenuButton" onClick={() => setMenuOpen(true)} aria-label="کردنەوەی ناوبەری داشبۆرد"><Menu size={19}/></button>
            <span className="shakhDashboardBrandText" aria-hidden="true">SHAKH</span>
            <div className="shakhDashboardTitleBlock">
              <span>SHAKH • {roleLabel}</span>
              <h1 id="shakh-dashboard-title">{activeItem?.label || roleLabel}</h1>
              <p>{activeItem?.description || 'بەڕێوەبردنی هەژمار و خزمەتگوزارییەکان'}</p>
            </div>
          </div>
          <div className="shakhDashboardTopActions">
            <div className="shakhDashboardAccount"><small>هەژمار</small><strong>{roleLabel}</strong><span>{user.email || 'ئیمەیڵی هەژمار'}</span></div>
            <button type="button" className="shakhDashboardIconButton" onClick={() => void onRefresh()} title="نوێکردنەوە" aria-label="نوێکردنەوە"><RefreshCw size={18}/></button>
            <button type="button" className="shakhDashboardIconButton is-close" onClick={() => void onClose()} title="داخستن" aria-label="داخستن"><X size={19}/></button>
          </div>
        </header>

        <div className="shakhDashboardBody">
          {menuOpen && <button type="button" className="shakhDashboardScrim" aria-label="داخستنی ناوبەر" onClick={() => setMenuOpen(false)} />}
          <aside className={menuOpen ? 'shakhDashboardSidebar is-open' : 'shakhDashboardSidebar'} aria-label="ناوبەری داشبۆرد">
            <div className="shakhDashboardSidebarHeader">
              <div><small>ناوبەری هەژمار</small><strong>بەشەکان</strong></div>
              <button type="button" className="shakhDashboardSidebarClose" onClick={() => setMenuOpen(false)} aria-label="داخستن"><X size={17}/></button>
            </div>
            <nav className="shakhDashboardNav">
              {items.map((item,index) => {
                const Icon = item.icon;
                const active = item.id === view;
                const showGroup = index === 0 || items[index - 1]?.group !== item.group;
                return <React.Fragment key={item.id}>
                  {showGroup && <div className="shakhDashboardGroupLabel">{item.group}</div>}
                  <button type="button" className={active ? 'shakhDashboardNavItem is-active' : 'shakhDashboardNavItem'} data-tone={item.tone || 'neutral'} aria-current={active ? 'page' : undefined} onClick={() => onSelectView(item.id)}>
                    <span className="shakhDashboardNavIcon"><Icon size={17}/></span>
                    <span className="shakhDashboardNavCopy"><strong>{item.label}</strong><small>{item.description}</small></span>
                    {item.id === 'orders' && activeOrders > 0 && <span className="shakhDashboardNavBadge">{activeOrders > 99 ? '99+' : activeOrders}</span>}
                    <ChevronLeft size={15} className="shakhDashboardNavArrow"/>
                  </button>
                </React.Fragment>;
              })}
            </nav>
            <div className="shakhDashboardSidebarFooter"><span className="shakhDashboardStatusDot"/><div><strong>سیستەم چالاکە</strong><small>داتا لە SHAKH وەردەگیرێت</small></div></div>
          </aside>

          <main className="shakhDashboardMain">
            <div className="shakhDashboardToolbar">
              <div><small>{view === 'home' ? 'پوختەی هەژمار' : 'بەشی هەڵبژێردراو'}</small><strong>{activeItem?.label || roleLabel}</strong></div>
              <div className="shakhDashboardToolbarMeta">
                {dirty && <span className="shakhDashboardDirty">گۆڕانکاریی پاشەکەوت نەکراو هەیە</span>}
                <span className="shakhDashboardLive">● زیندوو</span>
              </div>
            </div>
            {view === 'home' ? (
              <div className="shakhDashboardHome">
                <div className="shakhDashboardWorkspace" data-view="home" data-role={role}>
                  {isCustomer && <section className="shakhDashboardKpis" aria-label="پوختەی داواکاری">
                    <article><span>هەموو ئۆردەر</span><strong>{orders.length.toLocaleString('ku-IQ')}</strong><small>کۆی داواکارییەکان</small></article>
                    <article data-tone="brand"><span>لە چاوەڕوانی</span><strong>{activeOrders.toLocaleString('ku-IQ')}</strong><small>ئۆردەری نەگەیەنراو</small></article>
                    <article data-tone="green"><span>گەیەندراو</span><strong>{deliveredOrders.toLocaleString('ku-IQ')}</strong><small>ئۆردەری تەواوکراو</small></article>
                    <article data-tone="blue"><span>کۆی نرخی ئۆردەر</span><strong>{money(totalValue)}</strong><small>لە زانیاریی بەردەست</small></article>
                  </section>}
                  <div className="shakhDashboardHomeContent">{homeContent}</div>
                </div>
              </div>
            ) : (
              <div className="shakhDashboardModule">
                <div className="shakhDashboardWorkspace" data-view={view} data-role={role}>
                  {view === 'cars' && role === 'car_dealer'
                    ? <CarDealerModule />
                    : view === 'umrah' && role === 'umrah_agency'
                    ? <UmrahAgencyModule />
                    : view === 'support'
                    ? <SupportModule role={role} />
                    : children}
                </div>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

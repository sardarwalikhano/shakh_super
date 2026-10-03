import React, { useEffect, useState } from 'react';
import {
  Bell,
  Car,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  Menu,
  Plane,
  RefreshCw,
  Settings2,
  Store,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import './dashboard-shell.css';
import UmrahAgencyModule from './UmrahAgencyModule';
import SupportCustomerServiceModule from './SupportCustomerServiceModule';
import SupportAgentModule from './SupportAgentModule';
import SupportModule from './SupportModule';
import { supabase } from '../lib/supabase';

export type DashboardView =
  | 'home'
  | 'services'
  | 'publish_post'
  | 'manage_posts'
  | 'profile'
  | 'users'
  | 'orders'
  | 'delivery'
  | 'delivery_zones'
  | 'store'
  | 'wallet'
  | 'cars'
  | 'umrah'
  | 'notifications'
  | 'support'
  | 'settings';

type DashboardOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
};

type NavItem = {
  id: DashboardView;
  label: string;
  description: string;
  icon: React.ElementType;
  group?: string;
  show?: boolean;
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


function CarDealerModule(){
  const [cars,setCars]=useState<Array<{id:string;title?:string|null;price_iqd?:number|null;city?:string|null;status?:string|null}>>([]);
  const [loading,setLoading]=useState(true);
  const load=async()=>{
    setLoading(true);
    const {data:userResult}=await supabase.auth.getUser();
    const userId=userResult.user?.id;
    if(!userId){setCars([]);setLoading(false);return;}
    const {data}=await supabase.from('posts').select('id,title,price_iqd,city,status').eq('author_id',userId)
      .or('section.ilike.%car%,post_type.ilike.%car%,publisher_role.eq.car_dealer')
      .order('created_at',{ascending:false}).limit(100);
    setCars(data||[]);setLoading(false);
  };
  useEffect(()=>{void load();const ch=supabase.channel('shakh-car-dealer-shell').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>void load()).subscribe();return()=>{void supabase.removeChannel(ch);};},[]);
  const active=cars.filter(c=>!['sold','cancelled','archived','rejected'].includes(String(c.status||'').toLowerCase())).length;
  const pending=cars.filter(c=>['pending','review','draft'].includes(String(c.status||'').toLowerCase())).length;
  const sold=cars.filter(c=>String(c.status||'').toLowerCase()==='sold').length;
  const value=cars.filter(c=>String(c.status||'').toLowerCase()!=='sold').reduce((s,c)=>s+Number(c.price_iqd||0),0);
  const nav=(view:DashboardView)=>window.dispatchEvent(new CustomEvent('shakh-dashboard-navigate',{detail:view}));
  return <section className="carDealerCenter" dir="rtl">
    <div className="carDealerHero"><div><span>SHAKH CARS • CAR DEALER</span><h2>ناوەندی پێشانگای ئۆتۆمبێل</h2><p>بەڕێوەبردنی لیستەکانی ئۆتۆمبێل لەسەر داتای ڕاستەقینەی Supabase.</p></div><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> نوێکردنەوە</button></div>
    <div className="carDealerStats">
      <article><small>هەموو لیستەکان</small><strong>{cars.length.toLocaleString('ku-IQ')}</strong></article>
      <article><small>چالاک</small><strong>{active.toLocaleString('ku-IQ')}</strong></article>
      <article><small>چاوەڕوان</small><strong>{pending.toLocaleString('ku-IQ')}</strong></article>
      <article><small>فرۆشراو</small><strong>{sold.toLocaleString('ku-IQ')}</strong></article>
      <article><small>بەهای ستۆکی چالاک</small><strong>{value.toLocaleString('ku-IQ')} د.ع</strong></article>
    </div>
    <div className="carDealerPanels">
      <div className="carDealerPanel"><small>دەستگەیشتنی خێرا</small><h3>کارە سەرەکییەکان</h3><div className="carDealerActions">
        <button type="button" onClick={()=>nav('publish_post')}><Car/> بڵاوکردنەوەی ئۆتۆمبێل</button>
        <button type="button" onClick={()=>nav('manage_posts')}><ClipboardList/> پۆستەکان</button>
        <button type="button" onClick={()=>nav('wallet')}><WalletCards/> جزدان و داهات</button>
        <button type="button" onClick={()=>nav('profile')}><UserRound/> پرۆفایل و پێشانگا</button>
      </div></div>
      <div className="carDealerPanel"><div className="carDealerPanelHead"><div><small>ئۆتۆمبێلە نوێکان</small><h3>دواین لیستەکان</h3></div><span>{cars.slice(0,6).length.toLocaleString('ku-IQ')} دانە</span></div>
        <div className="carDealerList">{cars.slice(0,6).map(car=><article key={car.id}><div><strong>{car.title||'ئۆتۆمبێلی بێ ناونیشان'}</strong><small>{car.city||'شار دیاری نەکراوە'}</small></div><b>{car.price_iqd?Number(car.price_iqd).toLocaleString('ku-IQ')+' د.ع':'نرخ دانەنراوە'}</b></article>)}{!cars.length&&!loading&&<div className="carDealerEmpty"><Car size={24}/><strong>هێشتا هیچ لیستێکی ئۆتۆمبێل نییە</strong><small>لە «بڵاوکردنەوەی ئۆتۆمبێل» یەکەم لیست دروست بکە.</small></div>}</div>
      </div>
    </div>
  </section>;
}

const money = (value: number) => `${Number(value || 0).toLocaleString('ku-IQ')} د.ع`;

export default function DashboardShell({
  user,
  role,
  roleLabel,
  view,
  orders,
  dirty,
  onSelectView,
  onClose,
  onRefresh,
  homeContent,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isVendor = [
    'restaurant_vendor',
    'supermarket_vendor',
    'fashion_vendor',
    'vendor',
    'electronics_vendor',
    'jewelry_vendor',
    'beauty_vendor',
  ].includes(role);
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isCaptain = role === 'captain';
  const isCustomer = role === 'customer';
  const isCarDealer = role === 'car_dealer';
  const isUmrahAgency = role === 'umrah_agency';
  const isSupport = role === 'support';
  const isSupport = role === 'support';
  const isSupport = role === 'support';
  const showGenericStats = role === 'customer';

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'پوختەی هەژمار',
      description: 'کورتەی ئۆردەر و دۆخی هەژمار',
      icon: LayoutDashboard,
      group: 'پوختە',
    },
    {
      id: 'services',
      label: 'ناوەندی خزمەتگوزاری',
      description: 'هەموو خزمەتگوزارییەکانی شاخ لە یەک شوێن',
      icon: Store,
      group: 'خزمەتگوزاری و پۆست',
    },
    {
      id: 'publish_post',
      label: 'چی دەتەوێت بڵاو بکەیتەوە؟',
      description: 'پۆست، بەرهەم، ئۆتۆمبێل و ناوەڕۆک',
      icon: ClipboardList,
      group: 'خزمەتگوزاری و پۆست',
      show: isCustomer || isAdmin || isCarDealer || isUmrahAgency,
    },
    {
      id: 'manage_posts',
      label: 'بەڕێوەبردنی پۆستەکان',
      description: 'پۆستەکانت ببینە، دەستکاری بکە و بەڕێوەیانبە',
      icon: ClipboardList,
      group: 'خزمەتگوزاری و پۆست',
    },
    {
      id: 'profile',
      group: 'هەژمار و بەدواداچوون',
      label: 'پرۆفایل',
      description: 'ناو، تەلەفون، شار، زمان و وێنە',
      icon: UserRound,
    },
    {
      id: 'users',
      group: 'بەڕێوبەرایەتی',
      label: 'بەکارهێنەران',
      description: 'لیستی بەکارهێنەران و ڕۆڵەکان',
      icon: Users,
      show: isAdmin,
    },
    {
      id: 'store',
      group: 'هەژمار و بەدواداچوون',
      label: 'دوکانەکان',
      description: 'بینینی بازاڕ و ئۆردەر',
      icon: Store,
      show: !isCaptain,
    },
    {
      id: 'orders',
      group: 'هەژمار و بەدواداچوون',
      label: 'ئۆردەرەکان',
      description: 'بینین و بەدواداچوونی داواکارییەکان',
      icon: ClipboardList,
    },
    {
      id: 'delivery',
      group: 'هەژمار و بەدواداچوون',
      label: 'گەیاندن',
      description: 'شوێنکەوتن و دۆخی گەیاندن',
      icon: Truck,
      show: !isVendor || isAdmin,
    },
    {
      id: 'delivery_zones',
      group: 'هەژمار و بەدواداچوون',
      label: 'سنوری گەیاندن',
      description: 'ناوچە و سنوری خزمەتگوزاری',
      icon: MapPinned,
      show: isVendor || isAdmin,
    },
    {
      id: 'cars',
      group: 'هەژمار و بەدواداچوون',
      label: 'SHAKH Cars',
      description: 'پێشانگا و ئۆتۆمبێلەکان',
      icon: Car,
      show: !isCaptain,
    },
    {
      id: 'umrah',
      group: 'هەژمار و بەدواداچوون',
      label: 'حەج و عومرە',
      description: 'حجز و زانیاریی گەشت',
      icon: Plane,
      show: !isCaptain,
    },
    {
      id: 'wallet',
      group: 'هەژمار و بەدواداچوون',
      label: 'جزدان',
      description: 'باڵانس، داهات و خاڵەکان',
      icon: WalletCards,
    },
    {
      id: 'notifications',
      group: 'هەژمار و بەدواداچوون',
      label: 'ئاگادارکردنەوەکان',
      description: 'ئاگادارییەکانی ئۆردەر و هەژمار',
      icon: Bell,
    },
    {
      id: 'support',
      group: 'هەژمار و بەدواداچوون',
      label: 'پشتگیری',
      description: 'تیکەت و بەدواداچوونی کێشەکان',
      icon: LifeBuoy,
    },
    {
      id: 'settings',
      group: 'هەژمار و بەدواداچوون',
      label: 'ڕێکخستنەکان',
      description: 'هەژمار، ئاگاداری، شوێن و پلاتفۆرم',
      icon: Settings2,
    },
  ];

  const items = navItems.filter((item) => item.show !== false);

  const activeItem = items.find((item) => item.id === view) ?? items[0];

  useEffect(() => { const handler = (event: Event) => { const next = (event as CustomEvent<DashboardView>).detail; if (next) onSelectView(next); }; window.addEventListener('shakh-dashboard-navigate', handler); return () => window.removeEventListener('shakh-dashboard-navigate', handler); }, [onSelectView]);

  useEffect(() => {
    setMenuOpen(false);
  }, [view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        void onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, onClose]);

  const totalValue = orders.reduce((sum, order) => sum + Number(order.total_iqd || 0), 0);
  const activeOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length;
  const deliveredOrders = orders.filter((order) => order.status === 'delivered').length;

  return (
    <div className="dashboardShellBackdrop" dir="rtl" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) void onClose();
    }}>
      <section
        className="dashboardShell"
        data-role={role}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shakh-dashboard-title"
      >
        <header className="dashboardShellHeader">
          <div className="dashboardShellIdentity">
            <button
              type="button"
              className="dashboardShellMobileMenu"
              onClick={() => setMenuOpen(true)}
              aria-label="کردنەوەی بەشەکانی داشبۆرد"
            >
              <Menu size={20} />
            </button>
            <div className="dashboardShellBrandMark" aria-hidden="true">
              <img src="/shakh-logo.svg?v=1.9.8" alt="" />
            </div>
            <div className="dashboardShellHeading">
              <span className="dashboardShellOverline">SHAKH • DASHBOARD</span>
              <h1 id="shakh-dashboard-title">{activeItem?.label || roleLabel}</h1>
              <p>{activeItem?.description || 'بەڕێوەبردنی هەژمار و خزمەتگوزارییەکان'}</p>
            </div>
          </div>
          <div className="dashboardShellHeaderActions">
            <div className="dashboardShellAccount">
              <span>هەژمار</span>
              <strong>{roleLabel}</strong>
              <small>{user.email || 'ئیمەیڵی هەژمار'}</small>
            </div>
            <button
              type="button"
              className="dashboardShellIconButton"
              onClick={() => void onRefresh()}
              aria-label="نوێکردنەوەی داشبۆرد"
              title="نوێکردنەوە"
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              className="dashboardShellIconButton dashboardShellClose"
              onClick={() => void onClose()}
              aria-label="داخستنی داشبۆرد"
              title="داخستن"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="dashboardShellBody">
          {menuOpen && (
            <button
              type="button"
              className="dashboardShellDrawerScrim"
              aria-label="داخستنی ناوبەری بەشەکان"
              onClick={() => setMenuOpen(false)}
            />
          )}
          <aside className={`dashboardShellSidebar ${menuOpen ? 'is-open' : ''}`} aria-label="بەشەکانی داشبۆرد">
            <div className="dashboardShellSidebarHead">
              <div>
                <span>ناوبەری هەژمار</span>
                <strong>بەشەکان</strong>
              </div>
              <button
                type="button"
                className="dashboardShellMobileClose"
                onClick={() => setMenuOpen(false)}
                aria-label="داخستنی ناوبەری بەشەکان"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="dashboardShellNav">
              {items.map((item, index) => {
                const Icon = item.icon;
                const isActive = item.id === view;
                const isOrders = item.id === 'orders';
                const previousGroup = items[index - 1]?.group;
                const showGroup = Boolean(item.group && item.group !== previousGroup);
                return (
                  <React.Fragment key={item.id}>
                    {showGroup && <div className="dashboardShellNavGroupLabel">{item.group}</div>}
                    <button
                      type="button"
                      className={`dashboardShellNavItem ${isActive ? 'is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelectView(item.id)}
                    >
                      <span className="dashboardShellNavIcon">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span className="dashboardShellNavCopy">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      {isOrders && activeOrders > 0 && (
                        <span className="dashboardShellNavBadge">{activeOrders > 99 ? '99+' : activeOrders}</span>
                      )}
                      <ChevronLeft size={15} className="dashboardShellNavArrow" />
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            <div className="dashboardShellSidebarFooter">
              <span className="dashboardShellStatusDot" />
              <div>
                <strong>پلاتفۆرم چالاکە</strong>
                <small>داتا لە شاخ وەردەگیرێت</small>
              </div>
            </div>
          </aside>

          <main className="dashboardShellMain">
            <div className="dashboardShellToolbar">
              <div>
                <span>{view === 'home' ? 'پوختەی هەژمار' : 'بەشی هەڵبژێردراو'}</span>
                <strong>{activeItem?.label || roleLabel}</strong>
              </div>
              {dirty && (
                <span className="dashboardShellDirty">
                  گۆڕانکاریی پاشەکەوت نەکراو هەیە
                </span>
              )}
            </div>

            {view === 'home' ? (
              <div className="dashboardShellOverview">
                {showGenericStats && <section className="dashboardShellStats" aria-label="پوختەی داواکاری">
                  <div className="dashboardShellStat">
                    <span>هەموو ئۆردەر</span>
                    <strong>{orders.length.toLocaleString('ku-IQ')}</strong>
                    <small>کۆی داواکارییەکان</small>
                  </div>
                  <div className="dashboardShellStat is-attention">
                    <span>پێویستی بە سەرنجدان</span>
                    <strong>{activeOrders.toLocaleString('ku-IQ')}</strong>
                    <small>ئۆردەری نەگەیەنراو</small>
                  </div>
                  <div className="dashboardShellStat">
                    <span>گەیەندراو</span>
                    <strong>{deliveredOrders.toLocaleString('ku-IQ')}</strong>
                    <small>ئۆردەری تەواوکراو</small>
                  </div>
                  <div className="dashboardShellStat is-money">
                    <span>کۆی نرخی ئۆردەر</span>
                    <strong>{money(totalValue)}</strong>
                    <small>لە زانیاریی بەردەست</small>
                  </div>
                </section>}
                
                <div className="dashboardShellHomeContent">{homeContent}</div>
              </div>
            ) : (
              <div className="dashboardShellModule">{view === 'cars' && role === 'car_dealer' ? <CarDealerModule /> : view === 'umrah' && role === 'umrah_agency' ? <UmrahAgencyModule /> : view === 'support' && (isSupport || isAdmin) ? <SupportModule /> : children}</div>
            )}
          </main>
        </div>

      </section>
    </div>
  );
}

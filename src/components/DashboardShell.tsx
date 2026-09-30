import React, { useEffect, useMemo, useState } from 'react';
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
  WalletCards,
  X,
} from 'lucide-react';
import './dashboard-shell.css';

export type DashboardView =
  | 'home'
  | 'profile'
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
  ].includes(role);
  const isAdmin = role === 'super_admin' || role === 'admin';

  const items = useMemo((): NavItem[] => [
    {
      id: 'home',
      label: 'سەرەکی داشبۆرد',
      description: 'پوختە و بەشە سەرەکییەکان',
      icon: LayoutDashboard,
    },
    {
      id: 'profile',
      label: 'پرۆفایل',
      description: 'ناو، تەلەفون، شار، زمان و وێنە',
      icon: UserRound,
    },
    {
      id: 'store',
      label: 'دوکانەکان',
      description: 'بینینی بازاڕ و ئۆردەر',
      icon: Store,
    },
    {
      id: 'orders',
      label: 'ئۆردەرەکان',
      description: 'بینین و بەدواداچوونی داواکارییەکان',
      icon: ClipboardList,
    },
    {
      id: 'delivery',
      label: 'گەیاندن',
      description: 'شوێنکەوتن و دۆخی گەیاندن',
      icon: Truck,
    },
    {
      id: 'delivery_zones',
      label: 'سنوری گەیاندن',
      description: 'ناوچە و سنوری خزمەتگوزاری',
      icon: MapPinned,
      show: isVendor || isAdmin,
    },
    {
      id: 'cars',
      label: 'SHAKH Cars',
      description: 'پێشانگا و ئۆتۆمبێلەکان',
      icon: Car,
    },
    {
      id: 'umrah',
      label: 'حەج و عومرە',
      description: 'حجز و زانیاریی گەشت',
      icon: Plane,
    },
    {
      id: 'wallet',
      label: 'جزدان',
      description: 'باڵانس، داهات و خاڵەکان',
      icon: WalletCards,
    },
    {
      id: 'notifications',
      label: 'ئاگادارکردنەوەکان',
      description: 'ئاگادارییەکانی ئۆردەر و هەژمار',
      icon: Bell,
    },
    {
      id: 'support',
      label: 'پشتگیری',
      description: 'تیکەت و بەدواداچوونی کێشەکان',
      icon: LifeBuoy,
    },
    {
      id: 'settings',
      label: 'ڕێکخستنەکان',
      description: 'هەژمار، ئاگاداری، شوێن و پلاتفۆرم',
      icon: Settings2,
    },
  ].filter((item) => item.show !== false), [isAdmin, isVendor]);

  const activeItem = items.find((item) => item.id === view) ?? items[0];

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
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === view;
                const isOrders = item.id === 'orders';
                return (
                  <button
                    key={item.id}
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
                <section className="dashboardShellStats" aria-label="پوختەی داواکاری">
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
                </section>

                <section className="dashboardShellServiceIndex" aria-labelledby="dashboard-services-title">
                  <div className="dashboardShellSectionIntro">
                    <div>
                      <span>ناوەندی خزمەتگوزاری</span>
                      <h2 id="dashboard-services-title">هەر شتێک لە شوێنی خۆی</h2>
                    </div>
                    <p>بەشی پێویست هەڵبژێرە؛ زانیارییەکان لە هەمان shell ـدا دەکرێنەوە.</p>
                  </div>
                  <div className="dashboardShellServiceList">
                    {items.filter((item) => item.id !== 'home').map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="dashboardShellServiceRow"
                          onClick={() => onSelectView(item.id)}
                        >
                          <span className="dashboardShellServiceIcon">
                            <Icon size={20} />
                          </span>
                          <span className="dashboardShellServiceCopy">
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                          <span className="dashboardShellServiceAction">
                            کردنەوە
                            <ChevronLeft size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="dashboardShellHomeContent">{homeContent}</div>
              </div>
            ) : (
              <div className="dashboardShellModule">{children}</div>
            )}
          </main>
        </div>

        {menuOpen && <button
          type="button"
          className="dashboardShellDrawerScrim"
          aria-label="داخستنی ناوبەری"
          onClick={() => setMenuOpen(false)}
        />}
      </section>
    </div>
  );
}

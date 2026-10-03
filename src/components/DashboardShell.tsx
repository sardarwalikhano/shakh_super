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
              <div className="dashboardShellModule">{children}</div>
            )}
          </main>
        </div>

      </section>
    </div>
  );
}

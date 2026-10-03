import { Bell, LayoutDashboard, MapPin, Moon, Search, ShoppingBag, Sun, User as UserIcon, Store, Truck, Car, Plane, MessageCircle } from 'lucide-react';

type Props = {
  user: { email?: string | null } | null;
  search: string;
  onSearchChange: (value: string) => void;
  locationReady: boolean;
  locating: boolean;
  onDetectLocation: () => void;
  currentTheme: 'light' | 'dark';
  onToggleTheme: () => void | Promise<void>;
  unreadNotifications: number;
  cartCount: number;
  onOpenDashboard: (view?: 'home' | 'notifications' | 'profile' | 'cars' | 'umrah') => void;
  onLogin: () => void;
  onOpenCart: () => void;
};

export default function GlobalHeader({
  user,
  search,
  onSearchChange,
  locationReady,
  locating,
  onDetectLocation,
  currentTheme,
  onToggleTheme,
  unreadNotifications,
  cartCount,
  onOpenDashboard,
  onLogin,
  onOpenCart,
}: Props) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <header className="shakhGlobalHeader">
      <div className="shakhUtilityBar">
        <div className="shakhUtilityInner">
          <button type="button" onClick={onDetectLocation} disabled={locating} className="shakhUtilityLocation">
            <MapPin size={15} />
            <span>{locating ? 'شوێن...' : locationReady ? 'هەولێر • شوێن دیارە' : 'هەولێر'}</span>
          </button>
          <div className="shakhUtilityLinks">
            <button type="button" onClick={() => scrollTo('shakh-live-feed')}>پۆست و ئۆفەر</button>
            <button type="button" onClick={() => scrollTo('shakh-services')}>پشتگیری</button>
            <button type="button" onClick={() => scrollTo('shakh-marketplace')}>یارمەتیدان</button>
            <button type="button" onClick={onLogin}>خۆتۆمارکردن</button>
          </div>
          <div className="shakhUtilityTools">
            <button type="button" onClick={() => void onToggleTheme()} aria-label={currentTheme === 'dark' ? 'گۆڕین بۆ ڕوون' : 'گۆڕین بۆ تاریک'}>
              {currentTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className="shakhUtilityLanguage">کوردی <b>🇮🇶</b></span>
          </div>
        </div>
      </div>

      <div className="shakhHeaderInner">
        <a className="shakhBrand" href="/" aria-label="SHAKH — شاخ">
          <span className="shakhBrandLogo">
            <img src="/shakh-logo.svg?v=1.9.8" alt="" />
          </span>
          <span className="shakhBrandText">
            <strong>SHAKH SUPER</strong>
            <small>بازاڕ • گەیاندن • خزمەتگوزاری</small>
          </span>
        </a>

        <div className="shakhHeaderSearch" role="search">
          <Search size={20} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="گەڕان لە هەموو گەڕانەکانی شاخ..."
            aria-label="گەڕان"
          />
          <button type="button" className="shakhHeaderSearchFilter" onClick={() => scrollTo('shakh-marketplace')}>هەموو جۆرەکان <span>⌄</span></button>
        </div>

        <div className="shakhHeaderActions">
          <button type="button" className="shakhHeaderAccount" onClick={() => (user ? onOpenDashboard('home') : onLogin())}>
            {user ? <LayoutDashboard size={21} /> : <UserIcon size={21} />}
            <span><small>{user ? 'بەخێربێیت' : 'چوونەژوورەوە'}</small><b>{user ? 'هەژماری من' : 'هەژماری من'}</b></span>
          </button>
          <button type="button" className="shakhIconAction has-badge" onClick={() => (user ? onOpenDashboard('notifications') : onLogin())} aria-label="ئاگادارکردنەوەکان">
            <Bell size={21} />
            {user && unreadNotifications > 0 && <span className="shakhActionBadge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
          </button>
          <button type="button" className="shakhIconAction" onClick={onOpenCart} aria-label="سەلە">
            <ShoppingBag size={21} />
            {cartCount > 0 && <span className="shakhActionBadge">{cartCount > 99 ? '99+' : cartCount}</span>}
          </button>
        </div>
      </div>

      <nav className="shakhReferenceHeaderNav" aria-label="بەشە سەرەکییەکانی شاخ">
        <button type="button" onClick={() => scrollTo('shakh-offers')}><span>🔥</span><b>پێشکەش</b></button>
        <button type="button" onClick={() => scrollTo('shakh-marketplace')}><Store size={19}/><b>مارکێت</b></button>
        <button type="button" onClick={() => scrollTo('shakh-marketplace')}><span>👕</span><b>جلی و پۆشاک</b></button>
        <button type="button" onClick={() => scrollTo('shakh-marketplace')}><span>🥩</span><b>گوشت و ماسی</b></button>
        <button type="button" onClick={() => scrollTo('shakh-marketplace')}><span>📱</span><b>ئەلکترۆنیک</b></button>
        <button type="button" onClick={() => onOpenDashboard(user ? 'umrah' : undefined)}><Plane size={19}/><b>عومرە</b></button>
        <button type="button" onClick={() => onOpenDashboard(user ? 'cars' : undefined)}><Car size={19}/><b>سیارەکان</b></button>
        <button type="button" onClick={() => scrollTo('shakh-services')}><Truck size={19}/><b>گەیاندن</b></button>
        <button type="button" onClick={() => scrollTo('shakh-live-feed')}><MessageCircle size={19}/><b>پۆست و ئۆفەر</b></button>
      </nav>

      <div className="shakhMobileSearch">
        <div className="shakhHeaderSearch">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="گەڕان لە شاخ..."
            aria-label="گەڕانی مۆبایل"
          />
        </div>
      </div>
    </header>
  );
}

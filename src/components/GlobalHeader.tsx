import { Bell, LayoutDashboard, MapPin, Moon, Search, ShoppingBag, Sun, User as UserIcon } from 'lucide-react';

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
  onOpenDashboard: (view?: 'home' | 'notifications' | 'profile') => void;
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
  return (
    <header className="shakhGlobalHeader">
      <div className="shakhHeaderInner">
        <a className="shakhBrand" href="/" aria-label="SHAKH — شاخ">
          <span className="shakhBrandLogo">
            <img src="/shakh-logo.svg?v=1.9.8" alt="" />
          </span>
          <span className="shakhBrandText">
            <strong>SHAKH</strong>
            <small>شاخ • بازاڕ و گەیاندن</small>
          </span>
        </a>

        <div className="shakhHeaderSearch" role="search">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="گەڕان لە خواردن، بازاڕ و بەرهەم..."
            aria-label="گەڕان"
          />
        </div>

        <div className="shakhHeaderActions">
          <button
            type="button"
            className={locationReady ? 'shakhHeaderAction is-ready' : 'shakhHeaderAction'}
            onClick={onDetectLocation}
            disabled={locating}
            aria-label="دیاریکردنی شوێنی من"
          >
            <MapPin size={17} />
            <span>{locating ? 'شوێن...' : locationReady ? 'شوێن دیارە' : 'شوێن'}</span>
          </button>

          <button
            type="button"
            className="shakhIconAction"
            onClick={() => void onToggleTheme()}
            aria-label={currentTheme === 'dark' ? 'گۆڕین بۆ ڕوون' : 'گۆڕین بۆ تاریک'}
            title={currentTheme === 'dark' ? 'ڕوون' : 'تاریک'}
          >
            {currentTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="shakhIconAction has-badge"
            onClick={() => (user ? onOpenDashboard('notifications') : onLogin())}
            aria-label="ئاگادارکردنەوەکان"
          >
            <Bell size={18} />
            {user && unreadNotifications > 0 && (
              <span className="shakhActionBadge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
            )}
          </button>

          <button
            type="button"
            className="shakhIconAction has-badge"
            onClick={onOpenCart}
            aria-label="سەلە"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && <span className="shakhActionBadge">{cartCount > 99 ? '99+' : cartCount}</span>}
          </button>

          <button
            type="button"
            className="shakhDashboardAction"
            onClick={() => (user ? onOpenDashboard('home') : onLogin())}
          >
            {user ? <LayoutDashboard size={17} /> : <UserIcon size={17} />}
            <span>{user ? 'داشبۆرد' : 'چوونەژوورەوە'}</span>
          </button>
        </div>
      </div>
      <div className="shakhMobileSearch">
        <div className="shakhHeaderSearch">
          <Search size={17} aria-hidden="true" />
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

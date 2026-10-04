import { ArrowUp, Headphones, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import PwaInstallUpdate from './PwaInstallUpdate';

type Props = {
  user: { email?: string | null } | null;
  onOpenDashboard: (view?: 'orders' | 'delivery' | 'store' | 'cars' | 'umrah') => void;
  onOpenPrivacy: () => void;
};

export default function GlobalFooter({ user, onOpenDashboard, onOpenPrivacy }: Props) {
  return (
    <footer className="shakhGlobalFooter" dir="rtl">
      <div className="shakhFooterCompact">
        <div className="shakhFooterIdentity">
          <div>
            <strong>SHAKH</strong>
            <small>بازاڕ، گەیاندن و خزمەتگوزاری</small>
          </div>
        </div>

        <nav className="shakhFooterLinks" aria-label="بەستەرەکانی شاخ">
          <button type="button" onClick={() => onOpenDashboard('store')}>بازاڕ</button>
          <button type="button" onClick={() => onOpenDashboard('delivery')}>گەیاندن</button>
          <button type="button" onClick={() => onOpenDashboard('cars')}>Cars</button>
          <button type="button" onClick={() => onOpenDashboard('umrah')}>عومرە</button>
          <button type="button" onClick={() => user ? onOpenDashboard('orders') : window.scrollTo({ top: 0, behavior: 'smooth' })}>ئۆردەرەکان</button>
          <button type="button" onClick={onOpenPrivacy}><ShieldCheck size={14}/> پاراستن</button>
        </nav>

        <div className="shakhFooterSupport">
          <span><Headphones size={14}/> پشتگیری</span>
          <a href="tel:+9647504796924"><MessageCircle size={14}/> 07504796924</a>
        </div>
      </div>

      <div className="shakhFooterUtility">
        <PwaInstallUpdate />
      </div>

      <div className="shakhFooterBottom">
        <span>© ٢٠٢٦ شاخ — هەموو مافەکان پارێزراون</span>
        <div>
          <span><MapPin size={12}/> هەولێر</span>
          <span>وشانی ١.٩.٨</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="سەرەوە">
            <ArrowUp size={14}/>
          </button>
        </div>
      </div>
    </footer>
  );
}

import { ArrowUp, Headphones, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import PwaInstallUpdate from './PwaInstallUpdate';

type Props = {
  user: { email?: string | null } | null;
  onOpenDashboard: (view?: 'orders' | 'delivery' | 'store' | 'cars' | 'umrah') => void;
  onOpenPrivacy: () => void;
};

export default function GlobalFooter({ user, onOpenDashboard, onOpenPrivacy }: Props) {
  return (
    <footer className="shakhGlobalFooter">
      <div className="shakhFooterTop">
        <div className="shakhFooterBrandBlock">
          <span className="shakhFooterLogo"><img src="/shakh-logo.svg?v=1.9.8" alt="شاخ" /></span>
          <div>
            <strong>SHAKH</strong>
            <small>لەگەڵ شاخ دەگەیتە لوتکە</small>
          </div>
          <p>بازاڕ، گەیاندن، ئۆتۆمبێل و خزمەتگوزارییەکان لە یەک پلاتفۆرم.</p>
        </div>

        <div className="shakhFooterColumn">
          <span>خزمەتگوزاری</span>
          <button type="button" onClick={() => onOpenDashboard('store')}>دوکان و بازاڕ</button>
          <button type="button" onClick={() => onOpenDashboard('delivery')}>گەیاندن</button>
          <button type="button" onClick={() => onOpenDashboard('cars')}>SHAKH Cars</button>
          <button type="button" onClick={() => onOpenDashboard('umrah')}>حەج و عومرە</button>
        </div>

        <div className="shakhFooterColumn">
          <span>هەژمار</span>
          <button type="button" onClick={() => (user ? onOpenDashboard('orders') : window.scrollTo({ top: 0, behavior: 'smooth' }))}>داواکارییەکان</button>
          <button type="button" onClick={() => (user ? onOpenDashboard('store') : window.scrollTo({ top: 0, behavior: 'smooth' }))}>بەشەکان</button>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>سەرەکی</button>
        </div>

        <div className="shakhFooterColumn">
          <span>پشتگیری و پاراستن</span>
          <div className="shakhFooterContact"><Headphones size={16} /> <b>پشتگیری شاخ</b></div>
          <a href="tel:+9647504796924"><MessageCircle size={15} /> 07504796924</a>
          <button type="button" onClick={onOpenPrivacy}><ShieldCheck size={15} /> سیاسەتی پاراستنی نهێنی</button>
        </div>
      </div>

      <div className="shakhFooterUtility">
        <PwaInstallUpdate />
      </div>

      <div className="shakhFooterBottom">
        <span>© ٢٠٢٦ شاخ — هەموو مافەکان پارێزراون</span>
        <div>
          <span><MapPin size={13} /> هەولێر</span>
          <span>وشانی ١.٩.٨</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="سەرەوە">
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}

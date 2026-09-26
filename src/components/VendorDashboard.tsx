import React from 'react';
import { Package, ShoppingBag, TrendingUp, Store, Plus, RefreshCw } from 'lucide-react';

type VendorDashboardProps = {
  storeName?: string;
  productCount?: number;
  pendingOrders?: number;
  todaySales?: number;
  onRefresh?: () => void;
};

export default function VendorDashboard({
  storeName = 'دوکانی من',
  productCount = 0,
  pendingOrders = 0,
  todaySales = 0,
  onRefresh,
}: VendorDashboardProps) {
  return (
    <section className="vendor-dashboard" dir="rtl">
      <div className="vendor-dashboard__header">
        <div>
          <span className="vendor-dashboard__eyebrow">داشبۆردی خاوەن دوکان</span>
          <h2>{storeName}</h2>
          <p>بەڕێوەبردنی بەرهەم و داواکارییەکانی دوکان لە یەک شوێن.</p>
        </div>
        <div className="vendor-dashboard__actions">
          <button className="vendor-dashboard__secondary" onClick={onRefresh} type="button">
            <RefreshCw size={17} /> نوێکردنەوە
          </button>
          <button className="vendor-dashboard__primary" type="button">
            <Plus size={17} /> زیادکردنی بەرهەم
          </button>
        </div>
      </div>

      <div className="vendor-dashboard__stats">
        <article><Package /><span>بەرهەمەکان</span><strong>{productCount.toLocaleString('ku-IQ')}</strong></article>
        <article><ShoppingBag /><span>داواکارییە چاوەڕوانەکان</span><strong>{pendingOrders.toLocaleString('ku-IQ')}</strong></article>
        <article><TrendingUp /><span>فرۆشی ئەمڕۆ</span><strong>{todaySales.toLocaleString('ku-IQ')} د.ع</strong></article>
        <article><Store /><span>دۆخی دوکان</span><strong className="is-live">چالاک</strong></article>
      </div>

      <div className="vendor-dashboard__empty">
        <ShoppingBag size={42} />
        <h3>بەخێربێیت بۆ داشبۆردی دوکان</h3>
        <p>لە هەنگاوی دواتردا بەرهەمەکان و داواکارییەکانت بە شێوەی زیندوو لێرە بەڕێوە دەبەین.</p>
      </div>
    </section>
  );
}

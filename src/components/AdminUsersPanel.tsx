import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, Store, UsersRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { onBack?: () => void };

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: string | null;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'بەڕێوبەری باڵا',
  admin: 'بەڕێوبەر',
  customer: 'کڕیار',
  captain: 'کاپتن',
  restaurant_vendor: 'چێشتخانە',
  supermarket_vendor: 'سووپەرمارکێت',
  fashion_vendor: 'جل و بەرگ',
  vendor: 'خاوەن دوکان',
  electronics_vendor: 'ئەلیکترۆنیات',
  jewelry_vendor: 'جواکاری',
  beauty_vendor: 'جوانکاری',
  car_dealer: 'پێشانگای ئۆتۆمبێل',
  umrah_agency: 'کۆمپانیای عومرە',
  support: 'پشتگیری',
};

const ALL_FILTER = 'all';

export default function AdminUsersPanel({ onBack }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_FILTER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('id,full_name,email,phone,city,role,created_at')
      .order('created_at', { ascending: false })
      .limit(250);

    if (loadError) {
      setError('نەتوانرا لیستی بەکارهێنەران وەرگیرێت.');
    } else {
      setUsers((data ?? []) as UserRow[]);
      setSyncedAt(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shakh-admin-users-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const roleOptions = useMemo(
    () => Array.from(new Set(users.map((user) => user.role).filter(Boolean) as string[])),
    [users],
  );

  const filtered = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase('ku');
    return users.filter((user) => {
      const roleMatches = roleFilter === ALL_FILTER || user.role === roleFilter;
      const haystack = [
        user.full_name ?? '',
        user.email ?? '',
        user.phone ?? '',
        user.city ?? '',
        user.id,
        user.role ? ROLE_LABELS[user.role] ?? user.role : '',
      ].join(' ').toLocaleLowerCase('ku');
      return roleMatches && (!clean || haystack.includes(clean));
    });
  }, [query, roleFilter, users]);

  return (
    <section className="shakhAdminUsers" aria-labelledby="admin-users-title" dir="rtl">
      <header className="shakhAdminUsersHero">
        <div>
          <span className="shakhAdminUsersEyebrow"><ShieldCheck size={15} /> بەشی بەڕێوبەرایەتی</span>
          <h2 id="admin-users-title">بەکارهێنەران</h2>
          <p>بینینی لیستی بەکارهێنەران و ڕۆڵەکانیان. ئەم بەشە تەنها بۆ خوێندنەوەی داتای ڕاستەقینەی Supabase ـە.</p>
        </div>
        <div className="shakhAdminUsersHeroActions">
          {onBack && <button type="button" className="shakhAdminUsersBack" onClick={onBack}>گەڕانەوە</button>}
          <button type="button" className="shakhAdminUsersRefresh" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوەی بەکارهێنەران">
            <RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە
          </button>
        </div>
      </header>

      {error && <div className="msg" role="alert">{error}</div>}

      <div className="shakhAdminUsersToolbar">
        <label className="shakhAdminUsersSearch">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="گەڕان بە ناو، ئیمەیڵ، ژمارە یان شار..."
            aria-label="گەڕان لە بەکارهێنەران"
          />
        </label>
        <label className="shakhAdminUsersRoleFilter">
          <span>ڕۆڵ</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="فلتەری ڕۆڵ">
            <option value={ALL_FILTER}>هەموو ڕۆڵەکان</option>
            {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] ?? role}</option>)}
          </select>
        </label>
        <div className="shakhAdminUsersCount">
          <UsersRound size={16} />
          <strong>{filtered.length.toLocaleString('ku-IQ')}</strong>
          <small>لە {users.length.toLocaleString('ku-IQ')} تۆمار</small>
        </div>
      </div>

      <div className="shakhAdminUsersTableWrap">
        <div className="shakhAdminUsersTableHeader">
          <span>بەکارهێنەر</span>
          <span>ڕۆڵ</span>
          <span>پەیوەندی</span>
          <span>شار</span>
          <span>دروستکردن</span>
        </div>

        {loading ? (
          <div className="shakhAdminUsersSkeleton" aria-label="بەکارهێنەران بار دەکرێن">
            {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="shakhAdminUsersEmpty">
            <UsersRound size={32} />
            <strong>هیچ بەکارهێنەرێک نەدۆزرایەوە</strong>
            <small>فلتەر یان وشەی گەڕان بگۆڕە.</small>
          </div>
        ) : (
          <div className="shakhAdminUsersRows">
            {filtered.map((user) => (
              <article className="shakhAdminUsersRow" key={user.id}>
                <div className="shakhAdminUsersIdentity">
                  <span className="shakhAdminUsersAvatar" aria-hidden="true">{(user.full_name || 'ب')[0]}</span>
                  <div>
                    <strong>{user.full_name || 'ناوی دیاری نەکراوە'}</strong>
                    <small>{user.email || user.id.slice(0, 8)}</small>
                  </div>
                </div>
                <span className="shakhAdminUsersRole">
                  <Store size={13} /> {ROLE_LABELS[user.role ?? ''] ?? user.role ?? 'دیاری نەکراوە'}
                </span>
                <div className="shakhAdminUsersContact">
                  <span>{user.phone || 'ژمارەی مۆبایل نییە'}</span>
                  <small>{user.email || 'ئیمەیڵ نییە'}</small>
                </div>
                <span className="shakhAdminUsersCity">{user.city || '—'}</span>
                <time dateTime={user.created_at}>{new Date(user.created_at).toLocaleDateString('ku-IQ')}</time>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="shakhAdminUsersFooter">
        <span><ShieldCheck size={14} /> RLS بەڕێوەبردنی دەستگەیشتن دەکات.</span>
        <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
      </div>
    </section>
  );
}

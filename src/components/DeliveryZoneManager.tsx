import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, RefreshCw, Save, Trash2, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

type Point = { latitude: number; longitude: number };
type Store = { id: string; name: string; city?: string | null };
type DeliveryZone = { id: string; owner_id: string; store_id: string | null; name: string; city: string | null; points: Point[]; is_active: boolean; created_at: string };

const DEFAULT_CENTER: Point = { latitude: 36.1911, longitude: 44.0092 };
const MANAGEABLE_ROLES = ['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor','super_admin','admin'];
function normalizePoints(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { latitude?: unknown; longitude?: unknown } => !!item && typeof item === 'object')
    .map((item) => ({ latitude: Number(item.latitude), longitude: Number(item.longitude) }))
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

export default function DeliveryZoneManager({ userId, role }: { userId: string; role: string }) {
  const isAdmin = role === 'super_admin' || role === 'admin';
  const canManage = MANAGEABLE_ROLES.includes(role);
  const [stores, setStores] = useState<Store[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('هەولێر');
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const pointLayerRef = useRef<L.LayerGroup | null>(null);
  const existingLayerRef = useRef<L.LayerGroup | null>(null);

  const load = async () => {
    setLoading(true);
    const [storesResult, zonesResult] = await Promise.all([
      isAdmin ? supabase.from('stores').select('id,name,city').order('created_at', { ascending: false }) : supabase.from('stores').select('id,name,city').eq('owner_id', userId).order('created_at', { ascending: false }),
      supabase.from('delivery_zones').select('id,owner_id,store_id,name,city,points,is_active,created_at').order('created_at', { ascending: false }),
    ]);
    if (storesResult.error) setMessage(storesResult.error.message); else {
      const nextStores = (storesResult.data ?? []) as Store[];
      setStores(nextStores);
      setSelectedStoreId((current) => current || nextStores[0]?.id || '');
    }
    if (zonesResult.error) setMessage(zonesResult.error.message); else setZones((zonesResult.data ?? []).map((zone: any) => ({ ...zone, points: normalizePoints(zone.points) })) as DeliveryZone[]);
    setLoading(false);
  };

  useEffect(() => { if (canManage) void load(); }, [canManage, isAdmin, userId]);

  const visibleZones = useMemo(() => zones.filter((zone) => zone.store_id === selectedStoreId || (isAdmin && zone.store_id === null)), [zones, selectedStoreId, isAdmin]);
  const scopeName = isAdmin ? (selectedStoreId ? (stores.find((store) => store.id === selectedStoreId)?.name ?? 'دوکان') : 'شاخ') : (stores.find((store) => store.id === selectedStoreId)?.name ?? 'دوکان');

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], zoom: 12, zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    pointLayerRef.current = L.layerGroup().addTo(map);
    existingLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event) => { if (!selectedZoneId) setPoints((current) => [...current, { latitude: event.latlng.lat, longitude: event.latlng.lng }]); });
    mapInstanceRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => { map.remove(); mapInstanceRef.current = null; pointLayerRef.current = null; existingLayerRef.current = null; polygonLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current; const layer = pointLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers(); polygonLayerRef.current?.remove(); polygonLayerRef.current = null;
    points.forEach((point, index) => L.circleMarker([point.latitude, point.longitude], { radius: 6, weight: 2, fillOpacity: 0.9 }).bindTooltip(String(index + 1), { direction: 'top' }).addTo(layer));
    if (points.length >= 3) polygonLayerRef.current = L.polygon(points.map((point) => [point.latitude, point.longitude] as [number, number]), { weight: 2, fillOpacity: 0.12 }).addTo(map);
    if (points.length > 0) map.fitBounds(L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number])), { padding: [30, 30], maxZoom: Math.max(12, map.getZoom()) });
  }, [points]);

  useEffect(() => {
    const layer = existingLayerRef.current; if (!layer) return; layer.clearLayers();
    visibleZones.forEach((zone) => {
      if (zone.points.length < 3) return;
      const polygon = L.polygon(zone.points.map((point) => [point.latitude, point.longitude] as [number, number]), { weight: zone.id === selectedZoneId ? 4 : 2, fillOpacity: zone.id === selectedZoneId ? 0.18 : 0.08 });
      polygon.bindTooltip(zone.name, { sticky: true }); polygon.on('click', () => setSelectedZoneId(zone.id)); polygon.addTo(layer);
    });
  }, [visibleZones, selectedZoneId]);

  const clearEditor = () => { setPoints([]); setName(''); setCity('هەولێر'); setSelectedZoneId(null); };

  const save = async () => {
    if (points.length < 3) return setMessage('بۆ دروستکردنی سنور، لانیکەم ٣ خاڵ لەسەر نەخشە دیاری بکە.');
    if (!name.trim()) return setMessage('ناوی سنور بنووسە.');
    if (!isAdmin && !selectedStoreId) return setMessage('سەرەتا دوکانێک هەڵبژێرە.');
    setSaving(true);
    const payload = { owner_id: userId, store_id: selectedStoreId || null, name: name.trim(), city: city.trim() || null, points, is_active: true };
    const result = selectedZoneId ? await supabase.from('delivery_zones').update(payload).eq('id', selectedZoneId) : await supabase.from('delivery_zones').insert(payload);
    if (result.error) setMessage(result.error.message); else { setMessage(selectedZoneId ? 'سنوری گەیاندن نوێ کرایەوە.' : 'سنوری گەیاندن دروست کرا.'); clearEditor(); await load(); }
    setSaving(false);
  };

  const editZone = (zone: DeliveryZone) => { setSelectedZoneId(zone.id); setSelectedStoreId(zone.store_id ?? ''); setName(zone.name); setCity(zone.city || 'هەولێر'); setPoints(zone.points); requestAnimationFrame(() => mapInstanceRef.current?.invalidateSize()); };
  const toggleZone = async (zone: DeliveryZone) => { const { error } = await supabase.from('delivery_zones').update({ is_active: !zone.is_active }).eq('id', zone.id); if (error) setMessage(error.message); else { setMessage(zone.is_active ? 'سنور ناچالاک کرا.' : 'سنور چالاک کرا.'); await load(); } };
  const deleteZone = async (zone: DeliveryZone) => { if (!window.confirm('دڵنیایت دەتەوێت ئەم سنوری گەیاندنە بسڕیتەوە؟')) return; const { error } = await supabase.from('delivery_zones').delete().eq('id', zone.id); if (error) setMessage(error.message); else { setMessage('سنوری گەیاندن سڕایەوە.'); if (selectedZoneId === zone.id) clearEditor(); await load(); } };

  if (!canManage) return <div className='empty'><MapPin size={38}/><h3>بەڕێوەبردنی سنوری گەیاندن</h3><p>ئەم بەشە تەنها بۆ خاوەن دوکان و بەڕێوبەری شاخە.</p></div>;

  return <section className='dashboard deliveryZoneManager' dir='rtl'>
    <div className='dashboardHeader'><div><span className='eyebrow'><MapPin size={16}/> سنوری گەیاندن</span><h2>{isAdmin ? 'بەڕێوەبردنی ناوچەی گەیاندنی شاخ' : 'ناوچەکانی گەیاندنی دوکان'}</h2><p>{isAdmin ? 'سنوری گشتی بۆ شاخ یان سنوری تایبەتی بۆ هەر دوکانێک دیاری بکە.' : 'سنوری خزمەتگوزاریی دوکانەکەت لەسەر نەخشە دیاری بکە.'}</p></div><button className='plain' type='button' onClick={() => void load()} disabled={loading} aria-label='نوێکردنەوە'><RefreshCw size={18}/></button></div>
    {message && <div className='msg'>{message}</div>}
    <div className='orderCard deliveryZoneEditorCard'><div className='deliveryZoneEditorTop'><div><strong>{selectedZoneId ? 'دەستکاریکردنی سنور' : 'زیادکردنی سنوری نوێ'}</strong><small>لەسەر نەخشە کلیک بکە و لانیکەم ٣ خاڵ دیاری بکە.</small></div>{selectedZoneId && <button type='button' className='plain' onClick={clearEditor}><X size={16}/> نوێ</button>}</div>
      <div className='deliveryZoneFormGrid'>
        <label>{isAdmin ? 'شوێنی جێبەجێکردن' : 'دوکان'}<select value={selectedStoreId} onChange={(event) => { setSelectedStoreId(event.target.value); setSelectedZoneId(null); }}><option value=''>{isAdmin ? 'گشتیی شاخ' : 'دوکان هەڵبژێرە'}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.city ? ' — ' + store.city : ''}</option>)}</select></label>
        <label>ناوی سنور<input value={name} onChange={(event) => setName(event.target.value)} placeholder='نموونە: ناوچەی هەولێر ١'/></label>
        <label>شار<input value={city} onChange={(event) => setCity(event.target.value)} placeholder='هەولێر'/></label>
      </div>
      <div className='deliveryZoneMapWrap'><div ref={mapRef} className='deliveryZoneMap' aria-label='نەخشەی دیاریکردنی سنوری گەیاندن'/><div className='deliveryZoneMapHint'><MapPin size={15}/> {selectedZoneId ? 'سنوری هەڵبژێردراوە؛ دەتوانیت دەستکارییەکە پاشەکەوت بکەیت.' : 'کلیک لەسەر نەخشە بکە بۆ زیادکردنی خاڵ.'}</div></div>
      {points.length > 0 && <div className='deliveryZonePointList'>{points.map((point, index) => <span key={index}>#{index + 1} · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</span>)}</div>}
      <div className='deliveryZoneEditorActions'><button type='button' className='plain' onClick={() => setPoints((current) => current.slice(0, -1))} disabled={points.length === 0}>سڕینەوەی دوا خاڵ</button><button type='button' className='reset' onClick={clearEditor}>پاککردنەوە</button><button type='button' className='primary' onClick={() => void save()} disabled={saving}>{saving ? 'پاشەکەوت دەکرێت...' : <><Save size={16}/> پاشەکەوتکردنی سنور</>}</button></div>
    </div>
    <div className='dashboardGrid'>{loading ? <div className='empty'>چاوەڕوان بە...</div> : visibleZones.length === 0 ? <div className='empty'><MapPin size={36}/><h3>هێشتا هیچ سنورێک نییە</h3><p>سنوری گەیاندن دیاری بکە بۆ ئەوەی لە کاتی checkout پشکنین بکرێت.</p></div> : visibleZones.map((zone) => <article className={selectedZoneId === zone.id ? 'orderCard deliveryZoneCard isSelected' : 'orderCard deliveryZoneCard'} key={zone.id}><div className='orderCardTop'><strong>{zone.name}</strong><span>{zone.is_active ? 'چالاک' : 'ناچالاک'}</span></div><div className='orderMeta'><MapPin size={15}/> {scopeName}{zone.city ? ' — ' + zone.city : ''}</div><div className='orderMeta'>{zone.points.length} خاڵ · {new Date(zone.created_at).toLocaleString('ku-IQ')}</div><div className='deliveryZoneCardActions'><button type='button' className='plain' onClick={() => editZone(zone)}><Check size={15}/> دەستکاری</button><button type='button' className='plain' onClick={() => void toggleZone(zone)}>{zone.is_active ? 'ناچالاککردن' : 'چالاککردن'}</button><button type='button' className='reset' onClick={() => void deleteZone(zone)}><Trash2 size={15}/> سڕینەوە</button></div></article>)}</div>
  </section>;
}
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MapCoords = { latitude: number; longitude: number };

type InteractiveMapPickerProps = {
  value: MapCoords | null;
  onChange: (coords: MapCoords) => void;
};

const DEFAULT_CENTER: MapCoords = { latitude: 36.1911, longitude: 44.0092 };

export default function InteractiveMapPicker({ value, onChange }: InteractiveMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const start = value ?? DEFAULT_CENTER;
    const map = L.map(mapRef.current, {
      center: [start.latitude, start.longitude],
      zoom: value ? 16 : 12,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.circleMarker([start.latitude, start.longitude], {
      radius: 9,
      weight: 3,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindTooltip(value ? 'شوێنی هەڵبژێردراو' : 'شوێنەکەت لێرە هەڵبژێرە', {
      direction: 'top',
      offset: [0, -8],
    });

    map.on('click', (event) => {
      const coords = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      marker.setLatLng(event.latlng);
      marker.openTooltip();
      onChangeRef.current(coords);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [value]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;

    const next = L.latLng(value.latitude, value.longitude);
    marker.setLatLng(next);
    marker.setTooltipContent('شوێنی هەڵبژێردراو');
    map.setView(next, Math.max(map.getZoom(), 15), { animate: true });
  }, [value]);

  return (
    <div className="interactiveMapPicker">
      <div ref={mapRef} className="interactiveMapCanvas" aria-label="نەخشەی هەڵبژاردنی شوێنی گەیاندن" />
      <div className="interactiveMapHint"><LMapPinIcon /> لەسەر نەخشە کلیک بکە بۆ دیاریکردنی شوێنی گەیاندن</div>
    </div>
  );
}

function LMapPinIcon() {
  return <span aria-hidden="true">📍</span>;
}

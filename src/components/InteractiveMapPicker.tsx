import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type MapCoords = { latitude: number; longitude: number };

type InteractiveMapPickerProps = {
  value: MapCoords | null;
  onChange: (coords: MapCoords) => void;
};

const DEFAULT_CENTER: MapCoords = { latitude: 36.1911, longitude: 44.0092 };

function normalizeCoords(lat: number, lng: number): MapCoords {
  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lng.toFixed(7)),
  };
}

function createPinIcon() {
  return L.divIcon({
    className: 'shakhMapPin',
    html: '<span class="shakhMapPinDot"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function InteractiveMapPicker({ value, onChange }: InteractiveMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const start = value ?? DEFAULT_CENTER;
    const map = L.map(mapRef.current, {
      center: [start.latitude, start.longitude],
      zoom: value ? 18 : 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([start.latitude, start.longitude], {
      icon: createPinIcon(),
      draggable: true,
      keyboard: true,
      autoPan: true,
      title: 'شوێنی وردی گەیاندن',
    }).addTo(map);

    const emit = (lat: number, lng: number) => {
      const coords = normalizeCoords(lat, lng);
      marker.setLatLng([coords.latitude, coords.longitude]);
      map.setView([coords.latitude, coords.longitude], Math.max(map.getZoom(), 18), {
        animate: true,
      });
      onChangeRef.current(coords);
    };

    marker.bindTooltip(value ? 'شوێنی وردی هەڵبژێردراو' : 'پینەکە لێرە بگوازەوە یان لە ماپ کلیک بکە', {
      direction: 'top',
      offset: [0, -14],
      sticky: true,
    });

    map.on('click', (event) => {
      emit(event.latlng.lat, event.latlng.lng);
    });

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      emit(position.lat, position.lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;

    const coords = normalizeCoords(value.latitude, value.longitude);
    marker.setLatLng([coords.latitude, coords.longitude]);
    marker.setTooltipContent('شوێنی وردی هەڵبژێردراو');
    if (Math.abs(map.getCenter().lat - coords.latitude) > 0.000001 || Math.abs(map.getCenter().lng - coords.longitude) > 0.000001) {
      map.setView([coords.latitude, coords.longitude], Math.max(map.getZoom(), 18), {
        animate: true,
      });
    }
  }, [value]);

  const display = value
    ? `${value.latitude.toFixed(7)}, ${value.longitude.toFixed(7)}`
    : 'هیچ خاڵێکی دقیق هەڵنەبژێردراوە';

  return (
    <div className="interactiveMapPicker">
      <div ref={mapRef} className="interactiveMapCanvas" aria-label="نەخشەی هەڵبژاردنی شوێنی وردی گەیاندن" />
      <div className="interactiveMapExactBar">
        <span><strong>شوێنی ورد:</strong> {display}</span>
        <small>کلیکی ڕاستەوخۆ یان ڕاکێشانی پین، هەمان خاڵی ماپ هەڵدەبژێرێت.</small>
      </div>
      <div className="interactiveMapHint"><LMapPinIcon /> ماپەکە بگەڕێنەوە و لە هەمان شوێن کلیک بکە کە دەتەوێت گەیاندن بۆی بکرێت</div>
    </div>
  );
}

function LMapPinIcon() {
  return <span aria-hidden="true">📍</span>;
}

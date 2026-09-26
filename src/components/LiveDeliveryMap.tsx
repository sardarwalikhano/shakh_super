import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchDrivingRoute, type RouteResult } from '../lib/routing';

type Point = {
  latitude: number;
  longitude: number;
};

type LiveDeliveryMapProps = {
  store?: Point | null;
  captain?: Point | null;
  destination?: Point | null;
  onRouteInfo?: (route: RouteResult | null) => void;
};

const DEFAULT_CENTER: Point = { latitude: 36.1911, longitude: 44.0092 };

export default function LiveDeliveryMap({ store, captain, destination, onRouteInfo }: LiveDeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const routeRequestIdRef = useRef(0);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const first = captain ?? destination ?? store ?? DEFAULT_CENTER;
    const map = L.map(mapRef.current, {
      center: [first.latitude, first.longitude],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      routeRequestIdRef.current += 1;
      map.remove();
      mapInstanceRef.current = null;
      layersRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    routeLayerRef.current?.remove();
    routeLayerRef.current = null;
    onRouteInfo?.(null);

    const points: Array<[string, Point, string, string]> = [];
    if (store) points.push(['store', store, 'دوکان', 'shop']);
    if (captain) points.push(['captain', captain, 'کاپتن', 'captain']);
    if (destination) points.push(['destination', destination, 'ناونیشانی کڕیار', 'destination']);

    points.forEach(([, point, label, kind]) => {
      const circle = L.circleMarker([point.latitude, point.longitude], {
        radius: kind === 'captain' ? 10 : 8,
        weight: 3,
        color: kind === 'captain' ? '#ff6b16' : kind === 'store' ? '#163f6b' : '#2f8f5b',
        fillColor: kind === 'captain' ? '#ff9b4a' : kind === 'store' ? '#163f6b' : '#55b879',
        fillOpacity: 0.92,
      }).addTo(layers);

      circle.bindTooltip(label, {
        permanent: kind !== 'captain',
        direction: 'top',
        offset: [0, -8],
        opacity: 0.92,
      });
    });

    if (store && captain) {
      L.polyline(
        [[store.latitude, store.longitude], [captain.latitude, captain.longitude]],
        { color: '#163f6b', weight: 3, dashArray: '7 7', opacity: 0.55 },
      ).addTo(layers);
    }

    const routePoints = captain && destination
      ? [captain, destination]
      : store && destination
        ? [store, destination]
        : null;

    let cancelled = false;
    const requestId = ++routeRequestIdRef.current;

    if (routePoints) {
      setRouteLoading(true);
      const controller = new AbortController();

      void fetchDrivingRoute(routePoints, controller.signal)
        .then((route) => {
          if (cancelled || requestId !== routeRequestIdRef.current) return;
          routeLayerRef.current = L.geoJSON(route.geometry, {
            style: {
              color: '#ff6b16',
              weight: 5,
              opacity: 0.82,
            },
          }).addTo(map);
          onRouteInfo?.(route);
          const routeBounds = routeLayerRef.current.getBounds();
          if (routeBounds.isValid()) {
            map.fitBounds(routeBounds.pad(0.16), { animate: false, maxZoom: 16 });
          }
        })
        .catch((error: unknown) => {
          if (cancelled || requestId !== routeRequestIdRef.current || (error instanceof DOMException && error.name === 'AbortError')) return;
          onRouteInfo?.(null);
        })
        .finally(() => {
          if (!cancelled && requestId === routeRequestIdRef.current) setRouteLoading(false);
        });

      requestAnimationFrame(() => map.invalidateSize());

      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setRouteLoading(false);

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(([, p]) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView([points[0][1].latitude, points[0][1].longitude], 16, { animate: false });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [store, captain, destination, onRouteInfo]);

  return (

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(([, p]) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds.pad(0.18), { animate: false, maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView([points[0][1].latitude, points[0][1].longitude], 16, { animate: false });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [store, captain, destination]);

  return (
    <div className="liveDeliveryMap">
      <div ref={mapRef} className="liveDeliveryMapCanvas" aria-label="نەخشەی شوێنی گەیاندن" />
      {routeLoading && <div className="liveDeliveryRouteStatus">ڕێگای ئۆتۆمبێل خەمڵێنراوە...</div>}
      <div className="liveDeliveryMapLegend" aria-label="ڕوونکردنەوەی نیشانەکانی نەخشە">
        {store && <span><i className="mapLegendDot mapLegendStore" /> دوکان</span>}
        {captain && <span><i className="mapLegendDot mapLegendCaptain" /> کاپتن</span>}
        {destination && <span><i className="mapLegendDot mapLegendDestination" /> شوێنی کڕیار</span>}
      </div>
    </div>
  );
}

export type ExactLocation = { latitude: number; longitude: number };

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const GEOCODING_BASE_URL =
  (import.meta.env.VITE_GEOCODING_API_URL as string | undefined)?.trim() ||
  'https://nominatim.openstreetmap.org/reverse';

export async function reverseGeocodeExactLocation(
  coords: ExactLocation,
  signal?: AbortSignal,
): Promise<{ displayName: string | null; city: string | null }> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
    lat: coords.latitude.toFixed(7),
    lon: coords.longitude.toFixed(7),
    'accept-language': 'ku,ar,en',
  });

  const response = await fetch(`${GEOCODING_BASE_URL}?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ku,ar,en',
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: HTTP ${response.status}`);
  }

  const result = (await response.json()) as ReverseGeocodeResponse;
  const address = result.address || {};

  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.village ||
    address.suburb ||
    address.neighbourhood ||
    null;

  return {
    displayName: result.display_name?.trim() || null,
    city: city?.trim() || null,
  };
}

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
}

export async function geocodeAddress(query: string): Promise<GeoPoint | null> {
  return (await geocodeAddresses(query, 1))[0] ?? null;
}

export async function geocodeAddresses(query: string, limit = 5): Promise<GeoPoint[]> {
  const cleaned = query.trim();
  if (!cleaned) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", cleaned);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "hu");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "RentLens/0.1 local rental research app",
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(await response.text());
  const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  return data
    .filter((item) => item.lat && item.lon)
    .map((item) => ({
      lat: Number(item.lat),
      lon: Number(item.lon),
      label: item.display_name ?? cleaned
    }));
}

export async function routeBetween(profile: "foot" | "bike", from: GeoPoint, to: GeoPoint): Promise<RouteSummary | null> {
  const service = profile === "foot" ? "routed-foot" : "routed-bike";
  const url = new URL(`https://routing.openstreetmap.de/${service}/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`);
  url.searchParams.set("overview", "false");
  url.searchParams.set("steps", "false");

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration
  };
}

export function straightLineDistance(from: GeoPoint, to: GeoPoint) {
  const earthMeters = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

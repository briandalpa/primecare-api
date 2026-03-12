// Calculates the straight-line distance between two GPS coordinates on the Earth's surface.
// Used during pickup request creation to find the nearest active outlet within its service radius.

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

// Accepts latitude and longitude in decimal degrees; returns distance in kilometers.
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = // Haversine formula: computes the square of half the chord length between two points.
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // Central angle in radians.
  return EARTH_RADIUS_KM * c;
}
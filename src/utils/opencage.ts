import { ResponseError } from '@/error/response-error';

type OpenCageResponse = {
  total_results: number;
  results: { geometry: { lat: number; lng: number } }[];
};

type OpenCageComponents = {
  state?: string;
  province?: string;
  city?: string;
  town?: string;
  county?: string;
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  postcode?: string;
};

type OpenCageReverseResponse = {
  total_results: number;
  results: { formatted: string; components: OpenCageComponents }[];
};

export class OpenCageClient {
  private static readonly BASE = 'https://api.opencagedata.com/geocode/v1/json';
  private static get KEY() {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) throw new Error('OPENCAGE_API_KEY is not configured');
    return key;
  }

  static async geocode(
    city: string,
    province: string,
  ): Promise<{ latitude: number; longitude: number }> {
    const query = encodeURIComponent(`${city},${province},Indonesia`);
    const url = `${this.BASE}?q=${query}&key=${this.KEY}&limit=1&no_annotations=1`;

    const res = await fetch(url);
    if (!res.ok) throw new ResponseError(502, 'Geocoding service error');

    const json = (await res.json()) as OpenCageResponse;
    if (json.total_results === 0) {
      throw new ResponseError(
        422,
        'Could not geocode the provided city and province',
      );
    }

    const { lat, lng } = json.results[0].geometry;
    return { latitude: lat, longitude: lng };
  }

  static async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<{ city: string; province: string; streetAddress: string | null }> {
    const query = encodeURIComponent(`${lat}+${lng}`);
    const url = `${this.BASE}?q=${query}&key=${this.KEY}&limit=1&no_annotations=1`;
    const res = await fetch(url);
    if (!res.ok) throw new ResponseError(502, 'Geocoding service error');
    const json = (await res.json()) as OpenCageReverseResponse;
    if (json.total_results === 0)
      throw new ResponseError(
        422,
        'Could not reverse geocode the provided coordinates',
      );
    const { formatted, components: c } = json.results[0];
    const province = c.state ?? c.province ?? null;
    const city = c.city ?? c.town ?? c.county ?? null;
    if (!province || !city)
      throw new ResponseError(
        422,
        'Could not identify province or city for these coordinates',
      );
    const streetAddress = this.extractStreetAddress(
      formatted,
      city,
      province,
      c,
    );
    return { city, province, streetAddress };
  }

  private static extractStreetAddress(
    formatted: string,
    city: string,
    province: string,
    c: OpenCageComponents,
  ): string | null {
    // Find the first comma segment that contains the city or province name and cut from there.
    const segments = formatted.split(', ');
    const cutIndex = segments.findIndex((seg) => {
      const lower = seg.toLowerCase();
      return (
        lower.includes(city.toLowerCase()) ||
        lower.includes(province.toLowerCase())
      );
    });
    const streetPart =
      cutIndex > 0 ? segments.slice(0, cutIndex).join(', ') : '';
    if (streetPart.trim()) return streetPart.trim();

    // Fallback: build from individual components.
    const parts = [
      c.road && c.house_number ? `${c.road} ${c.house_number}` : c.road,
      c.neighbourhood ?? c.suburb,
      c.city_district,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
}

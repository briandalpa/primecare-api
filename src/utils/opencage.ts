import { ResponseError } from '@/error/response-error';

type OpenCageResponse = {
  total_results: number;
  results: { geometry: { lat: number; lng: number } }[];
};

export class OpenCageClient {
  private static readonly BASE = 'https://api.opencagedata.com/geocode/v1/json';
  private static get KEY() {
    const key = process.env.OPENCAGE_API_KEY;
    if (!key) throw new Error('OPENCAGE_API_KEY is not configured');
    return key;
  }

  static async geocode(city: string, province: string): Promise<{ latitude: number; longitude: number }> {
    const query = encodeURIComponent(`${city},${province},Indonesia`);
    const url = `${this.BASE}?q=${query}&key=${this.KEY}&limit=1&no_annotations=1`;

    const res = await fetch(url);
    if (!res.ok) throw new ResponseError(502, 'Geocoding service error');

    const json = await res.json() as OpenCageResponse;
    if (json.total_results === 0) {
      throw new ResponseError(422, 'Could not geocode the provided city and province');
    }

    const { lat, lng } = json.results[0].geometry;
    return { latitude: lat, longitude: lng };
  }
}

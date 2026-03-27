import { ResponseError } from '@/error/response-error';
import type { Province, City } from '@/features/region-data/region-model';

// Internal API response shape (snake_case as returned by RajaOngkir)
type ApiProvince = { id: number; name: string };
type ApiCity = { id: number; name: string; zip_code: string };

type CacheEntry<T> = { data: T; expiry: number };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — Indonesia has 34 provinces, cache is bounded
const provincesCache: { entry: CacheEntry<Province[]> | null } = { entry: null };
const citiesCache = new Map<number, CacheEntry<City[]>>();

export class RajaOngkirClient {
  private static readonly BASE = 'https://rajaongkir.komerce.id/api/v1';
  private static get KEY() {
    const key = process.env.RAJAONGKIR_COST_API_KEY;
    if (!key) throw new Error('RAJAONGKIR_COST_API_KEY is not configured');
    return key;
  }

  private static headers() {
    return { Key: this.KEY, accept: 'application/json' };
  }

  static async getProvinces(): Promise<Province[]> {
    const now = Date.now();
    if (provincesCache.entry && provincesCache.entry.expiry > now) {
      return provincesCache.entry.data;
    }
    const res = await fetch(`${this.BASE}/destination/province`, { headers: this.headers() });
    if (!res.ok) throw new ResponseError(502, 'RajaOngkir API error');
    const json = await res.json() as { data: ApiProvince[] };
    if (!json.data) throw new ResponseError(502, 'RajaOngkir API error');
    const data: Province[] = json.data.map((p) => ({ id: p.id, name: p.name }));
    provincesCache.entry = { data, expiry: now + CACHE_TTL_MS };
    return data;
  }

  static async getCities(provinceId: number): Promise<City[]> {
    const now = Date.now();
    const cached = citiesCache.get(provinceId);
    if (cached && cached.expiry > now) return cached.data;
    const res = await fetch(`${this.BASE}/destination/city/${provinceId}`, { headers: this.headers() });
    if (!res.ok) throw new ResponseError(502, 'RajaOngkir API error');
    const json = await res.json() as { data: ApiCity[] };
    if (!json.data) throw new ResponseError(502, 'RajaOngkir API error');
    const data: City[] = json.data.map((c) => ({ id: c.id, name: c.name, zipCode: c.zip_code }));
    citiesCache.set(provinceId, { data, expiry: now + CACHE_TTL_MS });
    return data;
  }
}

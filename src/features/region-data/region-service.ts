import { RajaOngkirClient } from '@/utils/rajaongkir';
import { OpenCageClient } from '@/utils/opencage';
import { ResponseError } from '@/error/response-error';
import type { Province, City, GeocodeResult, ReverseGeocodeResult } from './region-model';

export class RegionService {
  static async getProvinces(): Promise<Province[]> {
    return RajaOngkirClient.getProvinces();
  }

  static async getCities(provinceId: number): Promise<City[]> {
    return RajaOngkirClient.getCities(provinceId);
  }

  static async geocode(city: string, province: string): Promise<GeocodeResult> {
    return OpenCageClient.geocode(city, province);
  }

  static async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const raw = await OpenCageClient.reverseGeocode(lat, lng);
    const norm = (s: string) => s.toLowerCase();
    const provinces = await RajaOngkirClient.getProvinces();
    const matchedProvince = provinces.find(p => norm(p.name).includes(norm(raw.province)) || norm(raw.province).includes(norm(p.name)));
    if (!matchedProvince) throw new ResponseError(422, 'Could not identify your area');
    const cities = await RajaOngkirClient.getCities(matchedProvince.id);
    const matchedCity = cities.find(c => norm(c.name).includes(norm(raw.city)) || norm(raw.city).includes(norm(c.name)));
    if (!matchedCity) throw new ResponseError(422, 'Could not identify your area');
    return { province: matchedProvince.name, provinceId: matchedProvince.id, city: matchedCity.name, cityId: matchedCity.id, streetAddress: raw.streetAddress };
  }
}

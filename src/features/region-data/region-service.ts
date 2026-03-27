import { RajaOngkirClient } from '@/utils/rajaongkir';
import { OpenCageClient } from '@/utils/opencage';
import type { Province, City, GeocodeResult } from './region-model';

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
}

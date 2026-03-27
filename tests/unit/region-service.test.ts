jest.mock('@/utils/rajaongkir', () => ({
  RajaOngkirClient: {
    getProvinces: jest.fn(),
    getCities: jest.fn(),
  },
}));

jest.mock('@/utils/opencage', () => ({
  OpenCageClient: {
    geocode: jest.fn(),
  },
}));

import { RegionService } from '@/features/region-data/region-service';
import { RajaOngkirClient } from '@/utils/rajaongkir';
import { OpenCageClient } from '@/utils/opencage';

beforeEach(() => jest.clearAllMocks());

describe('RegionService.getProvinces', () => {
  it('returns provinces from RajaOngkirClient', async () => {
    const mockProvinces = [{ id: 1, name: 'DKI Jakarta' }];
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(mockProvinces);
    const result = await RegionService.getProvinces();
    expect(result).toEqual(mockProvinces);
  });
});

describe('RegionService.getCities', () => {
  it('returns cities for a given province', async () => {
    const mockCities = [{ id: 100, name: 'Jakarta Pusat', zipCode: '10110' }];
    (RajaOngkirClient.getCities as jest.Mock).mockResolvedValue(mockCities);
    const result = await RegionService.getCities(1);
    expect(result).toEqual(mockCities);
    expect(RajaOngkirClient.getCities).toHaveBeenCalledWith(1);
  });
});

describe('RegionService.geocode', () => {
  it('returns coordinates from OpenCageClient', async () => {
    const mockCoords = { latitude: -6.2, longitude: 106.8 };
    (OpenCageClient.geocode as jest.Mock).mockResolvedValue(mockCoords);
    const result = await RegionService.geocode('Jakarta', 'DKI Jakarta');
    expect(result).toEqual(mockCoords);
    expect(OpenCageClient.geocode).toHaveBeenCalledWith('Jakarta', 'DKI Jakarta');
  });
});

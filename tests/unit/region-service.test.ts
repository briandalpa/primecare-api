jest.mock('@/utils/rajaongkir', () => ({
  RajaOngkirClient: {
    getProvinces: jest.fn(),
    getCities: jest.fn(),
  },
}));

jest.mock('@/utils/opencage', () => ({
  OpenCageClient: {
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
  },
}));

import { RegionService } from '@/features/region-data/region-service';
import { RajaOngkirClient } from '@/utils/rajaongkir';
import { OpenCageClient } from '@/utils/opencage';

beforeEach(() => jest.clearAllMocks());

describe('RegionService.getProvinces', () => {
  it('returns provinces from RajaOngkirClient', async () => {
    const mockProvinces = [{ id: 1, name: 'DKI Jakarta' }];
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(
      mockProvinces,
    );
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
    expect(OpenCageClient.geocode).toHaveBeenCalledWith(
      'Jakarta',
      'DKI Jakarta',
    );
  });
});

describe('RegionService.reverseGeocode', () => {
  const mockProvinces = [{ id: 6, name: 'DKI Jakarta' }];
  const mockCities = [{ id: 152, name: 'Jakarta Pusat', zipCode: '10110' }];

  it('returns matched ReverseGeocodeResult on full match', async () => {
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'DKI Jakarta',
      city: 'Jakarta Pusat',
      streetAddress: 'Jl. Sudirman',
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(
      mockProvinces,
    );
    (RajaOngkirClient.getCities as jest.Mock).mockResolvedValue(mockCities);

    const result = await RegionService.reverseGeocode(-6.2, 106.8);

    expect(result).toEqual({
      province: 'DKI Jakarta',
      provinceId: 6,
      city: 'Jakarta Pusat',
      cityId: 152,
      streetAddress: 'Jl. Sudirman',
    });
    expect(RajaOngkirClient.getCities).toHaveBeenCalledWith(6);
  });

  it('throws 422 when no province matches the raw result', async () => {
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'Unknown Province',
      city: 'Jakarta Pusat',
      streetAddress: null,
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(
      mockProvinces,
    );

    await expect(
      RegionService.reverseGeocode(-6.2, 106.8),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Could not identify your area',
    });
  });

  it('throws 422 when province matches but no city matches', async () => {
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'DKI Jakarta',
      city: 'Unknown City',
      streetAddress: null,
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(
      mockProvinces,
    );
    (RajaOngkirClient.getCities as jest.Mock).mockResolvedValue(mockCities);

    await expect(
      RegionService.reverseGeocode(-6.2, 106.8),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Could not identify your area',
    });
  });

  it('matches via partial name inclusion (raw province shorter than stored)', async () => {
    (OpenCageClient.reverseGeocode as jest.Mock).mockResolvedValue({
      province: 'Jakarta',
      city: 'Pusat',
      streetAddress: null,
    });
    (RajaOngkirClient.getProvinces as jest.Mock).mockResolvedValue(
      mockProvinces,
    );
    (RajaOngkirClient.getCities as jest.Mock).mockResolvedValue(mockCities);

    const result = await RegionService.reverseGeocode(-6.2, 106.8);
    expect(result.province).toBe('DKI Jakarta');
    expect(result.city).toBe('Jakarta Pusat');
  });
});

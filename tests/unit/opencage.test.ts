const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { OpenCageClient } from '@/utils/opencage';
import { ResponseError } from '@/error/response-error';

const makeJsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENCAGE_API_KEY = 'test-key';
});

describe('OpenCageClient.geocode', () => {
  it('returns latitude and longitude from results[0].geometry on success', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{ geometry: { lat: -6.2088, lng: 106.8456 } }],
    }));

    const result = await OpenCageClient.geocode('Jakarta', 'DKI Jakarta');

    expect(result.latitude).toBe(-6.2088);
    expect(result.longitude).toBe(106.8456);
  });

  it('throws ResponseError(422) when total_results is 0', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ total_results: 0, results: [] }));

    await expect(OpenCageClient.geocode('Unknown City', 'Unknown Province'))
      .rejects.toMatchObject({ status: 422 });
  });

  it('throws ResponseError(502) when res.ok is false', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}, false));

    await expect(OpenCageClient.geocode('Jakarta', 'DKI Jakarta'))
      .rejects.toMatchObject({ status: 502 });
  });

  it('throws Error when OPENCAGE_API_KEY is not set', async () => {
    delete process.env.OPENCAGE_API_KEY;

    await expect(OpenCageClient.geocode('Jakarta', 'DKI Jakarta'))
      .rejects.toThrow('OPENCAGE_API_KEY is not configured');
  });
});

describe('OpenCageClient.reverseGeocode', () => {
  it('returns city, province, and streetAddress from components and formatted string', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Jl. Sudirman No. 1, Setiabudi, Jakarta, DKI Jakarta, Indonesia',
        components: {
          state: 'DKI Jakarta',
          city: 'Jakarta',
          road: 'Jl. Sudirman',
          house_number: 'No. 1',
        },
      }],
    }));

    const result = await OpenCageClient.reverseGeocode(-6.2088, 106.8456);

    expect(result.city).toBe('Jakarta');
    expect(result.province).toBe('DKI Jakarta');
    expect(result.streetAddress).toBeTruthy();
  });

  it('throws ResponseError(422) when total_results is 0', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ total_results: 0, results: [] }));

    await expect(OpenCageClient.reverseGeocode(-6.2088, 106.8456))
      .rejects.toMatchObject({ status: 422 });
  });

  it('throws ResponseError(422) when components has no state/province', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Some street, Jakarta',
        components: { city: 'Jakarta' },
      }],
    }));

    await expect(OpenCageClient.reverseGeocode(-6.2088, 106.8456))
      .rejects.toMatchObject({ status: 422 });
  });

  it('throws ResponseError(422) when components has no city/town/county', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Some street, DKI Jakarta',
        components: { state: 'DKI Jakarta' },
      }],
    }));

    await expect(OpenCageClient.reverseGeocode(-6.2088, 106.8456))
      .rejects.toMatchObject({ status: 422 });
  });

  it('throws ResponseError(502) when res.ok is false', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}, false));

    await expect(OpenCageClient.reverseGeocode(-6.2088, 106.8456))
      .rejects.toMatchObject({ status: 502 });
  });

  it('extracts streetAddress from formatted string when city name appears after comma segments', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Jl. Thamrin 10, Menteng, Jakarta, DKI Jakarta, 10350, Indonesia',
        components: {
          state: 'DKI Jakarta',
          city: 'Jakarta',
          road: 'Jl. Thamrin',
          house_number: '10',
        },
      }],
    }));

    const result = await OpenCageClient.reverseGeocode(-6.2, 106.8);

    expect(result.streetAddress).toBe('Jl. Thamrin 10, Menteng');
  });

  it('falls back to road+neighbourhood when no city match in formatted', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Some Random Formatted String',
        components: {
          state: 'Jawa Barat',
          city: 'Bandung',
          road: 'Jl. Asia Afrika',
          neighbourhood: 'Braga',
        },
      }],
    }));

    const result = await OpenCageClient.reverseGeocode(-6.9, 107.6);

    expect(result.streetAddress).toBe('Jl. Asia Afrika, Braga');
  });

  it('returns null streetAddress when no road/neighbourhood/city_district components', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({
      total_results: 1,
      results: [{
        formatted: 'Surabaya, Jawa Timur, Indonesia',
        components: {
          state: 'Jawa Timur',
          city: 'Surabaya',
        },
      }],
    }));

    const result = await OpenCageClient.reverseGeocode(-7.2, 112.7);

    expect(result.streetAddress).toBeNull();
  });
});

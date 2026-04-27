const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('@/application/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const apiProvinces = [
  { id: 1, name: 'DKI Jakarta' },
  { id: 2, name: 'Jawa Barat' },
];

const apiCities = [
  { id: 101, name: 'Jakarta Selatan', zip_code: '12140' },
  { id: 102, name: 'Jakarta Pusat', zip_code: '10110' },
];

const makeJsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RAJAONGKIR_COST_API_KEY = 'test-api-key';
});

describe('RajaOngkirClient.getProvinces', () => {
  it('fetches provinces and returns Province[] with correct field mapping', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: apiProvinces }));

    const result = await RajaOngkirClient!.getProvinces();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, name: 'DKI Jakarta' });
    expect(result[1]).toEqual({ id: 2, name: 'Jawa Barat' });
  });

  it('throws ResponseError(502) when res.ok is false', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({}, false));

    await expect(RajaOngkirClient!.getProvinces())
      .rejects.toMatchObject({ status: 502, message: 'RajaOngkir API error' });
  });

  it('throws ResponseError(502) when json.data is null', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: null }));

    await expect(RajaOngkirClient!.getProvinces())
      .rejects.toMatchObject({ status: 502 });
  });

  it('throws Error when RAJAONGKIR_COST_API_KEY is not set', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    delete process.env.RAJAONGKIR_COST_API_KEY;

    await expect(RajaOngkirClient!.getProvinces())
      .rejects.toThrow('RAJAONGKIR_COST_API_KEY is not configured');
  });

  it('uses cache on second call (fetch called exactly once for two calls)', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: apiProvinces }));

    await RajaOngkirClient!.getProvinces();
    await RajaOngkirClient!.getProvinces();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('RajaOngkirClient.getCities', () => {
  it('fetches cities and returns City[] with zipCode mapped from zip_code', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: apiCities }));

    const result = await RajaOngkirClient!.getCities(1);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 101, name: 'Jakarta Selatan', zipCode: '12140' });
    expect(result[1]).toEqual({ id: 102, name: 'Jakarta Pusat', zipCode: '10110' });
  });

  it('throws ResponseError(502) when res.ok is false', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({}, false));

    await expect(RajaOngkirClient!.getCities(999))
      .rejects.toMatchObject({ status: 502 });
  });

  it('uses cache on second call for same province', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: apiCities }));

    await RajaOngkirClient!.getCities(5);
    await RajaOngkirClient!.getCities(5);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not use cache for a different province (calls fetch again)', async () => {
    let RajaOngkirClient: typeof import('@/utils/rajaongkir').RajaOngkirClient;
    jest.isolateModules(() => {
      ({ RajaOngkirClient } = require('@/utils/rajaongkir'));
    });
    mockFetch.mockResolvedValue(makeJsonResponse({ data: apiCities }));

    await RajaOngkirClient!.getCities(10);
    await RajaOngkirClient!.getCities(11);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

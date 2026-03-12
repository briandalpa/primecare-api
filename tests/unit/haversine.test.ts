import { haversineDistance } from '../../src/utils/haversine';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it('calculates Jakarta to Bandung (~120 km)', () => {
    const distance = haversineDistance(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(distance).toBeGreaterThan(115);
    expect(distance).toBeLessThan(125);
  });

  it('calculates antipodal distance (~20015 km)', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeCloseTo(20015, -2);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const ab = haversineDistance(-6.2088, 106.8456, -6.9175, 107.6191);
    const ba = haversineDistance(-6.9175, 107.6191, -6.2088, 106.8456);
    expect(ab).toBeCloseTo(ba, 5);
  });
});

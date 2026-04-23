import { AdminOrderValidation } from '@/validations/admin-order-validation';
import { Validation } from '@/validations/validation';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('AdminOrderValidation', () => {
  describe('CREATE_ORDER schema', () => {
    it('should accept valid order input', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 10000,
        totalWeightKg: 2.5,
        items: [
          { laundryItemId: VALID_UUID, quantity: 3 },
        ],
      };
      const result = Validation.validate(AdminOrderValidation.CREATE_ORDER, data);
      expect(result).toEqual({ ...data, manualItems: [] });
    });

    it('should accept multiple items', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 8000,
        totalWeightKg: 5,
        items: [
          { laundryItemId: VALID_UUID, quantity: 2 },
          { laundryItemId: '223e4567-e89b-12d3-a456-426614174001', quantity: 5 },
        ],
      };
      const result = Validation.validate(AdminOrderValidation.CREATE_ORDER, data);
      expect(result.items).toHaveLength(2);
    });

    it('should accept manual priced items', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 10000,
        totalWeightKg: 2.5,
        items: [{ laundryItemId: VALID_UUID, quantity: 3 }],
        manualItems: [{ name: 'Bedcover', quantity: 1, unitPrice: 25000 }],
      };
      const result = Validation.validate(AdminOrderValidation.CREATE_ORDER, data);
      expect(result.manualItems).toEqual(data.manualItems);
    });

    it('should reject empty items array', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 10000,
        totalWeightKg: 2.5,
        items: [],
      };
      expect(() => Validation.validate(AdminOrderValidation.CREATE_ORDER, data)).toThrow();
    });

    it('should reject non-positive pricePerKg', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 0,
        totalWeightKg: 2.5,
        items: [{ laundryItemId: VALID_UUID, quantity: 1 }],
      };
      expect(() => Validation.validate(AdminOrderValidation.CREATE_ORDER, data)).toThrow();
    });

    it('should reject non-positive totalWeightKg', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 10000,
        totalWeightKg: -1,
        items: [{ laundryItemId: VALID_UUID, quantity: 1 }],
      };
      expect(() => Validation.validate(AdminOrderValidation.CREATE_ORDER, data)).toThrow();
    });

    it('should reject invalid pickupRequestId (not UUID)', () => {
      const data = {
        pickupRequestId: 'not-a-uuid',
        pricePerKg: 10000,
        totalWeightKg: 2.5,
        items: [{ laundryItemId: VALID_UUID, quantity: 1 }],
      };
      expect(() => Validation.validate(AdminOrderValidation.CREATE_ORDER, data)).toThrow();
    });

    it('should reject non-integer item quantity', () => {
      const data = {
        pickupRequestId: VALID_UUID,
        pricePerKg: 10000,
        totalWeightKg: 2.5,
        items: [{ laundryItemId: VALID_UUID, quantity: 1.5 }],
      };
      expect(() => Validation.validate(AdminOrderValidation.CREATE_ORDER, data)).toThrow();
    });
  });
});

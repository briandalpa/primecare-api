import { AdminValidation } from '@/validations/admin-validation';
import { Validation } from '@/validations/validation';

describe('AdminValidation', () => {
  describe('CREATE schema', () => {
    it('should accept valid create input with all required fields', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid create input with different valid roles (OUTLET_ADMIN, WORKER, DRIVER)', () => {
      const validRoles = ['OUTLET_ADMIN', 'WORKER', 'DRIVER'];
      validRoles.forEach((role) => {
        const data = {
          name: 'Test Admin',
          email: 'test@example.com',
          role,
        };
        const result = Validation.validate(AdminValidation.CREATE, data);
        expect(result).toEqual(data);
      });
    });

    it('should accept valid create input with or without optional outletId', () => {
      const dataWithOutletId = {
        name: 'Alice Admin',
        email: 'alice@example.com',
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-123',
      };
      const dataWithoutOutletId = {
        name: 'Bob Admin',
        email: 'bob@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(Validation.validate(AdminValidation.CREATE, dataWithOutletId)).toEqual(dataWithOutletId);
      expect(Validation.validate(AdminValidation.CREATE, dataWithoutOutletId)).toEqual(dataWithoutOutletId);
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject missing name field', () => {
      const data = {
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject invalid email format', () => {
      const data = {
        name: 'John Admin',
        email: 'not-an-email',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject email without domain', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject email without local part', () => {
      const data = {
        name: 'John Admin',
        email: '@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject missing email field', () => {
      const data = {
        name: 'John Admin',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject invalid role value', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'INVALID_ROLE',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject CUSTOMER role', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'CUSTOMER',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject SUPER_ADMIN role', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

    it('should reject missing role field', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
      };
      expect(() => Validation.validate(AdminValidation.CREATE, data)).toThrow();
    });

  });

  describe('UPDATE schema', () => {
    it('should accept valid update with any optional field combination', () => {
      const testCases = [
        { role: 'WORKER' },
        { outletId: 'outlet-456' },
        { isActive: true },
        { role: 'OUTLET_ADMIN', outletId: 'outlet-789' },
        { role: 'DRIVER', isActive: false },
        { outletId: 'outlet-111', isActive: true },
        { role: 'OUTLET_ADMIN', outletId: 'outlet-222', isActive: true },
        {},
      ];
      testCases.forEach((data) => {
        const result = Validation.validate(AdminValidation.UPDATE, data);
        expect(result).toEqual(data);
      });
    });

    it('should reject invalid roles (CUSTOMER, SUPER_ADMIN, or unknown)', () => {
      const invalidRoles = ['INVALID_ROLE', 'CUSTOMER', 'SUPER_ADMIN'];
      invalidRoles.forEach((role) => {
        expect(() => Validation.validate(AdminValidation.UPDATE, { role })).toThrow();
      });
    });

    it('should reject isActive as non-boolean', () => {
      const data = {
        isActive: 'true',
      };
      expect(() => Validation.validate(AdminValidation.UPDATE, data)).toThrow();
    });
  });
});

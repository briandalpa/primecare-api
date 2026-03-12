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

    it('should accept valid create input with WORKER role', () => {
      const data = {
        name: 'Jane Worker',
        email: 'worker@example.com',
        role: 'WORKER',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid create input with DRIVER role', () => {
      const data = {
        name: 'Bob Driver',
        email: 'driver@example.com',
        role: 'DRIVER',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid create input with outletId', () => {
      const data = {
        name: 'Alice Admin',
        email: 'alice@example.com',
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-123',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid create input without outletId', () => {
      const data = {
        name: 'Bob Admin',
        email: 'bob@example.com',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
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

    it('should accept name with single character', () => {
      const data = {
        name: 'A',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept name with spaces', () => {
      const data = {
        name: 'John Michael Smith',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept email with numbers and special characters', () => {
      const data = {
        name: 'John Admin',
        email: 'john.doe+admin@example123.co.uk',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminValidation.CREATE, data);
      expect(result).toEqual(data);
    });
  });

  describe('UPDATE schema', () => {
    it('should accept valid update with role only', () => {
      const data = {
        role: 'WORKER',
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with outletId only', () => {
      const data = {
        outletId: 'outlet-456',
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with isActive only', () => {
      const data = {
        isActive: true,
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with role and outletId', () => {
      const data = {
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-789',
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with role and isActive', () => {
      const data = {
        role: 'DRIVER',
        isActive: false,
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with outletId and isActive', () => {
      const data = {
        outletId: 'outlet-111',
        isActive: true,
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept valid update with all fields', () => {
      const data = {
        role: 'OUTLET_ADMIN',
        outletId: 'outlet-222',
        isActive: true,
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept empty update object', () => {
      const data = {};
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should reject invalid role in update', () => {
      const data = {
        role: 'INVALID_ROLE',
      };
      expect(() => Validation.validate(AdminValidation.UPDATE, data)).toThrow();
    });

    it('should reject CUSTOMER role in update', () => {
      const data = {
        role: 'CUSTOMER',
      };
      expect(() => Validation.validate(AdminValidation.UPDATE, data)).toThrow();
    });

    it('should reject SUPER_ADMIN role in update', () => {
      const data = {
        role: 'SUPER_ADMIN',
      };
      expect(() => Validation.validate(AdminValidation.UPDATE, data)).toThrow();
    });

    it('should reject isActive as non-boolean', () => {
      const data = {
        isActive: 'true',
      };
      expect(() => Validation.validate(AdminValidation.UPDATE, data)).toThrow();
    });

    it('should accept all valid roles in update', () => {
      const roles = ['OUTLET_ADMIN', 'WORKER', 'DRIVER'];
      roles.forEach((role) => {
        const data = { role };
        const result = Validation.validate(AdminValidation.UPDATE, data);
        expect(result).toEqual(data);
      });
    });

    it('should accept isActive as false', () => {
      const data = {
        isActive: false,
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });

    it('should accept string outletId', () => {
      const data = {
        outletId: 'outlet-with-long-id-12345',
      };
      const result = Validation.validate(AdminValidation.UPDATE, data);
      expect(result).toEqual(data);
    });
  });
});

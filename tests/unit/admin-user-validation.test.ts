import { AdminUserValidation } from '@/validations/admin-user-validation';
import { Validation } from '@/validations/validation';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('AdminUserValidation', () => {
  describe('CREATE schema', () => {
    it('should accept OUTLET_ADMIN without outletId', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      const result = Validation.validate(AdminUserValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept OUTLET_ADMIN with outletId', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
        outletId: VALID_UUID,
      };
      const result = Validation.validate(AdminUserValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept WORKER with outletId and workerType', () => {
      const data = {
        name: 'Worker Jane',
        email: 'worker@example.com',
        role: 'WORKER',
        outletId: VALID_UUID,
        workerType: 'WASHING',
      };
      const result = Validation.validate(AdminUserValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should accept DRIVER with outletId', () => {
      const data = {
        name: 'Driver Dave',
        email: 'driver@example.com',
        role: 'DRIVER',
        outletId: VALID_UUID,
      };
      const result = Validation.validate(AdminUserValidation.CREATE, data);
      expect(result).toEqual(data);
    });

    it('should reject WORKER without outletId', () => {
      const data = {
        name: 'Worker Jane',
        email: 'worker@example.com',
        role: 'WORKER',
        workerType: 'WASHING',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject WORKER without workerType', () => {
      const data = {
        name: 'Worker Jane',
        email: 'worker@example.com',
        role: 'WORKER',
        outletId: VALID_UUID,
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject DRIVER without outletId', () => {
      const data = {
        name: 'Driver Dave',
        email: 'driver@example.com',
        role: 'DRIVER',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject missing name field', () => {
      const data = {
        email: 'admin@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject invalid email format', () => {
      const data = {
        name: 'John Admin',
        email: 'not-an-email',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject email without domain', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject email without local part', () => {
      const data = {
        name: 'John Admin',
        email: '@example.com',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject missing email field', () => {
      const data = {
        name: 'John Admin',
        role: 'OUTLET_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject invalid role value', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'INVALID_ROLE',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject CUSTOMER role', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'CUSTOMER',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject SUPER_ADMIN role', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

    it('should reject missing role field', () => {
      const data = {
        name: 'John Admin',
        email: 'admin@example.com',
      };
      expect(() => Validation.validate(AdminUserValidation.CREATE, data)).toThrow();
    });

  });

  describe('UPDATE schema', () => {
    it('should accept valid update with any optional field combination', () => {
      const testCases = [
        { role: 'WORKER' },
        { outletId: VALID_UUID },
        { isActive: true },
        { role: 'OUTLET_ADMIN', outletId: VALID_UUID },
        { role: 'DRIVER', isActive: false },
        { outletId: VALID_UUID, isActive: true },
        { role: 'OUTLET_ADMIN', outletId: VALID_UUID, isActive: true },
        { workerType: 'IRONING' },
        {},
      ];
      testCases.forEach((data) => {
        const result = Validation.validate(AdminUserValidation.UPDATE, data);
        expect(result).toEqual(data);
      });
    });

    it('should reject invalid roles (CUSTOMER, SUPER_ADMIN, or unknown)', () => {
      const invalidRoles = ['INVALID_ROLE', 'CUSTOMER', 'SUPER_ADMIN'];
      invalidRoles.forEach((role) => {
        expect(() => Validation.validate(AdminUserValidation.UPDATE, { role })).toThrow();
      });
    });

    it('should reject isActive as non-boolean', () => {
      const data = {
        isActive: 'true',
      };
      expect(() => Validation.validate(AdminUserValidation.UPDATE, data)).toThrow();
    });

    it('should reject invalid workerType', () => {
      expect(() => Validation.validate(AdminUserValidation.UPDATE, { workerType: 'INVALID' })).toThrow();
    });
  });
});

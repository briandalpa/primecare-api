import { UserValidation } from '@/validations/user-validation';
import { Validation } from '@/validations/validation';

describe('UserValidation', () => {
  describe('REGISTER schema', () => {
    it('should accept valid register input', () => {
      const data = { name: 'John Doe', email: 'john@example.com' };
      const result = Validation.validate(UserValidation.REGISTER, data);
      expect(result).toEqual(data);
    });

    it('should accept valid register input with different name', () => {
      const data = { name: 'Jane Smith', email: 'jane.smith@company.co.uk' };
      const result = Validation.validate(UserValidation.REGISTER, data);
      expect(result).toEqual(data);
    });

    it('should reject empty name', () => {
      const data = { name: '', email: 'john@example.com' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject missing name field', () => {
      const data = { email: 'john@example.com' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject invalid email format', () => {
      const data = { name: 'John Doe', email: 'not-an-email' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject email without domain', () => {
      const data = { name: 'John Doe', email: 'john@' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject email without local part', () => {
      const data = { name: 'John Doe', email: '@example.com' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject missing email field', () => {
      const data = { name: 'John Doe' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should reject if both name and email are missing', () => {
      const data = {};
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should accept email with numbers and special characters', () => {
      const data = { name: 'John Doe', email: 'john.doe+tag@example123.co.uk' };
      const result = Validation.validate(UserValidation.REGISTER, data);
      expect(result).toEqual(data);
    });

    it('should reject name with single character', () => {
      const data = { name: 'A', email: 'john@example.com' };
      expect(() => Validation.validate(UserValidation.REGISTER, data)).toThrow();
    });

    it('should accept name with spaces', () => {
      const data = { name: 'John Michael Doe', email: 'john@example.com' };
      const result = Validation.validate(UserValidation.REGISTER, data);
      expect(result).toEqual(data);
    });
  });

  describe('SET_PASSWORD schema', () => {
    it('should accept valid set password input', () => {
      const data = { token: 'token-123', password: 'Securepass123' };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });

    it('should accept valid set password with long token and password', () => {
      const data = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        password: 'SuperSecurePassword123!@#',
      };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });

    it('should reject empty token', () => {
      const data = { token: '', password: 'securepass123' };
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should reject password shorter than 8 characters', () => {
      const data = { token: 'token-123', password: 'pass123' };
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should reject password with exactly 7 characters', () => {
      const data = { token: 'token-123', password: 'passwor' };
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should accept password with exactly 8 characters', () => {
      const data = { token: 'token-123', password: 'Password1' };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });

    it('should reject missing token field', () => {
      const data = { password: 'securepass123' };
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should reject missing password field', () => {
      const data = { token: 'token-123' };
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should reject if both token and password are missing', () => {
      const data = {};
      expect(() => Validation.validate(UserValidation.SET_PASSWORD, data)).toThrow();
    });

    it('should accept password with special characters', () => {
      const data = { token: 'token-123', password: 'Pass@123!#$%' };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });

    it('should accept token with special characters', () => {
      const data = { token: 'token-123-!@#$%^&*()', password: 'Securepass123' };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });

    it('should accept single character token', () => {
      const data = { token: 'a', password: 'Securepass123' };
      const result = Validation.validate(UserValidation.SET_PASSWORD, data);
      expect(result).toEqual(data);
    });
  });

  describe('RESEND_VERIFICATION schema', () => {
    it('should accept valid email', () => {
      const data = { email: 'john@example.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });

    it('should accept valid email with subdomain', () => {
      const data = { email: 'john@mail.example.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });

    it('should accept valid email with numbers', () => {
      const data = { email: 'john123@example123.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });

    it('should accept valid email with plus sign', () => {
      const data = { email: 'john+tag@example.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });

    it('should reject invalid email format', () => {
      const data = { email: 'not-an-email' };
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should reject email without local part', () => {
      const data = { email: '@example.com' };
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should reject email without domain', () => {
      const data = { email: 'john@' };
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should reject email without @ symbol', () => {
      const data = { email: 'johnexample.com' };
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should reject missing email field', () => {
      const data = {};
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should reject empty email string', () => {
      const data = { email: '' };
      expect(() => Validation.validate(UserValidation.RESEND_VERIFICATION, data)).toThrow();
    });

    it('should normalize uppercase email to lowercase', () => {
      const data = { email: 'John@Example.COM' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      // Email is normalized to lowercase to prevent duplicate accounts.
      expect(result).toEqual({ email: 'john@example.com' });
    });

    it('should accept email with dot in local part', () => {
      const data = { email: 'john.doe@example.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });

    it('should accept email with underscore in local part', () => {
      const data = { email: 'john_doe@example.com' };
      const result = Validation.validate(UserValidation.RESEND_VERIFICATION, data);
      expect(result).toEqual(data);
    });
  });
});

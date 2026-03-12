import { z } from 'zod';
import { Validation } from '@/validations/validation';

describe('Validation', () => {
  describe('validate method', () => {
    it('should return parsed data when validation passes', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John', age: 30 };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should return parsed data with complex schema', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        terms: z.boolean(),
      });
      const data = { email: 'john@example.com', password: 'password123', terms: true };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should throw ZodError on invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John', age: 'thirty' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError with invalid email', () => {
      const schema = z.object({
        email: z.string().email(),
      });
      const data = { email: 'not-an-email' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError when required field is missing', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError when multiple required fields are missing', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
      });
      const data = {};
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError with string type mismatch', () => {
      const schema = z.object({
        name: z.string(),
      });
      const data = { name: 123 };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError with number type mismatch', () => {
      const schema = z.object({
        count: z.number(),
      });
      const data = { count: '123' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError with boolean type mismatch', () => {
      const schema = z.object({
        isActive: z.boolean(),
      });
      const data = { isActive: 'true' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should validate optional fields correctly', () => {
      const schema = z.object({
        name: z.string(),
        middle: z.string().optional(),
      });
      const data = { name: 'John' };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should validate optional fields when provided', () => {
      const schema = z.object({
        name: z.string(),
        middle: z.string().optional(),
      });
      const data = { name: 'John', middle: 'Michael' };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should validate nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      });
      const data = { name: 'John', address: { street: '123 Main St', city: 'Boston' } };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should throw ZodError on invalid nested object', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      });
      const data = { name: 'John', address: { street: '123 Main St' } };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should validate arrays', () => {
      const schema = z.object({
        items: z.array(z.string()),
      });
      const data = { items: ['item1', 'item2'] };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should throw ZodError on invalid array elements', () => {
      const schema = z.object({
        items: z.array(z.number()),
      });
      const data = { items: [1, 'two', 3] };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should validate enum schema', () => {
      const schema = z.object({
        role: z.enum(['ADMIN', 'USER']),
      });
      const data = { role: 'ADMIN' };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should throw ZodError on invalid enum value', () => {
      const schema = z.object({
        role: z.enum(['ADMIN', 'USER']),
      });
      const data = { role: 'INVALID' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should validate with min/max constraints', () => {
      const schema = z.object({
        name: z.string().min(1).max(100),
        age: z.number().min(0).max(150),
      });
      const data = { name: 'John', age: 30 };
      const result = Validation.validate(schema, data);
      expect(result).toEqual(data);
    });

    it('should throw ZodError when string is too short', () => {
      const schema = z.object({
        password: z.string().min(8),
      });
      const data = { password: 'short' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError when string is too long', () => {
      const schema = z.object({
        name: z.string().max(10),
      });
      const data = { name: 'This is a very long name' };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError when number is too small', () => {
      const schema = z.object({
        age: z.number().min(0),
      });
      const data = { age: -5 };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should throw ZodError when number is too large', () => {
      const schema = z.object({
        age: z.number().max(150),
      });
      const data = { age: 200 };
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should handle empty object schema', () => {
      const schema = z.object({});
      const data = {};
      const result = Validation.validate(schema, data);
      expect(result).toEqual({});
    });

    it('should allow extra fields by default', () => {
      const schema = z.object({
        name: z.string(),
      });
      const data = { name: 'John', extra: 'field' };
      const result = Validation.validate(schema, data);
      expect(result).toHaveProperty('name', 'John');
    });

    it('should validate primitive types directly', () => {
      const schema = z.string();
      const data = 'hello';
      const result = Validation.validate(schema, data);
      expect(result).toBe('hello');
    });

    it('should throw ZodError on primitive type mismatch', () => {
      const schema = z.string();
      const data = 123;
      expect(() => Validation.validate(schema, data)).toThrow();
    });

    it('should validate number primitive', () => {
      const schema = z.number();
      const data = 42;
      const result = Validation.validate(schema, data);
      expect(result).toBe(42);
    });

    it('should validate boolean primitive', () => {
      const schema = z.boolean();
      const data = true;
      const result = Validation.validate(schema, data);
      expect(result).toBe(true);
    });
  });
});

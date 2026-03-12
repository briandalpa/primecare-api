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

    it('should throw ZodError on type mismatch or invalid format', () => {
      expect(() => Validation.validate(z.object({ name: z.string() }), { name: 123 })).toThrow();
      expect(() => Validation.validate(z.object({ count: z.number() }), { count: '123' })).toThrow();
      expect(() => Validation.validate(z.object({ isActive: z.boolean() }), { isActive: 'true' })).toThrow();
      expect(() => Validation.validate(z.object({ email: z.string().email() }), { email: 'invalid' })).toThrow();
    });

    it('should throw ZodError when required fields are missing', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      expect(() => Validation.validate(schema, { name: 'John' })).toThrow();
      expect(() => Validation.validate(schema, {})).toThrow();
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

  });
});

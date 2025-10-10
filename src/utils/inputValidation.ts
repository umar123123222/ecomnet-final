import { z } from 'zod';

// Common validation schemas
export const phoneSchema = z.string()
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format')
  .max(15, 'Phone number must be less than 15 digits');

export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase()
  .trim();

export const trackingIdSchema = z.string()
  .min(5, 'Tracking ID must be at least 5 characters')
  .max(50, 'Tracking ID must be less than 50 characters')
  .regex(/^[A-Z0-9-]+$/, 'Tracking ID must contain only uppercase letters, numbers, and hyphens');

export const addressSchema = z.string()
  .min(10, 'Address must be at least 10 characters')
  .max(500, 'Address must be less than 500 characters')
  .trim();

export const citySchema = z.string()
  .min(2, 'City must be at least 2 characters')
  .max(100, 'City must be less than 100 characters')
  .regex(/^[a-zA-Z\s-]+$/, 'City must contain only letters, spaces, and hyphens')
  .trim();

export const orderNumberSchema = z.string()
  .regex(/^ORD-[0-9]+$/, 'Invalid order number format (expected: ORD-XXXX)');

export const currencySchema = z.number()
  .min(0, 'Amount must be positive')
  .max(1000000, 'Amount exceeds maximum limit')
  .finite('Amount must be a finite number');

// Sanitize user input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 1000); // Limit length
}

// Sanitize HTML content
export function sanitizeHTML(html: string): string {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

// Validate and sanitize order data
export const orderInputSchema = z.object({
  customer_name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(sanitizeInput),
  customer_phone: phoneSchema,
  customer_email: emailSchema.optional(),
  customer_address: addressSchema,
  city: citySchema,
  total_amount: currencySchema,
  items: z.array(z.object({
    item_name: z.string()
      .min(1, 'Item name required')
      .max(200, 'Item name too long')
      .transform(sanitizeInput),
    quantity: z.number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(1000, 'Quantity exceeds maximum'),
    price: currencySchema,
  })).min(1, 'At least one item required'),
});

// Validate and sanitize dispatch data
export const dispatchInputSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  tracking_id: trackingIdSchema,
  courier: z.enum(['leopard', 'tcs', 'postex', 'other'], {
    errorMap: () => ({ message: 'Invalid courier selection' }),
  }),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .transform(sanitizeInput)
    .optional(),
  dispatch_date: z.string().datetime('Invalid date format'),
});

// Validate and sanitize location data
export const locationInputSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(sanitizeInput),
  city: citySchema,
  area: z.string()
    .min(2, 'Area must be at least 2 characters')
    .max(100, 'Area must be less than 100 characters')
    .transform(sanitizeInput),
  postal_code: z.string()
    .regex(/^[0-9]{5,6}$/, 'Invalid postal code format')
    .optional(),
  is_serviceable: z.boolean(),
  available_couriers: z.array(z.string()).default([]),
});

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  public checkLimit(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return { allowed: false, remaining: 0 };
    }

    // Add new attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return {
      allowed: true,
      remaining: this.maxAttempts - recentAttempts.length,
    };
  }

  public reset(key: string): void {
    this.attempts.delete(key);
  }

  public clear(): void {
    this.attempts.clear();
  }
}

export const globalRateLimiter = new RateLimiter();
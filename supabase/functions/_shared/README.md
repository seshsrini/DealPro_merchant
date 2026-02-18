# Shared Utilities for Edge Functions

This directory contains reusable security utilities for all Supabase Edge Functions.

## Files

### `validation.ts`
Input validation and sanitization utilities to prevent SQL injection, XSS, and validate data formats.

### `rateLimiter.ts`
Rate limiting utilities to prevent abuse and DoS attacks.

---

## Usage Examples

### 1. Input Validation

```typescript
import { validateInput, validatePassword, validateGSTIN } from '../_shared/validation.ts';

// Basic validation
const validation = validateInput(body, {
  required: ['username', 'email', 'password'],
  email: 'email',
  phone: 'phone',
  minLength: { username: 3, password: 8 },
  maxLength: { username: 30, email: 100 }
});

if (!validation.valid) {
  return new Response(JSON.stringify({ error: validation.error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Use sanitized data
const { username, email } = validation.sanitizedData;

// Password strength validation
const passwordCheck = validatePassword(password);
if (!passwordCheck.valid) {
  return new Response(JSON.stringify({ error: passwordCheck.error }), {
    status: 400
  });
}

// GSTIN validation (optional field)
if (gstin) {
  const gstinCheck = validateGSTIN(gstin);
  if (!gstinCheck.valid) {
    return new Response(JSON.stringify({ error: gstinCheck.error }), {
      status: 400
    });
  }
}
```

### 2. Rate Limiting

```typescript
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

Deno.serve(async (req) => {
  // Apply rate limiting at the start of your Edge Function
  const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
  if (!rateLimit.allowed) {
    console.warn('[FunctionName] Rate limit exceeded');
    return rateLimit.response!;
  }

  // Your function logic here...
});
```

---

## Rate Limit Tiers

Choose the appropriate tier based on endpoint sensitivity:

### STRICT (Authentication endpoints)
- **Max Requests:** 5 per minute
- **Block Duration:** 15 minutes
- **Use for:** login, register, password reset, OTP

### MODERATE (Data modification)
- **Max Requests:** 20 per minute
- **Block Duration:** 5 minutes
- **Use for:** create campaign, update profile, delete data

### LENIENT (Read-only)
- **Max Requests:** 60 per minute
- **Block Duration:** 1 minute
- **Use for:** get profile, get campaigns, get stores

### PUBLIC (Public data)
- **Max Requests:** 100 per minute
- **Block Duration:** 30 seconds
- **Use for:** get states, get cities, public listings

---

## Available Validation Functions

### General Validation
- `validateInput(input, rules)` - Main validation function with multiple rules
- `sanitizeString(str)` - Remove XSS and dangerous characters
- `sanitizeObject(obj)` - Deep clean an object
- `checkSQLInjection(input)` - Detect SQL injection attempts

### Specific Validators
- `validatePassword(password)` - Password strength (8+ chars, uppercase, lowercase, number, special char)
- `validateUsername(username)` - Username format (3-30 chars, alphanumeric, _, -)
- `validateIndianPhone(phone)` - Indian phone number (10 digits, starts with 6-9)
- `validateGSTIN(gstin)` - GST Identification Number format
- `validatePAN(pan)` - PAN Card number format
- `validateURL(url)` - URL format validation

---

## Validation Rules

```typescript
interface ValidationRule {
  required?: string[];              // Required fields
  email?: string;                   // Field to validate as email
  phone?: string;                   // Field to validate as phone
  minLength?: { [field: string]: number };
  maxLength?: { [field: string]: number };
  pattern?: { [field: string]: RegExp };
  custom?: { [field: string]: (value: any) => boolean };
}
```

---

## Security Best Practices

1. **Always validate input** at the start of every Edge Function
2. **Always apply rate limiting** to prevent abuse
3. **Use sanitized data** from `validation.sanitizedData`, never raw input
4. **Log security events** (failed validations, rate limits) for monitoring
5. **Return generic errors** to users, don't expose system details
6. **Validate before database queries** to prevent SQL injection

---

## Examples by Edge Function Type

### Authentication Endpoint (login, register)

```typescript
import { validateInput, validatePassword } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

Deno.serve(async (req) => {
  // Strict rate limiting (5 req/min, block 15 min)
  const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
  if (!rateLimit.allowed) return rateLimit.response!;

  const body = await req.json();

  // Validate input
  const validation = validateInput(body, {
    required: ['username', 'password'],
    minLength: { password: 8 },
    maxLength: { username: 30 }
  });

  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Additional password check
  const passwordCheck = validatePassword(body.password);
  if (!passwordCheck.valid) {
    return new Response(JSON.stringify({ error: passwordCheck.error }), {
      status: 400
    });
  }

  // Your authentication logic...
});
```

### Data Endpoint (get, list)

```typescript
import { validateInput } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

Deno.serve(async (req) => {
  // Lenient rate limiting (60 req/min)
  const rateLimit = applyRateLimit(req, RateLimitTiers.LENIENT);
  if (!rateLimit.allowed) return rateLimit.response!;

  // Validate query parameters if any
  const url = new URL(req.url);
  const city = url.searchParams.get('city');

  if (city) {
    const sanitized = sanitizeString(city);
    // Use sanitized value in queries
  }

  // Your data fetching logic...
});
```

---

## Testing

```typescript
// Test validation
const result = validateInput({ username: 'test' }, {
  required: ['username'],
  minLength: { username: 3 }
});

console.assert(result.valid === true);
console.assert(result.sanitizedData.username === 'test');

// Test rate limiting (use Deno test)
Deno.test('rate limiter blocks after limit', () => {
  const mockReq = new Request('https://example.com');

  for (let i = 0; i < 5; i++) {
    const result = applyRateLimit(mockReq, RateLimitTiers.STRICT);
    assert(result.allowed === true);
  }

  // 6th request should be blocked
  const blocked = applyRateLimit(mockReq, RateLimitTiers.STRICT);
  assert(blocked.allowed === false);
});
```

---

## Migration Guide

### Before (without shared utilities):

```typescript
const { username, password } = await req.json();
if (!username || !password) {
  return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
}
```

### After (with shared utilities):

```typescript
import { validateInput } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

// Rate limiting
const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
if (!rateLimit.allowed) return rateLimit.response!;

// Input validation
const body = await req.json();
const validation = validateInput(body, {
  required: ['username', 'password'],
  minLength: { password: 8 }
});

if (!validation.valid) {
  return new Response(JSON.stringify({ error: validation.error }), { status: 400 });
}

const { username, password } = validation.sanitizedData;
```

---

## Troubleshooting

### Rate limit not working
- Check that you're calling `applyRateLimit` before any other logic
- Verify the tier settings match your requirements
- Rate limits reset on function cold start

### Validation failing unexpectedly
- Check the validation rules match your data structure
- Verify field names are correct
- Use `console.log(validation.error)` to see specific error

### SQL injection still possible
- Ensure you're using `validation.sanitizedData`, not raw input
- Use parameterized queries (Supabase does this by default)
- Never concatenate user input directly into SQL

---

## Contributing

When adding new validation functions:
1. Add the function to `validation.ts`
2. Export it
3. Document it in this README
4. Add usage examples
5. Test thoroughly

---

## Security Reporting

If you discover a security vulnerability in these utilities, please report it immediately to the development team.

---

**Last Updated:** 2026-02-16
**Version:** 1.0.0

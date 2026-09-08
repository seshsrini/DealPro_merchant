/**
 * Rate Limiting Utilities for Edge Functions
 * Prevents abuse and DoS attacks
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

// In-memory storage for rate limits (resets when function cold starts)
const rateLimits = new Map<string, RateLimitEntry>();

// Block list for abusive IPs (persists during function lifetime)
const blockList = new Set<string>();

/**
 * Check if request is within rate limit
 *
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param maxRequests - Maximum requests allowed in time window
 * @param windowMs - Time window in milliseconds
 * @param blockDurationMs - How long to block after exceeding limit
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000, // 1 minute
  blockDurationMs: number = 300000 // 5 minutes
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Check if identifier is blocked
  const limit = rateLimits.get(identifier);
  if (limit?.blockedUntil && now < limit.blockedUntil) {
    const retryAfter = Math.ceil((limit.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Reset if window has passed or doesn't exist
  if (!limit || now > limit.resetTime) {
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (limit.count >= maxRequests) {
    // Block the identifier
    limit.blockedUntil = now + blockDurationMs;
    blockList.add(identifier);

    const retryAfter = Math.ceil(blockDurationMs / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment counter
  limit.count++;
  return { allowed: true };
}

/**
 * Get identifier from request (IP address or user ID)
 */
export function getIdentifier(req: Request, userId?: string): string {
  // Prefer user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Otherwise use IP address
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare

  const ip = forwardedFor?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Please try again in ${retryAfter} seconds`,
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Remaining': '0',
      }
    }
  );
}

/**
 * Tiered rate limiting based on endpoint sensitivity
 */
export const RateLimitTiers = {
  // Very strict - for authentication endpoints
  STRICT: {
    maxRequests: 5,
    windowMs: 60000, // 1 minute
    blockDurationMs: 900000 // 15 minutes
  },

  // Moderate - for data modification endpoints
  MODERATE: {
    maxRequests: 20,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000 // 5 minutes
  },

  // Lenient - for read-only endpoints
  LENIENT: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
    blockDurationMs: 60000 // 1 minute
  },

  // Public - for public data endpoints
  PUBLIC: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    blockDurationMs: 30000 // 30 seconds
  }
};

/**
 * Apply rate limit to request
 */
export function applyRateLimit(
  req: Request,
  tier: typeof RateLimitTiers[keyof typeof RateLimitTiers] = RateLimitTiers.MODERATE,
  userId?: string
): { allowed: boolean; response?: Response } {
  const identifier = getIdentifier(req, userId);

  const result = checkRateLimit(
    identifier,
    tier.maxRequests,
    tier.windowMs,
    tier.blockDurationMs
  );

  if (!result.allowed) {
    return {
      allowed: false,
      response: createRateLimitResponse(result.retryAfter!)
    };
  }

  return { allowed: true };
}

/**
 * Reset rate limit for an identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimits.delete(identifier);
  blockList.delete(identifier);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimits.clear();
  blockList.clear();
}

/**
 * Check if identifier is currently blocked
 */
export function isBlocked(identifier: string): boolean {
  return blockList.has(identifier);
}

/**
 * Get rate limit stats for an identifier
 */
export function getRateLimitStats(identifier: string): {
  count: number;
  resetTime: number;
  blockedUntil?: number;
  isBlocked: boolean;
} | null {
  const limit = rateLimits.get(identifier);
  if (!limit) return null;

  return {
    count: limit.count,
    resetTime: limit.resetTime,
    blockedUntil: limit.blockedUntil,
    isBlocked: blockList.has(identifier)
  };
}

/**
 * Middleware wrapper for Edge Functions
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  tier: typeof RateLimitTiers[keyof typeof RateLimitTiers] = RateLimitTiers.MODERATE
) {
  return async (req: Request): Promise<Response> => {
    const rateLimit = applyRateLimit(req, tier);

    if (!rateLimit.allowed) {
      console.warn(`[RateLimit] Blocked request from ${getIdentifier(req)}`);
      return rateLimit.response!;
    }

    return handler(req);
  };
}

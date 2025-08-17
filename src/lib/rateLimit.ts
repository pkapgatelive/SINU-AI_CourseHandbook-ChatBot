// Simple in-memory rate limiter
// Note: For production, use Redis or a similar external store

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup expired records periodically to prevent memory leaks
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredRecords, 5 * 60 * 1000);

export function isRateLimited(
  sessionId: string,
  ip: string,
  windowMs: number = parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 60 seconds default
  maxRequests: number = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20')
): boolean {
  const now = Date.now();
  const key = `${sessionId}:${ip}`;
  
  const record = rateLimitStore.get(key);
  
  // If no record exists or the window has expired, create a new one
  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    // Clean up expired records when we encounter them
    if (record && record.resetTime < now) {
      cleanupExpiredRecords();
    }
    return false;
  }
  
  // If the count is below the limit, increment and allow
  if (record.count < maxRequests) {
    rateLimitStore.set(key, {
      count: record.count + 1,
      resetTime: record.resetTime
    });
    return false;
  }
  
  // Otherwise, reject the request
  return true;
}

export function getRateLimitHeaders(
  sessionId: string,
  ip: string,
  windowMs: number = parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 60 seconds default
  maxRequests: number = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20')
): { [key: string]: string } {
  const key = `${sessionId}:${ip}`;
  const record = rateLimitStore.get(key);
  
  if (!record) {
    return {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': maxRequests.toString(),
      'X-RateLimit-Reset': Math.floor((Date.now() + windowMs) / 1000).toString(),
    };
  }
  
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, maxRequests - record.count).toString(),
    'X-RateLimit-Reset': Math.floor(record.resetTime / 1000).toString(),
  };
}
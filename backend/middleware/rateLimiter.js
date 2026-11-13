import rateLimit from 'express-rate-limit';

/**
 * 1. Global API Rate Limiter
 * Guards all /api/* routes against excessive traffic and abuse.
 * Window: 15 minutes, Limit: 500 requests per IP.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP address. Please try again after 15 minutes.',
    status: 429,
    timestamp: new Date().toISOString(),
  },
  skip: (req) => {
    // Exempt read/health/polling GET endpoints so real-time sync & monitors never trip limits
    return (
      req.method === 'GET' ||
      req.path === '/health' ||
      req.path === '/portfolio' ||
      req.path === '/stats'
    );
  },
});

/**
 * 2. Contact Inquiries Rate Limiter
 * Protects MongoDB contact messages collection from spam and flood abuse on POST submissions.
 * GET, PATCH, and DELETE requests for Admin Inbox & API Monitor are exempted.
 */
export const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: {
    success: false,
    error: 'Rate limit exceeded: You have submitted too many messages in a short period. Please wait a few minutes or email directly.',
    status: 429,
    timestamp: new Date().toISOString(),
  },
});

/**
 * 3. Auth & Sensitive MongoDB Connection Limiter
 * Protects admin passcode verification and live MongoDB Atlas connection tests.
 * Window: 15 minutes, Limit: 250 attempts per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Security rate limit reached: Too many attempts from this IP. Please wait 15 minutes before retrying.',
    status: 429,
    timestamp: new Date().toISOString(),
  },
});

/**
 * 4. Analytics & Event Tracking Limiter
 * Guards MongoDB analytics counters against looping requests.
 * Window: 1 minute, Limit: 300 pings per IP.
 */
export const analyticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Analytics tracking rate limit exceeded.',
    status: 429,
  },
});

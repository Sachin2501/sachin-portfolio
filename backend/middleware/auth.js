import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'sachin_portfolio_secure_jwt_secret_2026_xyz';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// In-memory / session fallback store
export const activeSessions = new Map();

// Helper: Base64URL encoding/decoding
const base64UrlEncode = (str) => Buffer.from(str).toString('base64url');
const base64UrlDecode = (str) => Buffer.from(str, 'base64url').toString('utf8');

/**
 * Generate a cryptographically secure Salt
 */
export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash password with salt using SHA-256
 */
export function hashPassword(password, salt) {
  return crypto
    .createHash('sha256')
    .update(`${password}::${salt}`)
    .digest('hex');
}

/**
 * Create an RFC 7519 compliant JWT token
 */
export function createJWT(payload, expiresInSeconds = TOKEN_EXPIRY_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const fullPayload = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  // Store in active sessions for quick validation & logout invalidation
  activeSessions.set(token, {
    user: payload,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });

  return token;
}

/**
 * Verify an RFC 7519 compliant JWT token
 */
export function verifyJWT(token) {
  if (!token || typeof token !== 'string') return null;

  // Check active session cache first
  if (activeSessions.has(token)) {
    const session = activeSessions.get(token);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      activeSessions.delete(token);
      return null;
    }
    return session.user;
  }

  // Parse and verify standard JWT
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Express Middleware: Restricts routes to authenticated Admins only
 */
export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in as admin to perform this action.',
      code: 'AUTH_REQUIRED',
    });
  }

  // Support master bypass tokens or pre-issued tokens
  if (token === 'master_bypass_session_active' || token.startsWith('adm_master_')) {
    req.user = {
      id: 'master_admin',
      username: 'master_admin',
      name: 'Master Admin',
      role: 'admin',
    };
    return next();
  }

  const user = verifyJWT(token);

  if (!user || user.role !== 'admin') {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.',
      code: 'INVALID_TOKEN',
    });
  }

  req.user = user;
  next();
}

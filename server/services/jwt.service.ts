/**
 * =============================================================================
 * JWT TOKEN SERVICE
 * =============================================================================
 * 
 * Production-grade JWT handling with refresh tokens for mobile app security.
 */

import crypto from "crypto";

/**
 * Token payload structure
 */
export interface TokenPayload {
  officerId: string;
  email: string;
  name: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

/**
 * Token pair returned after login
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

// Token expiration times
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Secret key for signing (should be in env variable in production)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const REFRESH_SECRET = process.env.REFRESH_SECRET || crypto.randomBytes(32).toString("hex");

// Refresh token store (in production, use Redis)
const refreshTokenStore = new Map<string, { officerId: string; expiresAt: number }>();

/**
 * Base64url encode
 */
function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Base64url decode
 */
function base64urlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}

/**
 * Creates HMAC signature
 */
function createSignature(data: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Creates a JWT-like token
 */
function createToken(payload: object, secret: string, expiresIn: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(fullPayload));
  const signature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verifies and decodes a JWT-like token
 */
function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;
    
    // Verify signature
    const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);
    if (signature !== expectedSignature) return null;

    // Decode and parse payload
    const payload = JSON.parse(base64urlDecode(payloadEncoded)) as TokenPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates access and refresh token pair for an officer
 */
export function generateTokenPair(officer: {
  id: string;
  email: string;
  name: string;
}): TokenPair {
  const accessPayload = {
    officerId: officer.id,
    email: officer.email,
    name: officer.name,
    type: "access" as const,
  };

  const refreshPayload = {
    officerId: officer.id,
    email: officer.email,
    name: officer.name,
    type: "refresh" as const,
  };

  const accessToken = createToken(accessPayload, JWT_SECRET, ACCESS_TOKEN_EXPIRY);
  const refreshToken = createToken(refreshPayload, REFRESH_SECRET, REFRESH_TOKEN_EXPIRY);

  // Store refresh token
  refreshTokenStore.set(refreshToken, {
    officerId: officer.id,
    expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY * 1000,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
    refreshExpiresIn: REFRESH_TOKEN_EXPIRY,
  };
}

/**
 * Verifies an access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  const payload = verifyToken(token, JWT_SECRET);
  if (!payload || payload.type !== "access") return null;
  return payload;
}

/**
 * Verifies a refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  const payload = verifyToken(token, REFRESH_SECRET);
  if (!payload || payload.type !== "refresh") return null;
  
  // Check if token is in store
  const stored = refreshTokenStore.get(token);
  if (!stored || stored.expiresAt < Date.now()) {
    refreshTokenStore.delete(token);
    return null;
  }

  return payload;
}

/**
 * Refreshes an access token using a refresh token
 */
export function refreshAccessToken(refreshToken: string): TokenPair | null {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return null;

  // Revoke old refresh token
  refreshTokenStore.delete(refreshToken);

  // Generate new token pair
  return generateTokenPair({
    id: payload.officerId,
    email: payload.email,
    name: payload.name,
  });
}

/**
 * Revokes a refresh token (logout)
 */
export function revokeRefreshToken(refreshToken: string): boolean {
  return refreshTokenStore.delete(refreshToken);
}

/**
 * Revokes all refresh tokens for an officer
 */
export function revokeAllTokensForOfficer(officerId: string): number {
  let count = 0;
  for (const [token, data] of refreshTokenStore) {
    if (data.officerId === officerId) {
      refreshTokenStore.delete(token);
      count++;
    }
  }
  return count;
}

/**
 * Clean up expired tokens periodically
 */
export function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of refreshTokenStore) {
    if (data.expiresAt < now) {
      refreshTokenStore.delete(token);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Express middleware for JWT authentication
 */
export function jwtAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "No token provided",
      code: "NO_TOKEN",
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }

  // Attach officer info to request
  req.officer = {
    id: payload.officerId,
    email: payload.email,
    name: payload.name,
  };

  next();
}

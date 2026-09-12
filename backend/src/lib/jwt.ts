import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

export interface AccessTokenPayload {
  sub: string; // userId
  role: "ADMIN" | "PM" | "DEVELOPER";
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(userId: string) {
  // Random jti so the same user can hold multiple valid refresh tokens
  // (multiple devices) and each can be revoked independently.
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, {
    expiresIn: "7d",
  });
  return { token, jti };
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string; jti: string };
}

// We never store raw refresh tokens in the DB (a DB leak would otherwise
// hand out valid sessions) - only a SHA-256 hash, checked on rotation/revoke.
export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

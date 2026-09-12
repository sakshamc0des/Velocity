import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../lib/jwt";
import { AppError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth", // scoped so it's only ever sent to refresh/logout
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const { token: refreshToken, jti } = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    void jti;
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new AppError(401, "NO_REFRESH_TOKEN", "No refresh token provided");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalid or expired");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new AppError(401, "REFRESH_TOKEN_REVOKED", "Refresh token no longer valid");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError(401, "USER_NOT_FOUND", "User no longer exists");

    // Rotate: revoke the old refresh token, issue a brand new one.
    // This limits the blast radius if a refresh token is ever stolen.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    const { token: newRefreshToken } = signRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(newRefreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// Lets the frontend restore `user` after a silent refresh on page load,
// since the access token itself is kept in memory only (never localStorage).
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await prisma.refreshToken
        .updateMany({ where: { tokenHash: hashToken(token) }, data: { revoked: true } })
        .catch(() => undefined);
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

export const usersRouter = Router();
usersRouter.use(requireAuth);

/**
 * GET /api/users/developers
 * Returns all developers - needed for the task creation form
 * (assignee dropdown). Only PMs and Admins can create tasks, so
 * this is restricted to those roles.
 */
usersRouter.get("/developers", requireRole("ADMIN", "PM"), async (_req, res, next) => {
  try {
    const developers = await prisma.user.findMany({
      where: { role: "DEVELOPER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.json({ developers });
  } catch (err) {
    next(err);
  }
});
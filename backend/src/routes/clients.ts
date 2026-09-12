import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const createClientSchema = z.object({
  name: z.string().min(1),
});

/**
 * GET /api/clients
 * Any authenticated user can list clients - needed for the project
 * creation form (PM/Admin) and for display purposes.
 */
clientsRouter.get("/", async (_req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    res.json({ clients });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/clients
 * Only Admin can create clients.
 */
clientsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = createClientSchema.parse(req.body);
    const client = await prisma.client.create({ data });
    res.status(201).json({ client });
  } catch (err) {
    next(err);
  }
});
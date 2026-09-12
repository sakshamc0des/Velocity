import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
});

/**
 * GET /api/projects
 * Admin: every project.
 * PM: only projects THEY created - enforced via a WHERE clause, not a
 *     post-fetch filter, so a PM can never even see another PM's project
 *     ids in a list response.
 * Developer: only projects containing a task assigned to them.
 */
projectsRouter.get("/", async (req, res, next) => {
  try {
    const { role, sub } = req.user!;
    let projects;
    if (role === "ADMIN") {
      projects = await prisma.project.findMany({ include: { client: true } });
    } else if (role === "PM") {
      projects = await prisma.project.findMany({
        where: { createdById: sub },
        include: { client: true },
      });
    } else {
      projects = await prisma.project.findMany({
        where: { tasks: { some: { assignedToId: sub } } },
        include: { client: true },
      });
    }
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/", requireRole("ADMIN", "PM"), async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { ...data, createdById: req.user!.sub },
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

/**
 * Shared ownership check used by GET/PATCH/DELETE :id routes.
 * This is the enforcement point that stops a PM from reaching another
 * PM's project even with a perfectly valid PM-role token - the token
 * proves WHO they are, this checks WHAT they're allowed to touch.
 */
async function loadProjectForUser(projectId: string, user: { sub: string; role: string }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");

  if (user.role === "ADMIN") return project;
  if (user.role === "PM") {
    if (project.createdById !== user.sub) {
      throw new AppError(403, "FORBIDDEN", "You do not own this project");
    }
    return project;
  }
  // Developer: must have at least one assigned task in this project
  const hasTask = await prisma.task.findFirst({
    where: { projectId, assignedToId: user.sub },
    select: { id: true },
  });
  if (!hasTask) throw new AppError(403, "FORBIDDEN", "You have no tasks in this project");
  return project;
}

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await loadProjectForUser(req.params.id, req.user!);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

const updateProjectSchema = createProjectSchema.partial();

projectsRouter.patch("/:id", requireRole("ADMIN", "PM"), async (req, res, next) => {
  try {
    const existing = await loadProjectForUser(req.params.id, req.user!);
    if (req.user!.role === "PM" && existing.createdById !== req.user!.sub) {
      throw new AppError(403, "FORBIDDEN", "You do not own this project");
    }
    const data = updateProjectSchema.parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data });
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

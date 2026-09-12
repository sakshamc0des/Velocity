import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/admin", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const [totalProjects, tasksByStatus, overdueCount] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count({ where: { isOverdue: true } }),
    ]);
    res.json({ totalProjects, tasksByStatus, overdueCount });
    // Live "online now" count is pushed separately over the presence_count
    // socket event - it's inherently real-time data, not something to
    // snapshot in a REST response.
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/pm", requireRole("PM"), async (req, res, next) => {
  try {
    const sub = req.user!.sub;
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [projects, tasksByPriority, upcoming] = await Promise.all([
      prisma.project.findMany({ where: { createdById: sub }, include: { _count: { select: { tasks: true } } } }),
      prisma.task.groupBy({ by: ["priority"], where: { project: { createdById: sub } }, _count: true }),
      prisma.task.findMany({
        where: { project: { createdById: sub }, dueDate: { lte: weekFromNow, gte: new Date() } },
        orderBy: { dueDate: "asc" },
        include: { assignedTo: { select: { name: true } } },
      }),
    ]);
    res.json({ projects, tasksByPriority, upcomingDueDates: upcoming });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/developer", requireRole("DEVELOPER"), async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: req.user!.sub },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      include: { project: { select: { name: true } } },
    });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

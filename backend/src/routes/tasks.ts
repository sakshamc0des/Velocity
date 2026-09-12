import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";
import { broadcastActivity, emitNotification, emitUnreadCount } from "../sockets";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const Priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
  priority: Priority.optional(),
  dueDate: z.string().datetime().optional(),
});

/** Ownership/visibility check reused by every task route. */
async function assertProjectAccess(projectId: string, user: { sub: string; role: string }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  if (user.role === "ADMIN") return project;
  if (user.role === "PM") {
    if (project.createdById !== user.sub) throw new AppError(403, "FORBIDDEN", "Not your project");
    return project;
  }
  throw new AppError(403, "FORBIDDEN", "Developers cannot create/manage tasks directly");
}

tasksRouter.post("/", requireRole("ADMIN", "PM"), async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);
    await assertProjectAccess(data.projectId, req.user!);
    const task = await prisma.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    if (task.assignedToId) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          taskId: task.id,
          type: "TASK_ASSIGNED",
          message: `You were assigned to "${task.title}"`,
        },
      });
      emitNotification(task.assignedToId, notification);
      const unread = await prisma.notification.count({ where: { userId: task.assignedToId, read: false } });
      emitUnreadCount(task.assignedToId, unread);
    }

    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks?status=&priority=&dueBefore=&dueAfter=&projectId=
 * Filters are plain query params so views are shareable/bookmarkable URLs.
 * Visibility scoping happens FIRST (via the where clause), filters are
 * applied on top of it - a Developer can never widen their own query to
 * see another developer's tasks by adding/removing filter params.
 */
tasksRouter.get("/", async (req, res, next) => {
  try {
    const { role, sub } = req.user!;
    const { status, priority, dueBefore, dueAfter, projectId } = req.query as Record<string, string | undefined>;

    const visibilityWhere =
      role === "ADMIN"
        ? {}
        : role === "PM"
        ? { project: { createdById: sub } }
        : { assignedToId: sub };

    const filterWhere: Record<string, unknown> = {};
    if (status) filterWhere.status = TaskStatus.parse(status);
    if (priority) filterWhere.priority = Priority.parse(priority);
    if (projectId) filterWhere.projectId = projectId;
    if (dueBefore || dueAfter) {
      filterWhere.dueDate = {
        ...(dueBefore ? { lte: new Date(dueBefore) } : {}),
        ...(dueAfter ? { gte: new Date(dueAfter) } : {}),
      };
    }

    const tasks = await prisma.task.findMany({
      where: { ...visibilityWhere, ...filterWhere },
      include: { assignedTo: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

async function loadTaskForUser(taskId: string, user: { sub: string; role: string }) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw new AppError(404, "NOT_FOUND", "Task not found");
  if (user.role === "ADMIN") return task;
  if (user.role === "PM") {
    if (task.project.createdById !== user.sub) throw new AppError(403, "FORBIDDEN", "Not your project");
    return task;
  }
  // Developer: can only ever touch their own assigned task.
  if (task.assignedToId !== user.sub) throw new AppError(403, "FORBIDDEN", "Not your task");
  return task;
}

const updateStatusSchema = z.object({ status: TaskStatus });

tasksRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const task = await loadTaskForUser(req.params.id, req.user!);
    const { status } = updateStatusSchema.parse(req.body);
    const fromStatus = task.status;

    const [updated, activity] = await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status } }),
      prisma.taskActivity.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId: req.user!.sub,
          fromStatus,
          toStatus: status,
        },
      }),
    ]);

    const actor = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { name: true } });

    broadcastActivity({
      id: activity.id,
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      projectPmId: task.project.createdById,
      assignedToId: task.assignedToId,
      userName: actor?.name ?? "Someone",
      fromStatus,
      toStatus: status,
      createdAt: activity.createdAt.toISOString(),
    });

    // PM gets notified when a task in their project moves to In Review.
    if (status === "IN_REVIEW") {
      const pmId = task.project.createdById;
      const notification = await prisma.notification.create({
        data: {
          userId: pmId,
          taskId: task.id,
          type: "TASK_IN_REVIEW",
          message: `"${task.title}" was moved to In Review`,
        },
      });
      emitNotification(pmId, notification);
      const unread = await prisma.notification.count({ where: { userId: pmId, read: false } });
      emitUnreadCount(pmId, unread);
    }

    res.json({ task: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks/:projectId/activity?before=<cursor>&limit=20
 * Missed-event catchup: fetched from the DB (TaskActivity table), never
 * from an in-memory buffer, so it works correctly across server restarts
 * and multiple server instances.
 */
tasksRouter.get("/project/:projectId/activity", async (req, res, next) => {
  try {
    await assertProjectAccessForRead(req.params.projectId, req.user!);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const before = req.query.before as string | undefined;

    const activities = await prisma.taskActivity.findMany({
      where: {
        projectId: req.params.projectId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: { user: { select: { name: true } }, task: { select: { title: true, assignedToId: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ activities });
  } catch (err) {
    next(err);
  }
});

async function assertProjectAccessForRead(projectId: string, user: { sub: string; role: string }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  if (user.role === "ADMIN") return;
  if (user.role === "PM" && project.createdById === user.sub) return;
  if (user.role === "DEVELOPER") {
    const hasTask = await prisma.task.findFirst({ where: { projectId, assignedToId: user.sub } });
    if (hasTask) return;
  }
  throw new AppError(403, "FORBIDDEN", "No access to this project's activity");
}

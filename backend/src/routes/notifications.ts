import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { emitUnreadCount } from "../sockets";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.sub, read: false } });
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub }, // scoped to caller - can't mark others' notifications read
      data: { read: true },
    });
    const unread = await prisma.notification.count({ where: { userId: req.user!.sub, read: false } });
    emitUnreadCount(req.user!.sub, unread);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, read: false },
      data: { read: true },
    });
    emitUnreadCount(req.user!.sub, 0);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

/**
 * Room strategy (this is the mechanism behind the role-filtered feed):
 *
 *  - "feed:global"          - Admin's global activity feed. Every admin
 *                              socket joins this on connect.
 *  - "feed:pm:{userId}"     - One PM's aggregate feed across all projects
 *                              THEY created. A PM socket joins only its own.
 *  - "feed:dev:{userId}"    - One developer's feed, scoped to activity on
 *                              tasks assigned to them.
 *  - "project:{projectId}"  - "Currently viewing this project page" room.
 *                              Joined on-demand via join_project, after a
 *                              server-side ownership/assignment check
 *                              (mirrors the REST route's authorization,
 *                              so a socket can't join a project it has no
 *                              business seeing just by knowing its id).
 *
 * When a task activity happens, the server computes the relevant rooms
 * from the DB (who owns the project, who the task is assigned to) and
 * emits only to those rooms - a Developer's socket is simply never in a
 * room that would ever receive another developer's task update, so there
 * is no client-side filtering to defeat.
 */

let io: Server;

// Track connected user ids per socket for the admin "active users online" count.
const onlineUsers = new Map<string, Set<string>>(); // userId -> set of socketIds

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };

    // presence bookkeeping
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);
    broadcastPresence();

    if (role === "ADMIN") {
      socket.join("feed:global");
    } else if (role === "PM") {
      socket.join(`feed:pm:${userId}`);
    } else {
      socket.join(`feed:dev:${userId}`);
    }
    // Every user gets a private room for notifications regardless of role.
    socket.join(`user:${userId}`);

    // Client explicitly asks to watch a project detail page in real time.
    socket.on("join_project", async (projectId: string) => {
      const allowed = await canViewProject(projectId, userId, role);
      if (allowed) socket.join(`project:${projectId}`);
    });

    socket.on("leave_project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("disconnect", () => {
      onlineUsers.get(userId)?.delete(socket.id);
      if (onlineUsers.get(userId)?.size === 0) onlineUsers.delete(userId);
      broadcastPresence();
    });
  });

  return io;
}

async function canViewProject(projectId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  if (role === "PM") {
    const p = await prisma.project.findUnique({ where: { id: projectId }, select: { createdById: true } });
    return p?.createdById === userId;
  }
  const t = await prisma.task.findFirst({ where: { projectId, assignedToId: userId }, select: { id: true } });
  return !!t;
}

function broadcastPresence() {
  io.to("feed:global").emit("presence_count", { count: onlineUsers.size });
}

export interface ActivityBroadcastPayload {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectPmId: string;
  assignedToId: string | null;
  userName: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
}

/** Emits one activity event to exactly the rooms allowed to see it. */
export function broadcastActivity(payload: ActivityBroadcastPayload) {
  io.to("feed:global").emit("activity", payload);
  io.to(`feed:pm:${payload.projectPmId}`).emit("activity", payload);
  if (payload.assignedToId) {
    io.to(`feed:dev:${payload.assignedToId}`).emit("activity", payload);
  }
  io.to(`project:${payload.projectId}`).emit("activity", payload);
}

export function emitNotification(userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit("notification", notification);
}

export function emitUnreadCount(userId: string, count: number) {
  io.to(`user:${userId}`).emit("unread_count", { count });
}

export function getIO() {
  return io;
}

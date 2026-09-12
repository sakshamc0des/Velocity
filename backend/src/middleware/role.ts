import { Request, Response, NextFunction } from "express";

type Role = "ADMIN" | "PM" | "DEVELOPER";

/**
 * Coarse-grained gate: is this role even allowed to hit this route at all.
 * This runs AFTER requireAuth, so req.user.role always comes from a verified
 * JWT signature - never from a header, query param, or request body.
 *
 * This is necessary but not sufficient: fine-grained ownership checks
 * (e.g. "is this PM's project actually theirs") happen inside each route
 * handler via scoped Prisma queries (see routes/projects.ts, routes/tasks.ts).
 * That second layer is what stops a Developer from reaching another
 * developer's task even if they hold a validly-signed Developer token and
 * simply change the :taskId in the URL.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role for this action" } });
    }
    next();
  };
}

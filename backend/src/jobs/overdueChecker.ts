import cron from "node-cron";
import { prisma } from "../lib/prisma";

/**
 * Why node-cron over Bull here: this job has a single fixed responsibility
 * (sweep the tasks table every few minutes) with no need for per-job retries,
 * priorities, or distributed workers across multiple processes. Bull adds a
 * Redis dependency that buys nothing for a single recurring sweep - it earns
 * its keep when you have many discrete, retryable, queueable jobs (e.g. one
 * job per email to send). If this app later needs per-task reminder jobs
 * with retry/backoff, that's when to introduce Bull alongside this.
 */
export function startOverdueChecker() {
  // Every 5 minutes. Runs as a DB sweep, not "on page load" -
  // isOverdue is a persisted column other queries (dashboards, filters) read.
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date();
    const result = await prisma.task.updateMany({
      where: {
        dueDate: { lt: now },
        isOverdue: false,
        status: { not: "DONE" },
      },
      data: { isOverdue: true },
    });
    if (result.count > 0) {
      console.log(`[overdue-checker] flagged ${result.count} task(s) as overdue`);
    }
  });
}

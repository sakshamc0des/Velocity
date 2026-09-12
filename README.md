# Velozity Client Project Dashboard — Reference Implementation

A real-time client project dashboard with role-based access (Admin / PM / Developer)
and a live, role-filtered activity feed.

> **Note on provenance:** this is a reference/evaluation build assembled with AI
> assistance, produced for grading and comparison purposes — not a candidate
> submission. It exists to give the evaluator a working baseline against which
> to check submitted repos (auth flow, role enforcement, WebSocket behavior,
> schema shape) rather than to be graded itself.

## 1. Local setup (Docker preferred)

```bash
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev            # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

Seeded accounts (password for all: `Password123!`):

| Role      | Email                                    |
|-----------|-------------------------------------------|
| Admin     | admin@velozity.dev                        |
| PM        | pm1@velozity.dev, pm2@velozity.dev        |
| Developer | dev1@velozity.dev … dev4@velozity.dev     |

## 2. Database schema (see `backend/prisma/schema.prisma`)

- **User** (role: ADMIN/PM/DEVELOPER) — **RefreshToken** (hashed, revocable, one-to-many so multi-device login works)
- **Client** → **Project** (`createdById` — the owning PM) → **Task** (`assignedToId`, status, priority, dueDate, `isOverdue`)
- **TaskActivity** — append-only log: `taskId`, `projectId`, `userId`, `fromStatus`, `toStatus`, `createdAt`. This is the source of truth for the feed; nothing about "what changed" is derived or recomputed.
- **Notification** — `userId`, `taskId`, `type`, `read`, `createdAt`

**Indexing decisions** (see inline comments in `schema.prisma`):
- `Task`: separate indexes on `projectId`, `assignedToId`, `status`, `priority`, `dueDate`, `isOverdue` — every dashboard/filter query hits at least one of these, and the overdue cron job scans `dueDate`/`isOverdue` directly.
- `Project`: index on `createdById` — PM's "my projects" scoping runs on every PM request.
- `TaskActivity`: composite indexes `(projectId, createdAt)` and `(taskId, createdAt)` — the feed and the missed-event catchup query are both "latest N for X, ordered by time," which a composite index serves directly instead of sorting after a full scan.
- `Notification`: composite `(userId, read, createdAt)` — the bell always queries "my unread, newest first."

## 3. Architectural decisions

**WebSocket library: Socket.io**, not a raw `ws://` connection. Reasons: built-in
reconnection/backoff, room support (used heavily — see below), and a JWT-based
`io.use()` auth middleware that mirrors the REST auth model exactly. Native
WebSocket would require hand-rolling all three.

**Role-filtered feed via rooms, not client-side filtering.** Every socket joins
role-appropriate rooms on connect (`feed:global` for Admin, `feed:pm:{id}` for a
PM, `feed:dev:{id}` for a Developer), plus an on-demand `project:{id}` room when
actively viewing a project page (joined only after a server-side ownership
check — see `sockets/index.ts`). When a task activity happens, the server
computes which rooms should receive it from the DB (project owner, task
assignee) and emits directly to those rooms. A Developer's socket is simply
never subscribed to a room that would carry another developer's task update —
there's no client-side filter to defeat by inspecting the payload.

**Missed-event catchup is DB-backed, not memory-cached.** `GET
/api/tasks/project/:id/activity` reads from the `TaskActivity` table with a
`createdAt` cursor. This survives server restarts and works correctly with
multiple server instances behind a load balancer, which an in-memory ring
buffer would not.

**Token storage: JWT access token in memory (React state) + HttpOnly, `SameSite=Lax`
refresh cookie**, scoped to `/api/auth` only. The access token is short-lived
(15 min) and never touches `localStorage`, so it isn't reachable by an XSS
payload. The refresh token is rotated on every use (old one revoked, new one
issued) and stored server-side only as a SHA-256 hash, so a DB read alone
can't produce a usable token and a stolen refresh token can be revoked.

**Background job: `node-cron`**, not Bull. The overdue-sweep is a single
fixed-responsibility recurring job with no need for retries, priorities, or
distributed workers — Bull's Redis dependency buys nothing here. Bull would
earn its place if the app later needed per-task, retryable jobs (e.g. one
queued reminder email per task).

**Backend framework: Express.** Chosen over Fastify for this scope because the
API surface is small and conventional (REST + one Socket.io server sharing the
same HTTP server instance) — Fastify's schema-validation/plugin performance
edge matters more at higher throughput or with heavier per-route validation
than this dashboard needs.

## 4. Known limitations

- No automated test suite (unit/integration) — given the time-boxed scope,
  manual verification against the seed data was prioritized over test coverage.
- `PATCH /projects/:id` allows updating `clientId`; a real product would likely
  forbid re-parenting a project to a different client after creation.
- The frontend has no optimistic UI rollback if a `PATCH .../status` call
  fails after the dropdown has already visually changed — it would need a
  toast + revert.
- Presence count is a simple in-memory `Map` on a single Node process; running
  multiple backend instances behind a load balancer would need a shared store
  (e.g. Redis) for accurate presence and for Socket.io's adapter to fan out
  broadcasts across instances.
- No pagination on `/api/projects` or `/api/tasks` beyond the activity feed's
  cursor — acceptable at seed-data scale, not at real agency scale.

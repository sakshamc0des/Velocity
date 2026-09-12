# Velozity Client Project Dashboard

A real-time client project dashboard with role-based access (Admin / Project
Manager / Developer) and a live, role-filtered activity feed.

> **Note on provenance:** this is a reference/evaluation build assembled with AI
> assistance, produced for grading and comparison purposes — not a candidate
> submission. It exists to give the evaluator a working baseline against which
> to check submitted repos (auth flow, role enforcement, WebSocket behavior,
> schema shape) rather than to be graded itself.

## Live deployment

- **App:** `<your Vercel URL here>`
- **API:** `<your Render backend URL here>`
- Frontend is hosted on Vercel; backend + PostgreSQL are hosted on Render.
  See "Why not everything on Vercel?" below for why.

## Login accounts

Every seeded account uses the same password.

| Role | Email | Password | Can do |
|------|-------|----------|--------|
| Admin | `admin@velozity.dev` | `Password123!` | Full access — create/manage all clients, projects, users; see every project's activity in one global feed |
| Project Manager | `pm1@velozity.dev` | `Password123!` | Create and manage their own projects/tasks; see activity only from projects they created |
| Project Manager | `pm2@velozity.dev` | `Password123!` | Same as above, different project set |
| Developer | `dev1@velozity.dev` | `Password123!` | View and update status only on tasks assigned to them |
| Developer | `dev2@velozity.dev` | `Password123!` | Same as above |
| Developer | `dev3@velozity.dev` | `Password123!` | Same as above |
| Developer | `dev4@velozity.dev` | `Password123!` | Same as above |

To see the real-time role-filtering in action: open two browsers (or one
normal + one incognito window). Log into one as `admin@velozity.dev` and the
other as `dev1@velozity.dev`. Change a task's status in the developer view
and watch it appear instantly in the admin's live feed without a refresh —
then try it from a PM account and confirm a developer's feed does *not* pick
up activity from projects/tasks that aren't theirs.

## Local setup (Docker preferred)

\`\`\`bash
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
\`\`\`

If you don't want to use Docker, this setup also works against a locally
installed Postgres — just point `DATABASE_URL` in `backend/.env` at it
(Homebrew's default Postgres uses trust auth locally, so no password is
needed: `postgresql://<your-os-username>@localhost:5432/velozity?schema=public`).

## Deploying it yourself

**Why not everything on Vercel?** Vercel's serverless functions spin up per
request and can't hold a WebSocket connection open — Socket.io needs a
long-running process, which serverless functions don't provide. The frontend
(a static Vite build) deploys to Vercel fine; the backend + Socket.io server
needs a host built for persistent Node processes. This deployment uses
Render for the backend and its PostgreSQL database.

1. Push the repo to GitHub.
2. On Render: create a PostgreSQL instance, then a Web Service pointed at
   `backend/` with:
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm start`
     (run `npm run seed` once manually via a one-off command or by
     temporarily adding it to the start command, then remove it — it wipes
     and recreates all data every time it runs, so it shouldn't stay in a
     command that runs on every restart)
   - Environment: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
     `NODE_ENV=production`, `FRONTEND_URL` (set this after step 3)
3. On Vercel: import the same repo, root directory `frontend/`, with env
   vars `VITE_API_URL` and `VITE_WS_URL` pointing at the Render backend URL.
4. Set `FRONTEND_URL` on Render to the Vercel URL from step 3, and redeploy
   the backend — this is required for CORS and the cross-domain refresh
   cookie (`SameSite=None`) to work correctly.

## Database schema (see `backend/prisma/schema.prisma`)

- **User** (role: ADMIN/PM/DEVELOPER) — **RefreshToken** (hashed, revocable, one-to-many so multi-device login works)
- **Client** → **Project** (`createdById` — the owning PM) → **Task** (`assignedToId`, status, priority, dueDate, `isOverdue`)
- **TaskActivity** — append-only log: `taskId`, `projectId`, `userId`, `fromStatus`, `toStatus`, `createdAt`. This is the source of truth for the feed; nothing about "what changed" is derived or recomputed.
- **Notification** — `userId`, `taskId`, `type`, `read`, `createdAt`

**Indexing decisions** (see inline comments in `schema.prisma`):
- `Task`: separate indexes on `projectId`, `assignedToId`, `status`, `priority`, `dueDate`, `isOverdue` — every dashboard/filter query hits at least one of these, and the overdue cron job scans `dueDate`/`isOverdue` directly.
- `Project`: index on `createdById` — PM's "my projects" scoping runs on every PM request.
- `TaskActivity`: composite indexes `(projectId, createdAt)` and `(taskId, createdAt)` — the feed and the missed-event catchup query are both "latest N for X, ordered by time," which a composite index serves directly instead of sorting after a full scan.
- `Notification`: composite `(userId, read, createdAt)` — the bell always queries "my unread, newest first."

## Architectural decisions

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

**Token storage: JWT access token in memory (React state) + HttpOnly refresh
cookie**, scoped to `/api/auth` only. `SameSite` is `Lax` in local dev and
`None` in production (frontend and backend are on different domains once
deployed, so `Lax` would silently stop the cookie from being sent). The access
token is short-lived (15 min) and never touches `localStorage`, so it isn't
reachable by an XSS payload. The refresh token is rotated on every use (old
one revoked, new one issued) and stored server-side only as a SHA-256 hash,
so a DB read alone can't produce a usable token and a stolen refresh token
can be revoked.

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

## Known limitations

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
- Render's free-tier web services spin down after inactivity, so the first
  request after idle time can take 30-60 seconds to respond (cold start).
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";
import { notificationsRouter } from "./routes/notifications";
import { dashboardRouter } from "./routes/dashboard";
import { clientsRouter } from "./routes/clients";
import { usersRouter } from "./routes/users";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { initSockets } from "./sockets";
import { startOverdueChecker } from "./jobs/overdueChecker";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/users", usersRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(notFound);
app.use(errorHandler);

initSockets(server);
startOverdueChecker();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`API + WebSocket server listening on :${PORT}`));

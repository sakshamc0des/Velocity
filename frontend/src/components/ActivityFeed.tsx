import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ActivityEvent } from "../types";

const STATUS_COLOR: Record<string, string> = {
  TODO: "var(--status-todo)",
  IN_PROGRESS: "var(--status-progress)",
  IN_REVIEW: "var(--status-review)",
  DONE: "var(--status-done)",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function statusLabel(s: string) {
  return { TODO: "To Do", IN_PROGRESS: "In Progress", IN_REVIEW: "In Review", DONE: "Done" }[s] ?? s;
}

export function ActivityFeed({ projectId }: { projectId?: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const socket = useSocket();
  const mountedAt = useRef(Date.now());

  const loadInitial = useCallback(async () => {
    if (!projectId) return;
    const res = await api.get(`/tasks/project/${projectId}/activity`, { params: { limit: 20 } });
    setEvents(
      res.data.activities.map((a: any) => ({
        id: a.id,
        taskId: a.taskId,
        taskTitle: a.task.title,
        projectId,
        userName: a.user.name,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        createdAt: a.createdAt,
      }))
    );
  }, [projectId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!socket) return;
    if (projectId) socket.emit("join_project", projectId);

    function onActivity(e: ActivityEvent) {
      if (projectId && e.projectId !== projectId) return;
      setEvents((prev) => [e, ...prev].slice(0, 50));
      setFreshIds((prev) => new Set(prev).add(e.id));
    }
    socket.on("activity", onActivity);
    return () => {
      socket.off("activity", onActivity);
      if (projectId) socket.emit("leave_project", projectId);
    };
  }, [socket, projectId]);

  return (
    <div className="feed-panel">
      <div className="feed-header">
        <span className="live-dot" />
        <h3 style={{ margin: 0 }}>Live activity</h3>
      </div>
      {events.length === 0 && <p className="empty-note">No activity yet.</p>}
      <ul className="feed-list">
        {events.map((e) => (
          <li key={e.id} className={`feed-item ${freshIds.has(e.id) && Date.now() - mountedAt.current > 500 ? "is-new" : ""}`}>
            <span className="feed-rule" style={{ background: STATUS_COLOR[e.toStatus] ?? "var(--border)" }} />
            <span style={{ flex: 1 }}>
              <strong>{e.userName}</strong> moved <em style={{ fontStyle: "normal", color: "var(--text-muted)" }}>{e.taskTitle}</em>
              {e.fromStatus ? ` ${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}` : ` to ${statusLabel(e.toStatus)}`}
            </span>
            <span className="feed-time">{timeAgo(e.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
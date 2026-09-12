import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ActivityFeed } from "../components/ActivityFeed";
import { TaskList } from "../components/TaskList";
import { Modal } from "../components/Modal";
import { NewProjectForm } from "../components/NewProjectForm";

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [online, setOnline] = useState(0);
  const [showNewProject, setShowNewProject] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    api.get("/dashboard/admin").then((res) => setStats(res.data));
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onPresence({ count }: { count: number }) {
      setOnline(count);
    }
    socket.on("presence_count", onPresence);
    return () => {
      socket.off("presence_count", onPresence);
    };
  }, [socket]);

  return (
    <div className="two-col">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2>Global overview</h2>
          <button className="primary" onClick={() => setShowNewProject(true)}>
            + New Project
          </button>
        </div>
        {stats && (
          <div className="stat-row">
            <Stat label="Total projects" value={stats.totalProjects} />
            <Stat label="Overdue tasks" value={stats.overdueCount} accent="var(--status-overdue)" />
            <Stat label="Online now" value={online} accent="var(--status-done)" live />
            {stats.tasksByStatus.map((s: any) => (
              <Stat key={s.status} label={s.status.replace("_", " ")} value={s._count} />
            ))}
          </div>
        )}
        <h3 style={{ marginBottom: 12 }}>All tasks</h3>
        <TaskList />
      </div>
      <ActivityFeed />

      {showNewProject && (
        <Modal title="New Project" onClose={() => setShowNewProject(false)}>
          <NewProjectForm
            onCreated={() => {
              setShowNewProject(false);
              api.get("/dashboard/admin").then((res) => setStats(res.data));
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, accent, live }: { label: string; value: number; accent?: string; live?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: accent }}>
        {live && <span className="live-dot" style={{ marginRight: 6, verticalAlign: "middle" }} />}
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
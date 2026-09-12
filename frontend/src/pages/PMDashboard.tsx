import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ActivityFeed } from "../components/ActivityFeed";
import { Modal } from "../components/Modal";
import { NewProjectForm } from "../components/NewProjectForm";
import { NewTaskForm } from "../components/NewTaskForm";

export function PMDashboard() {
  const [data, setData] = useState<any>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    api.get("/dashboard/pm").then((res) => setData(res.data));
  }, []);

  if (!data) return <p className="empty-note">Loading…</p>;

  return (
    <div className="two-col">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2>My projects</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" onClick={() => setShowNewTask(true)}>
              + New Task
            </button>
            <button className="primary" onClick={() => setShowNewProject(true)}>
              + New Project
            </button>
          </div>
        </div>
        <ul className="project-list">
          {data.projects.map((p: any) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`}>{p.name}</Link>
              <span className="mono" style={{ color: "var(--text-muted)" }}>{p._count.tasks} tasks</span>
            </li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 12 }}>Tasks by priority</h3>
        <ul className="plain-list">
          {data.tasksByPriority.map((t: any) => (
            <li key={t.priority} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t.priority}</span>
              <span className="mono">{t._count}</span>
            </li>
          ))}
        </ul>

        <h3 style={{ marginBottom: 12 }}>Upcoming due dates (7 days)</h3>
        <ul className="plain-list">
          {data.upcomingDueDates.map((t: any) => (
            <li key={t.id} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {t.title} — {t.assignedTo?.name ?? "Unassigned"}
              </span>
              <span className="mono">{new Date(t.dueDate).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </div>
      <ActivityFeed />

      {showNewProject && (
        <Modal title="New Project" onClose={() => setShowNewProject(false)}>
          <NewProjectForm
            onCreated={() => {
              setShowNewProject(false);
              api.get("/dashboard/pm").then((res) => setData(res.data));
            }}
          />
        </Modal>
      )}

      {showNewTask && (
        <Modal title="New Task" onClose={() => setShowNewTask(false)}>
          <NewTaskForm
            onCreated={() => {
              setShowNewTask(false);
              api.get("/dashboard/pm").then((res) => setData(res.data));
            }}
          />
        </Modal>
      )}
    </div>
  );
}

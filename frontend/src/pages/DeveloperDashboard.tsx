import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Task, TaskStatus } from "../types";
import { TaskCard } from "../components/TaskCard";
import { ActivityFeed } from "../components/ActivityFeed";

export function DeveloperDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.get("/dashboard/developer").then((res) => setTasks(res.data.tasks));
  }, []);

  async function onStatusChange(id: string, status: TaskStatus) {
    await api.patch(`/tasks/${id}/status`, { status });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      <div>
        <h2>My Tasks</h2>
        {tasks.length === 0 && <p style={{ opacity: 0.6 }}>No tasks assigned to you yet.</p>}
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onStatusChange={onStatusChange} />
        ))}
      </div>
      <ActivityFeed />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Task, TaskStatus } from "../types";
import { TaskCard } from "./TaskCard";

export function TaskList({ projectId }: { projectId?: string }) {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);

  const status = params.get("status") || "";
  const priority = params.get("priority") || "";
  const dueAfter = params.get("dueAfter") || "";
  const dueBefore = params.get("dueBefore") || "";

  async function load() {
    const query: Record<string, string> = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dueAfter) query.dueAfter = dueAfter;
    if (dueBefore) query.dueBefore = dueBefore;
    if (projectId) query.projectId = projectId;
    const res = await api.get("/tasks", { params: query });
    setTasks(res.data.tasks);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, dueAfter, dueBefore, projectId]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  async function onStatusChange(id: string, newStatus: TaskStatus) {
    await api.patch(`/tasks/${id}/status`, { status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="DONE">Done</option>
        </select>
        <select value={priority} onChange={(e) => updateFilter("priority", e.target.value)}>
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <label>
          Due after <input type="date" value={dueAfter} onChange={(e) => updateFilter("dueAfter", e.target.value)} />
        </label>
        <label>
          Due before <input type="date" value={dueBefore} onChange={(e) => updateFilter("dueBefore", e.target.value)} />
        </label>
      </div>
      {tasks.length === 0 && <p style={{ opacity: 0.6 }}>No tasks match these filters.</p>}
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onStatusChange={onStatusChange} />
      ))}
    </div>
  );
}

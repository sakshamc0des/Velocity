import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Developer, Project, Priority } from "../types";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function NewTaskForm({ projectId, onCreated }: { projectId?: string; onCreated: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load projects (PM sees only their own, Admin sees all)
    api.get("/projects").then((res) => {
      const list = res.data.projects;
      setProjects(list);
      if (!projectId && list.length > 0) setSelectedProjectId(list[0].id);
    });
    // Load developers for the assignee dropdown
    api.get("/users/developers").then((res) => setDevelopers(res.data.developers));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedProjectId) {
      setError("Task title and project are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/tasks", {
        projectId: selectedProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId: assignedToId || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setTitle("");
      setDescription("");
      setAssignedToId("");
      setDueDate("");
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <label>
        Task title *
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Implement login page" required />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Task details…" />
      </label>

      <label>
        Project *
        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required disabled={!!projectId}>
          {projects.length === 0 && <option value="">No projects available</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Assign to
        <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          <option value="">Unassigned</option>
          {developers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>

      <label>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>

      {error && <p className="error-text">{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}
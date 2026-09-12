import { Task, TaskStatus } from "../types";
import { StatusBadge, PriorityBadge } from "./Badge";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: TaskStatus) => void }) {
  return (
    <div className={`task-card pri-${task.priority.toLowerCase()}`}>
      <div className="task-top">
        <span className="task-title">{task.title}</span>
        {task.isOverdue && <StatusBadge status="OVERDUE" />}
      </div>
      <div className="task-meta">
        {task.project?.name && <span>{task.project.name}</span>}
        {task.assignedTo?.name && <span>{task.assignedTo.name}</span>}
        {task.dueDate && <span className="mono">due {new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <PriorityBadge priority={task.priority} />
        <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
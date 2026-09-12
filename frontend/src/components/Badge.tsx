const STATUS_META: Record<string, { label: string; color: string }> = {
  TODO: { label: "To Do", color: "var(--status-todo)" },
  IN_PROGRESS: { label: "In Progress", color: "var(--status-progress)" },
  IN_REVIEW: { label: "In Review", color: "var(--status-review)" },
  DONE: { label: "Done", color: "var(--status-done)" },
  OVERDUE: { label: "Overdue", color: "var(--status-overdue)" },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW: { label: "Low", color: "var(--pri-low)" },
  MEDIUM: { label: "Medium", color: "var(--pri-medium)" },
  HIGH: { label: "High", color: "var(--pri-high)" },
  CRITICAL: { label: "Critical", color: "var(--pri-critical)" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "var(--text-muted)" };
  return (
    <span className="badge" style={{ color: meta.color, borderColor: meta.color + "55", background: meta.color + "14" }}>
      <span className="badge-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, color: "var(--text-muted)" };
  return (
    <span className="badge" style={{ color: meta.color, borderColor: meta.color + "55", background: meta.color + "14" }}>
      {meta.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const label = role === "PM" ? "Project Manager" : role.charAt(0) + role.slice(1).toLowerCase();
  return <span className="badge badge-role">{label}</span>;
}
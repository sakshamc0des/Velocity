import { useParams } from "react-router-dom";
import { useState } from "react";
import { TaskList } from "../components/TaskList";
import { ActivityFeed } from "../components/ActivityFeed";
import { Modal } from "../components/Modal";
import { NewTaskForm } from "../components/NewTaskForm";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [showNewTask, setShowNewTask] = useState(false);
  if (!id) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2>Project Tasks</h2>
          <button className="primary" onClick={() => setShowNewTask(true)}>
            + New Task
          </button>
        </div>
        <TaskList projectId={id} />
      </div>
      <ActivityFeed projectId={id} />

      {showNewTask && (
        <Modal title="New Task" onClose={() => setShowNewTask(false)}>
          <NewTaskForm
            projectId={id}
            onCreated={() => setShowNewTask(false)}
          />
        </Modal>
      )}
    </div>
  );
}
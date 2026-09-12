export type Role = "ADMIN" | "PM" | "DEVELOPER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  createdAt: string;
  _count?: { projects: number };
}

export interface Developer {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  clientId: string;
  client?: Client;
  createdById: string;
  createdAt: string;
  _count?: { tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  projectId: string;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string } | null;
  project?: { id: string; name: string };
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface ActivityEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  userName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Client } from "../types";
import { useAuth } from "../context/AuthContext";

export function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/clients").then((res) => {
      setClients(res.data.clients);
      if (res.data.clients.length > 0) setClientId(res.data.clients[0].id);
    });
  }, []);

  async function handleCreateClient() {
    if (!newClientName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/clients", { name: newClientName.trim() });
      const client = res.data.client;
      setClients((prev) => [...prev, client]);
      setClientId(client.id);
      setNewClientName("");
      setShowNewClient(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create client");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      setError("Project name and client are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/projects", {
        name: name.trim(),
        description: description.trim() || undefined,
        clientId,
      });
      setName("");
      setDescription("");
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <label>
        Project name *
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile App Redesign" required />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this project about?" />
      </label>

      <label>
        Client *
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          {clients.length === 0 && <option value="">No clients available</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {user?.role === "ADMIN" && (
        <div className="inline-add">
          {!showNewClient ? (
            <button type="button" onClick={() => setShowNewClient(true)}>
              + New client
            </button>
          ) : (
            <div className="inline-add-row">
              <input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name"
              />
              <button type="button" onClick={handleCreateClient} disabled={saving || !newClientName.trim()}>
                Add
              </button>
              <button type="button" onClick={() => setShowNewClient(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="modal-actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
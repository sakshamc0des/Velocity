import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { NotificationItem } from "../types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    api.get("/notifications").then((res) => {
      setItems(res.data.notifications);
      setUnread(res.data.unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNotification(n: NotificationItem) {
      setItems((prev) => [n, ...prev].slice(0, 50));
    }
    function onUnreadCount({ count }: { count: number }) {
      setUnread(count); // pushed over the socket, not polled
    }
    socket.on("notification", onNotification);
    socket.on("unread_count", onUnreadCount);
    return () => {
      socket.off("notification", onNotification);
      socket.off("unread_count", onUnreadCount);
    };
  }, [socket]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "crimson",
              color: "white",
              borderRadius: "50%",
              fontSize: 11,
              padding: "1px 6px",
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: "#1c1c1c",
            border: "1px solid #333",
            borderRadius: 8,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #333" }}>
            <strong>Notifications</strong>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {items.length === 0 && <p style={{ padding: 8, opacity: 0.6 }}>No notifications.</p>}
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                padding: 8,
                borderBottom: "1px solid #2a2a2a",
                opacity: n.read ? 0.5 : 1,
                cursor: "pointer",
              }}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

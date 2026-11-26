import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Bell, CheckCheck, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import "./NotificationCenter.css";

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    let active = true;
    setLoading(true);
    api.get("/notifications")
      .then(({ data }) => {
        if (!active) return;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch((error) => console.error("Unable to load notifications:", error))
      .finally(() => active && setLoading(false));

    const token = localStorage.getItem("campuscare_token");
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, { auth: { token }, reconnection: true });

    socket.on("notification:new", (notification) => {
      if (!active) return;
      setNotifications((current) => [notification, ...current.filter((item) => item._id !== notification._id)].slice(0, 50));
      setUnreadCount((count) => count + 1);
    });

    socket.on("connect_error", (error) => {
      console.warn("Realtime notifications connection failed:", error.message);
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [user?.id, user?._id]);

  const markRead = async (notification) => {
    if (!notification.readAt) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications((current) => current.map((item) =>
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        ));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        console.error("Unable to mark notification as read:", error);
      }
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    }
  };

  if (!user) return null;

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={21} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-popover" aria-label="Notifications">
          <header className="notification-popover-header">
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            <div className="notification-header-actions">
              {unreadCount > 0 && <button type="button" title="Mark all as read" onClick={markAllRead}><CheckCheck size={17} /></button>}
              <button type="button" title="Close notifications" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
          </header>
          <div className="notification-list">
            {loading ? <p className="notification-empty">Loading notifications…</p> : notifications.length === 0 ? (
              <p className="notification-empty">You're all caught up. New updates will appear here.</p>
            ) : notifications.map((item) => (
              <button
                type="button"
                className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`}
                key={item._id}
                onClick={() => markRead(item)}
              >
                <span className="notification-unread-dot" />
                <span className="notification-item-content">
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

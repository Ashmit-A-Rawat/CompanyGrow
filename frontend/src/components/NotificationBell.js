import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { connectSocket, disconnectSocket } from '../services/socket';

const NOTIFICATION_EVENTS = ['badge:approved', 'project:assigned', 'project:completed', 'course:completed'];

const timeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleNotification = (payload) => {
      setNotifications((prev) => [
        { id: `${Date.now()}-${Math.random()}`, message: payload.message, timestamp: Date.now(), read: false },
        ...prev
      ].slice(0, 20));
    };

    NOTIFICATION_EVENTS.forEach((event) => socket.on(event, handleNotification));

    return () => {
      NOTIFICATION_EVENTS.forEach((event) => socket.off(event, handleNotification));
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setNotifications((current) => current.map((n) => ({ ...n, read: true })));
      return next;
    });
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <button style={styles.bellButton} onClick={toggleOpen} type="button">
        <Bell size={18} />
        {unreadCount > 0 && <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={styles.emptyState}>No notifications yet</div>
          ) : (
            <div style={styles.list}>
              {notifications.map((n) => (
                <div key={n.id} style={styles.item}>
                  <div style={styles.itemMessage}>{n.message}</div>
                  <div style={styles.itemTime}>{timeAgo(n.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative'
  },
  bellButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6b7280',
    cursor: 'pointer'
  },
  badge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    borderRadius: '8px',
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '10px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdown: {
    position: 'absolute',
    top: '44px',
    right: 0,
    width: '320px',
    maxHeight: '400px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    zIndex: 1100
  },
  dropdownHeader: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    borderBottom: '1px solid #e5e7eb'
  },
  emptyState: {
    padding: '24px 16px',
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center'
  },
  list: {
    maxHeight: '340px',
    overflowY: 'auto'
  },
  item: {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6'
  },
  itemMessage: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: '1.4'
  },
  itemTime: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '4px'
  }
};

export default NotificationBell;

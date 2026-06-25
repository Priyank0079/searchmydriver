import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import useNotificationStore from '../../store/useNotificationStore';
import { formatTimeAgo } from '../../utils/datetime';

const ICONS = {
  info: <Info className="w-5 h-5 text-blue-500" />,
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  error: <XCircle className="w-5 h-5 text-rose-500" />,
};

const BG_COLORS = {
  info: 'bg-blue-50/50',
  success: 'bg-emerald-50/50',
  warning: 'bg-amber-50/50',
  error: 'bg-rose-50/50',
};

export default function NotificationBell({ prefix = '/auth' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  const {
    notifications,
    unreadCount,
    isInitialized,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    if (!isInitialized) {
      fetchNotifications(prefix);
    }
  }, [isInitialized, fetchNotifications, prefix]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
      >
        <Bell className="w-6 h-6 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-rose-500 rounded-full border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  markAllAsRead(prefix);
                }}
                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => {
                      if (!n.isRead) markAsRead(n._id, prefix);
                    }}
                    className={`w-full text-left p-4 transition-colors hover:bg-slate-50 flex items-start gap-3 ${
                      n.isRead ? 'opacity-70' : BG_COLORS[n.severity] || BG_COLORS.info
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {ICONS[n.severity] || ICONS.info}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.isRead ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className={`text-xs mt-1 ${n.isRead ? 'text-slate-500' : 'text-slate-600'}`}>
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-2">
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

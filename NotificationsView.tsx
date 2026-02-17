
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Package, ChevronRight, Loader2 } from 'lucide-react';
import { notificationsService, UserNotification } from './services/notificationsService';
import { AppView } from './types';

interface NotificationsViewProps {
  userId: string;
  theme: 'light' | 'dark';
  setView: (view: AppView) => void;
  onSelectDeal: (campaignId: string) => void;
  onUnreadCountChange: (count: number) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  userId,
  theme,
  setView,
  onSelectDeal,
  onUnreadCountChange,
}) => {
  const isDark = theme === 'dark';
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const data = await notificationsService.getUnreadNotifications(userId);
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  // Mark all as read when screen opens
  const markAllRead = useCallback(async () => {
    await notificationsService.markAllRead(userId);
    onUnreadCountChange(0);
  }, [userId, onUnreadCountChange]);

  useEffect(() => {
    const init = async () => {
      await fetchNotifications(); // fetch first so user sees the notifications
      await markAllRead();        // then mark as read
    };
    init();
  }, [fetchNotifications, markAllRead]);

  const handleNotificationTap = (notification: Notification) => {
    if (notification.campaign_id) {
      onSelectDeal(notification.campaign_id);
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="px-6 pt-2 pb-32 animate-reveal">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Notifications
          </h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {notifications.length} unread
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <Bell className="w-6 h-6 text-yellow-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center">
            <Bell className="w-10 h-10 text-slate-600" />
          </div>
          <p className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No notifications yet
          </p>
          <p className={`text-xs text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            New deals in your area will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleNotificationTap(notif)}
              className={`w-full text-left glass rounded-3xl p-4 flex items-start gap-4 active:scale-[0.98] transition-all border ${
                notif.is_read
                  ? 'border-white/5 opacity-70'
                  : 'border-yellow-500/20 bg-yellow-500/5'
              }`}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                notif.is_read ? 'bg-slate-800/60' : 'bg-yellow-500/15'
              }`}>
                {notif.image_url ? (
                  <img
                    src={notif.image_url}
                    alt=""
                    className="w-full h-full object-cover rounded-2xl"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Package className={`w-6 h-6 ${notif.is_read ? 'text-slate-500' : 'text-yellow-500'}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {notif.title}
                  </p>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0 mt-1" />
                  )}
                </div>
                <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {notif.body}
                </p>
                <p className={`text-[10px] mt-2 font-black uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {formatTime(notif.created_at)}
                </p>
              </div>

              {notif.campaign_id && (
                <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              )}
            </button>
          ))}

          {/* All caught up message */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-center gap-2 pt-4 pb-2">
              <CheckCheck className="w-4 h-4 text-slate-600" />
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                All caught up
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * SmartNotifications.tsx
 * Displays intelligent, actionable notifications for merchants
 * based on product performance, analytics, and trends
 */

import React, { useState, useEffect } from 'react';
import { User } from './types';
import {
  Bell,
  TrendingUp,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  Loader2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { notificationInsightsService, SmartNotification } from './services/notificationInsightsService';

interface SmartNotificationsProps {
  user: User;
  theme: 'light' | 'dark';
  onNavigate?: (route: string) => void;
}

export const SmartNotifications: React.FC<SmartNotificationsProps> = ({
  user,
  theme,
  onNavigate,
}) => {
  const isDark = theme === 'dark';
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const smartNotifications = await notificationInsightsService.getAllSmartNotifications(user.id);
      setNotifications(smartNotifications);
    } catch (error) {
      console.error('[SmartNotifications] Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (notificationId: string) => {
    setDismissedIds(prev => new Set([...prev, notificationId]));
  };

  const handleAction = (notification: SmartNotification) => {
    if (notification.actionRoute && onNavigate) {
      onNavigate(notification.actionRoute);
    }
  };

  const getTypeStyles = (type: SmartNotification['type']) => {
    switch (type) {
      case 'success':
        return {
          iconBg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
          iconColor: 'text-emerald-500',
          titleColor: isDark ? 'text-emerald-400' : 'text-emerald-600',
          actionBg: isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
          Icon: TrendingUp,
        };
      case 'warning':
        return {
          iconBg: isDark ? 'bg-orange-500/10' : 'bg-orange-50',
          iconColor: 'text-orange-500',
          titleColor: isDark ? 'text-orange-400' : 'text-orange-600',
          actionBg: isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600',
          Icon: AlertCircle,
        };
      case 'urgent':
        return {
          iconBg: isDark ? 'bg-red-500/10' : 'bg-red-50',
          iconColor: 'text-red-500',
          titleColor: isDark ? 'text-red-400' : 'text-red-600',
          actionBg: isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600',
          Icon: AlertTriangle,
        };
      case 'info':
      default:
        return {
          iconBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
          iconColor: 'text-blue-500',
          titleColor: isDark ? 'text-blue-400' : 'text-blue-600',
          actionBg: isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
          Icon: Info,
        };
    }
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));

  if (loading) {
    return (
      <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading notifications...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
            <Bell className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Smart Alerts</h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI-powered insights</p>
          </div>
        </div>
      </div>

      {/* Notifications Count */}
      <div className={`rounded-xl p-4 border mb-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <Bell className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{visibleNotifications.length} Active Alerts</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {visibleNotifications.filter(n => n.priority >= 4).length} High Priority
              </p>
            </div>
          </div>
          <button
            onClick={fetchNotifications}
            className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {visibleNotifications.length > 0 ? (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => {
            const styles = getTypeStyles(notification.type);
            const Icon = styles.Icon;

            return (
              <div
                key={notification.id}
                className={`rounded-xl p-4 border transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg ${styles.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${styles.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-semibold ${styles.titleColor}`}>
                        {notification.title}
                      </h4>
                      {/* Priority dot */}
                      {notification.priority >= 4 && (
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5"></div>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between mt-3">
                      {/* Action Button */}
                      {notification.actionText && notification.actionRoute ? (
                        <button
                          onClick={() => handleAction(notification)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 active:scale-[0.97] transition-all ${styles.actionBg}`}
                        >
                          {notification.actionText}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ) : <div />}

                      {/* Timestamp */}
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {notification.timestamp.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Dismiss Button */}
                  <button
                    onClick={() => handleDismiss(notification.id)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`rounded-xl p-10 border text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Bell className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>All Caught Up!</h3>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No new alerts right now. We'll notify you when there's something important.
          </p>
        </div>
      )}

      {/* Info Footer */}
      <div className={`mt-6 rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <Info className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>About Smart Alerts</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              We analyze your product performance, customer engagement, and market trends to bring you
              timely, actionable insights that help grow your business.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

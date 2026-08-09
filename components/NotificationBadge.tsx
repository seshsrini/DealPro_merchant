/**
 * NotificationBadge.tsx
 * Compact notification indicator with count badge
 * Shows smart notification count and can be clicked to view details
 */

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationInsightsService, notificationReadState, SmartNotification } from '../services/notificationInsightsService';

interface NotificationBadgeProps {
  merchantId: string;
  onClick?: () => void;
  theme?: 'light' | 'dark';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  merchantId,
  onClick,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (merchantId) {
      fetchNotifications();
    }
  }, [merchantId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const smartNotifications = await notificationInsightsService.getAllSmartNotifications(merchantId);
      // Forget read-ids for alerts that no longer exist (so a recurring one re-badges).
      notificationReadState.prune(merchantId, smartNotifications.map((n) => n.id));
      setNotifications(smartNotifications);
    } catch (error) {
      console.error('[NotificationBadge] Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Only count alerts the merchant hasn't already seen (opening the panel marks
  // them read), so the badge clears and stays clear instead of sticking at N.
  const totalCount = notificationReadState.unreadCount(merchantId, notifications);

  return (
    <button
      onClick={onClick}
      className="relative"
      aria-label={`${totalCount} notification${totalCount !== 1 ? 's' : ''}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${
        isDark ? 'bg-slate-800' : 'bg-slate-100'
      }`}>
        <Bell className={`w-5 h-5 ${
          totalCount > 0
            ? 'text-yellow-500'
            : isDark ? 'text-slate-400' : 'text-slate-500'
        }`} />
      </div>

      {/* Count Badge */}
      {totalCount > 0 && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 flex items-center justify-center">
          <span className="text-[10px] font-semibold text-white">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        </div>
      )}
    </button>
  );
};

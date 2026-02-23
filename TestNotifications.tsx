/**
 * TEMPORARY TEST COMPONENT
 * Test the Smart Notifications Edge Function
 * Delete this file after testing
 */

import React, { useState } from 'react';
import { User } from './types';
import { notificationInsightsService, SmartNotification } from './services/notificationInsightsService';
import { Loader2 } from 'lucide-react';

interface TestNotificationsProps {
  user: User;
}

export const TestNotifications: React.FC<TestNotificationsProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[TEST] Fetching notifications for merchant:', user.id);
      const result = await notificationInsightsService.getAllSmartNotifications(user.id);
      console.log('[TEST] Notifications received:', result);
      setNotifications(result);
    } catch (err: any) {
      console.error('[TEST] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">
          Test Smart Notifications Edge Function
        </h1>

        <div className="bg-slate-800 p-4 rounded-lg mb-4">
          <p className="text-sm text-slate-400 mb-2">Merchant ID:</p>
          <p className="text-white font-mono">{user.id}</p>
        </div>

        <button
          onClick={handleTest}
          disabled={loading}
          className="px-6 py-3 bg-yellow-500 text-slate-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Testing...
            </>
          ) : (
            'Test Edge Function'
          )}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400 font-bold mb-2">Error:</p>
            <pre className="text-red-300 text-sm overflow-auto">{error}</pre>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Notifications ({notifications.length})
            </h2>

            <div className="space-y-3">
              {notifications.map((notification, idx) => (
                <div
                  key={notification.id}
                  className="bg-slate-800 p-4 rounded-lg border border-slate-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          notification.type === 'success' ? 'bg-emerald-900 text-emerald-400' :
                          notification.type === 'warning' ? 'bg-orange-900 text-orange-400' :
                          notification.type === 'urgent' ? 'bg-red-900 text-red-400' :
                          'bg-blue-900 text-blue-400'
                        }`}>
                          {notification.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          Priority: {notification.priority}
                        </span>
                      </div>

                      <h3 className="text-white font-bold mb-1">
                        {notification.title}
                      </h3>

                      <p className="text-slate-300 text-sm mb-2">
                        {notification.message}
                      </p>

                      {notification.actionText && (
                        <p className="text-xs text-slate-500">
                          Action: {notification.actionText} → {notification.actionRoute}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && notifications.length === 0 && !error && (
          <div className="mt-6 p-8 bg-slate-800 rounded-lg text-center">
            <p className="text-slate-400">
              Click the button to test the Edge Function
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

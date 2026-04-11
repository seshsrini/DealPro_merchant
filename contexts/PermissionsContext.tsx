import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { merchantStaffService } from '../services/merchantStaffService';

interface PermissionsContextType {
  role: string;
  permissions: string[];
  merchantId: string;
  loading: boolean;
  can: (permission: string) => boolean;
  reload: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ userId: string; children: ReactNode }> = ({ userId, children }) => {
  const [role, setRole] = useState<string>('owner');
  const [permissions, setPermissions] = useState<string[]>(['*']);
  const [merchantId, setMerchantId] = useState<string>(userId);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await merchantStaffService.getPermissions();
      setRole(data.role);
      setPermissions(data.permissions);
      setMerchantId(data.merchantId);
    } catch {
      // Fail open for owners — if permission check fails, assume owner
      setRole('owner');
      setPermissions(['*']);
      setMerchantId(userId);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const can = useCallback((permission: string): boolean => {
    if (role === 'owner' || permissions.includes('*')) return true;
    return permissions.includes(permission);
  }, [role, permissions]);

  return (
    <PermissionsContext.Provider value={{ role, permissions, merchantId, loading, can, reload }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Return a permissive default if not inside provider (owner/legacy)
    return {
      role: 'owner',
      permissions: ['*'],
      merchantId: '',
      loading: false,
      can: () => true,
      reload: async () => {},
    };
  }
  return ctx;
};

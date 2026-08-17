import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Users, UserPlus, Shield, ShieldCheck, ShieldAlert,
  Copy, Check, X, Loader2, ChevronDown, MoreVertical,
  Send, Clock, Ban, Trash2, Settings,
} from 'lucide-react';
import { AppView, User } from './types';
import { merchantStaffService, StaffMember, StaffInvite } from './services/merchantStaffService';
import { resilient } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
import { useTranslation } from './contexts/LanguageContext';

interface MerchantTeamProps {
  user: User;
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  owner: { label: 'Owner', color: 'text-amber-500', icon: ShieldCheck },
  manager: { label: 'Manager', color: 'text-blue-500', icon: Shield },
  staff: { label: 'Staff', color: 'text-slate-400', icon: ShieldAlert },
};

export const MerchantTeam: React.FC<MerchantTeamProps> = ({ user, setView, theme }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'manager'>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Staff action menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string>('owner');
  const [callerUserId, setCallerUserId] = useState<string>('');
  const isOwner = callerRole === 'owner';

  // Permissions editor
  const [showPermissions, setShowPermissions] = useState(false);
  const [rolePerms, setRolePerms] = useState<{ role: string; permission: string; allowed: boolean }[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permUpdating, setPermUpdating] = useState<string | null>(null);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<'manager' | 'staff'>('manager');

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Resilient: retries + last-good cache fallback so a resume-time blip
      // doesn't blank the team list or throw a spurious error.
      const data = await resilient(
        () => merchantStaffService.listStaff(),
        { cacheKey: `team_${user.id}` },
      );
      setStaff(data.staff);
      setInvites(data.invites);
      if (data.callerRole) setCallerRole(data.callerRole);
      if (data.callerUserId) setCallerUserId(data.callerUserId);
    } catch (err: any) {
      setError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadTeam(); }, [loadTeam]);
  useResumeRefetch(loadTeam);

  const handleInvite = async () => {
    if (!inviteName.trim()) return;
    setInviting(true);
    setInviteSuccess(null);
    try {
      const result = await merchantStaffService.inviteStaff({
        display_name: inviteName.trim(),
        phone: invitePhone.trim() || undefined,
        role: inviteRole,
      });
      setInviteSuccess(result.invite.invite_code);
      setInviteName('');
      setInvitePhone('');
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleShareWhatsApp = (code: string, name: string) => {
    const storeName = user.store_name || 'Sreshta Merchant';
    const msg = `Hi ${name}! You've been invited to join ${storeName} on Sreshta as a team member. Use this invite code to get started: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSuspend = async (staffId: string) => {
    try {
      await merchantStaffService.updateStaff(staffId, { status: 'suspended' });
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    }
    setActiveMenuId(null);
  };

  const handleReactivate = async (staffId: string) => {
    try {
      await merchantStaffService.updateStaff(staffId, { status: 'active' });
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    }
    setActiveMenuId(null);
  };

  const handleChangeRole = async (staffId: string, newRole: string) => {
    try {
      await merchantStaffService.updateStaff(staffId, { role: newRole });
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    }
    setActiveMenuId(null);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await merchantStaffService.revokeInvite(inviteId);
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeInviteRole = async (inviteId: string, newRole: 'manager' | 'staff') => {
    try {
      await merchantStaffService.updateInviteRole(inviteId, newRole);
      await loadTeam();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadPerms = useCallback(async () => {
    setPermsLoading(true);
    try {
      const data = await merchantStaffService.listRolePermissions();
      setRolePerms(data);
    } catch {}
    setPermsLoading(false);
  }, []);

  const handleTogglePerm = async (role: string, permission: string, currentAllowed: boolean) => {
    const key = `${role}:${permission}`;
    setPermUpdating(key);
    try {
      await merchantStaffService.updatePermission(role, permission, !currentAllowed);
      setRolePerms(prev => prev.map(p =>
        p.role === role && p.permission === permission ? { ...p, allowed: !currentAllowed } : p
      ));
    } catch (err: any) {
      setError(err.message);
    }
    setPermUpdating(null);
  };

  const handleTogglePermissions = () => {
    if (!showPermissions) loadPerms();
    setShowPermissions(!showPermissions);
  };

  const PERM_LABELS: Record<string, string> = {
    'campaign.create': 'Create Campaigns',
    'campaign.edit': 'Edit Campaigns',
    'campaign.delete': 'Delete Campaigns',
    'dotd.create': 'Create Deal of Day',
    'dotd.edit': 'Edit Deal of Day',
    'catalogue.manage': 'Manage Catalogue',
    'store.manage': 'Manage Stores',
    'analytics.view': 'View Analytics',
    'scan.verify': 'Scan & Verify',
    'subscription.manage': 'Manage Subscription',
    'staff.invite': 'Invite Staff',
    'staff.manage': 'Manage Staff',
    'billing.view': 'View Billing',
    'billing.manage': 'Manage Billing',
  };

  const activeStaff = staff.filter(s => s.status === 'active');
  const suspendedStaff = staff.filter(s => s.status === 'suspended');

  return (
    <div className={`min-h-screen px-5 pb-32 pt-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setView('profile')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-700'}`} />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_my_team')}</h1>
            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_staff')}</p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => { setShowInviteForm(true); setInviteSuccess(null); }}
            className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center active:scale-90 transition-all"
          >
            <UserPlus className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs flex-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-red-400" /></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className={`w-7 h-7 animate-spin ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </div>
      )}

      {/* Active Staff */}
      {!loading && (
        <div className="space-y-5">
          {/* Active members */}
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
              {t('m_active_members')} ({activeStaff.length})
            </p>
            <div className="space-y-2">
              {activeStaff.map(member => {
                const cfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.staff;
                const RoleIcon = cfg.icon;
                const isMe = member.user_id === callerUserId;
                const isMemberOwner = member.role === 'owner';
                return (
                  <div key={member.id} className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-slate-800/80' : 'bg-white shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <RoleIcon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {member.display_name}
                        {isMe && <span className={`ml-2 text-[10px] font-bold uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t('m_you')}</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          {cfg.label}
                        </span>
                        {member.phone && <span className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{member.phone}</span>}
                      </div>
                    </div>
                    {isOwner && !isMemberOwner && !isMe && (
                      <div className="flex items-center gap-2">
                        {/* Role dropdown — promote to Manager / demote to Staff */}
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value as 'manager' | 'staff')}
                          className={`text-[11px] font-semibold rounded-lg px-2 py-1.5 border outline-none cursor-pointer ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                        >
                          <option value="manager">{ROLE_CONFIG.manager.label}</option>
                          <option value="staff">{ROLE_CONFIG.staff.label}</option>
                        </select>
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                          >
                            <MoreVertical className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
                          </button>
                          {activeMenuId === member.id && (
                            <div className={`absolute right-0 top-9 w-44 rounded-xl shadow-lg border z-50 overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <button
                                onClick={() => handleSuspend(member.id)}
                                className="w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2 text-red-500 hover:bg-red-50"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                {t('m_suspend')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {t('m_pending_invites')} ({invites.length})
              </p>
              <div className="space-y-2">
                {invites.map(inv => (
                  <div key={inv.id} className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-slate-800/60 border border-dashed border-slate-700' : 'bg-white/60 border border-dashed border-slate-200'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                      <Clock className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{inv.display_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          {inv.invite_code}
                        </span>
                        {isOwner ? (
                          <select
                            value={inv.role}
                            onChange={(e) => handleChangeInviteRole(inv.id, e.target.value as 'manager' | 'staff')}
                            className={`text-[10px] font-semibold rounded-md px-1.5 py-0.5 border outline-none cursor-pointer ${isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                          >
                            <option value="manager">{ROLE_CONFIG.manager.label}</option>
                            <option value="staff">{ROLE_CONFIG.staff.label}</option>
                          </select>
                        ) : (
                          <span className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{inv.role}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCopyCode(inv.invite_code)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
                      >
                        {copiedCode === inv.invite_code
                          ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                          : <Copy className="w-3.5 h-3.5 text-slate-400" />
                        }
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(inv.invite_code, inv.display_name)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suspended Staff */}
          {suspendedStaff.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-red-400/60' : 'text-red-400'}`}>
                {t('m_suspended')} ({suspendedStaff.length})
              </p>
              <div className="space-y-2">
                {suspendedStaff.map(member => (
                  <div key={member.id} className={`p-4 rounded-xl flex items-center gap-3 opacity-60 ${isDark ? 'bg-slate-800/40' : 'bg-white/40'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                      <Ban className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{member.display_name}</p>
                      <span className={`text-[10px] ${isDark ? 'text-red-400' : 'text-red-500'}`}>{t('m_suspended')}</span>
                    </div>
                    <button
                      onClick={() => handleReactivate(member.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
                    >
                      {t('m_reactivate')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {isOwner && activeStaff.length <= 1 && invites.length === 0 && (
            <div className="text-center py-10">
              <Users className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_no_team')}</p>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_invite_hint')}</p>
            </div>
          )}
        </div>
      )}

      {/* Permissions Editor — owners only */}
      {isOwner && !loading && (
        <div className="mt-6">
          <button
            onClick={handleTogglePermissions}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isDark ? 'bg-slate-800/80' : 'bg-white shadow-sm'}`}
          >
            <div className="flex items-center gap-3">
              <Settings className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
              <div className="text-left">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_role_permissions')}</p>
                <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_customize_access')}</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''} ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
          </button>

          {showPermissions && (
            <div className={`mt-2 rounded-xl overflow-hidden border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
              {permsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : (
                <>
                  {/* Role selector dropdown */}
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                      Select Role
                    </label>
                    <select
                      value={selectedRoleForPerms}
                      onChange={(e) => setSelectedRoleForPerms(e.target.value as 'manager' | 'staff')}
                      className={`w-full h-10 px-3 rounded-lg text-sm font-semibold outline-none border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="manager">{t('m_role_manager')}</option>
                      <option value="staff">{t('m_role_staff')}</option>
                    </select>
                  </div>

                  {/* Permissions for selected role */}
                  <div className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
                    {rolePerms
                      .filter(p => p.role === selectedRoleForPerms)
                      .map(p => {
                        const key = `${p.role}:${p.permission}`;
                        const isUpdating = permUpdating === key;
                        return (
                          <div key={key} className="flex items-center justify-between px-4 py-3">
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {PERM_LABELS[p.permission] || p.permission}
                            </span>
                            <button
                              onClick={() => handleTogglePerm(p.role, p.permission, p.allowed)}
                              disabled={isUpdating}
                              className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                                p.allowed
                                  ? 'bg-emerald-500'
                                  : isDark ? 'bg-slate-600' : 'bg-slate-300'
                              }`}
                            >
                              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                p.allowed ? 'translate-x-5' : 'translate-x-0'
                              }`}>
                                {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-slate-400 m-1" />}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invite Staff Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center sm:items-center px-0 sm:px-8">
          <div className={`w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_invite_staff')}</h3>
              <button onClick={() => { setShowInviteForm(false); setInviteSuccess(null); }}>
                <X className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-7 h-7 text-emerald-500" />
                </div>
                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_invite_sent')}</p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <span className={`text-lg font-mono font-bold tracking-widest ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{inviteSuccess}</span>
                  <button onClick={() => handleCopyCode(inviteSuccess)}>
                    {copiedCode === inviteSuccess
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                </div>
                <p className={`text-xs mb-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_share_code_hint')}</p>
                <button
                  onClick={() => handleShareWhatsApp(inviteSuccess, inviteName || 'Team member')}
                  className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Send className="w-4 h-4" />
                  {t('m_send_whatsapp')}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder={t('m_staff_name_placeholder')}
                    maxLength={50}
                    className={`w-full h-12 px-4 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-slate-800 text-white border border-slate-700 focus:border-indigo-500' : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-indigo-500'}`}
                  />
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={e => setInvitePhone(e.target.value)}
                    placeholder={t('m_staff_phone_placeholder')}
                    maxLength={15}
                    className={`w-full h-12 px-4 rounded-xl text-sm font-medium outline-none ${isDark ? 'bg-slate-800 text-white border border-slate-700 focus:border-indigo-500' : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-indigo-500'}`}
                  />

                  {/* Role selector */}
                  <div className="flex gap-2">
                    {(['staff', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setInviteRole(r)}
                        className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-all ${
                          inviteRole === r
                            ? 'bg-indigo-600 text-white'
                            : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {r === 'staff' ? t('m_role_staff') : t('m_role_manager')}
                      </button>
                    ))}
                  </div>

                  {/* Role description */}
                  <p className={`text-[10px] px-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                    {inviteRole === 'staff' ? t('m_staff_desc') : t('m_manager_desc')}
                  </p>
                </div>

                <button
                  onClick={handleInvite}
                  disabled={!inviteName.trim() || inviting}
                  className="w-full h-12 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> {t('m_send_invite')}</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

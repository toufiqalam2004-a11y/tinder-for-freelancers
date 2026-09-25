import React, { useEffect, useState } from 'react';
import { Settings, Shield, CheckCircle2, AlertCircle, Database, Server, Lock, AlertTriangle, Trash2, RefreshCw, X } from 'lucide-react';
import { useAdmin } from './AdminContext';
import toast from 'react-hot-toast';

export default function AdminSettings({ onResetSuccess }) {
  const { apiFetch, adminUser } = useAdmin();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSummary, setResetSummary] = useState(null);

  // Delete All Users Danger Zone State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSecondConfirmStep, setIsSecondConfirmStep] = useState(false);
  const [isDeletingUsers, setIsDeletingUsers] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState(null);
  const [deleteSummary, setDeleteSummary] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/settings');
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDeleteAllUsers = async () => {
    setIsDeletingUsers(true);
    setDeleteAllError(null);
    try {
      const res = await apiFetch('/users/all', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmationPhrase: confirmationText,
          adminPassword,
        }),
      });

      if (res.success) {
        const count = res.deletedUsers || 0;
        toast.success(`All user accounts have been deleted. ${count} user accounts deleted.`);
        setDeleteSummary(res);
        setShowDeleteAllModal(false);
        setConfirmationText('');
        setAdminPassword('');
        setIsSecondConfirmStep(false);
        fetchSettings();
        if (onResetSuccess) {
          onResetSuccess();
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tf_admin_reset_complete'));
          window.dispatchEvent(new CustomEvent('tf_admin_users_deleted', { detail: { count } }));
        }
      } else {
        setDeleteAllError(res.error || 'Failed to delete users.');
        setAdminPassword('');
      }
    } catch (err) {
      setDeleteAllError(err.message || 'An error occurred while deleting users.');
      setAdminPassword('');
    } finally {
      setIsDeletingUsers(false);
    }
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      const res = await apiFetch('/reset-app-data', {
        method: 'POST',
      });
      if (res.success) {
        toast.success('Test and demo data reset successfully.');
        setResetSummary(res.reset);
        setShowResetModal(false);
        fetchSettings();
        if (onResetSuccess) {
          onResetSuccess();
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tf_admin_reset_complete'));
        }
      } else {
        setResetError(res.error || 'Failed to reset app data.');
      }
    } catch (err) {
      setResetError(err.message || 'An error occurred while resetting app data.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const services = settings?.services || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Admin System Settings</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Safe platform configuration status, environment diagnostic health, and provider telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Admin Operator Session */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
            <Shield size={18} className="text-rose-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Administrator Profile
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
              <span className="text-neutral-400">Authenticated Role</span>
              <span className="font-bold text-rose-400 uppercase tracking-wider">
                {adminUser?.role || 'admin'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
              <span className="text-neutral-400">Operator Name</span>
              <span className="font-semibold text-white">{adminUser?.name || 'Administrator'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
              <span className="text-neutral-400">Session Status</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 size={12} /> Active & Authenticated
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-400">Security Isolation</span>
              <span className="text-neutral-300">Server-Side Bearer Guard</span>
            </div>
          </div>
        </div>

        {/* 2. Platform Environment */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
            <Server size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Platform Environment
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
              <span className="text-neutral-400">Platform Build</span>
              <span className="font-semibold text-white">
                {settings?.platform?.name || 'Tinder for Freelancers Admin'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
              <span className="text-neutral-400">Environment</span>
              <span className="font-mono text-neutral-200">
                {settings?.platform?.environment || 'development'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-400">Database Engine</span>
              <span className="font-semibold text-white flex items-center gap-1">
                <Database size={12} className="text-rose-400" />
                <span>{settings?.platform?.database || 'JSON Storage'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Provider Configuration Status (Safe: Never Leaking Secret Values) */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Lock size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Integration & Provider Security Status
            </h2>
          </div>
          <span className="text-[11px] text-neutral-500">Zero Secrets Exposed</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {[
            { label: 'Reddit API Ingestion', val: services.redditDiscovery },
            { label: 'YouTube Jobs Scraper', val: services.youtubeDiscovery },
            { label: 'X (Twitter) Feed API', val: services.xDiscovery },
            { label: 'AI Proposal Synthesizer', val: services.aiProposalEngine },
            { label: 'Client Email Outreach', val: services.emailOutreach },
            { label: 'WhatsApp Outreach Gateway', val: services.whatsappOutreach },
          ].map((item, i) => {
            const isConfigured = item.val === 'Configured';
            return (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between text-xs"
              >
                <span className="text-neutral-300 font-medium">{item.label}</span>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase">
                    <CheckCircle2 size={12} /> Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-neutral-500 font-bold text-[10px] uppercase">
                    <AlertCircle size={12} /> Not Configured
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Danger Zone */}
      <div className="bg-[#1C1A1A] border border-rose-900/40 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-rose-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400">
              Danger Zone
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-rose-400/80 bg-rose-950/40 border border-rose-800/40 px-2.5 py-0.5 rounded-full">
            Admin Only
          </span>
        </div>

        {/* Action 1: Delete All Users (Permanent Complete User Account & Data Purge) */}
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 size={15} className="text-rose-400" />
              <span>Delete All Users</span>
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Permanent action. This will delete all user accounts and their associated user data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteAllError(null);
              setConfirmationText('');
              setAdminPassword('');
              setIsSecondConfirmStep(false);
              setShowDeleteAllModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2 shrink-0 border border-rose-500/40 hover:scale-[1.02]"
          >
            <Trash2 size={14} />
            <span>Delete All Users</span>
          </button>
        </div>

        {deleteSummary && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-white">
              <CheckCircle2 size={14} className="text-rose-400" /> All user accounts have been deleted.
            </p>
            <p className="text-neutral-300 text-[11px]">
              {deleteSummary.deletedUsers} user account{deleteSummary.deletedUsers === 1 ? '' : 's'} deleted. Admin dashboard and built-in sources remain active.
            </p>
          </div>
        )}

        {/* Action 2: Reset App Data (Safe Test & Demo Fixtures Purge) */}
        <div className="pt-2 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h3 className="text-sm font-semibold text-white">Reset App Data</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Safely removes test and demo fixtures (test jobs, test applications, and synthetic telemetry) while strictly preserving real registered users, admin accounts, and production data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 text-xs font-semibold transition-all flex items-center gap-2 shrink-0 border border-neutral-700"
          >
            <RefreshCw size={14} />
            <span>Reset App Data</span>
          </button>
        </div>

        {resetSummary && (
          <div className="mt-3 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 size={13} /> App data reset successfully completed.
            </p>
            <p className="text-neutral-300 text-[11px]">
              Purged: {resetSummary.users} test users, {resetSummary.applications} test applications, {resetSummary.jobs} test opportunities, {resetSummary.sources} test sources. Real accounts and canonical data were untouched.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181616] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#FAF7F2]">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reset App Data?</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    This will remove explicitly selected test/demo data from the application. Real registered user and admin accounts will not be deleted.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isResetting && setShowResetModal(false)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors"
                disabled={isResetting}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope details: Protected vs Will Reset */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <CheckCircle2 size={13} /> Protected
                </span>
                <ul className="space-y-1.5 text-neutral-300 text-[11px]">
                  <li className="flex items-center gap-1.5">✓ Real users</li>
                  <li className="flex items-center gap-1.5">✓ Admin accounts</li>
                  <li className="flex items-center gap-1.5">✓ Real applications</li>
                  <li className="flex items-center gap-1.5">✓ Real subscriptions</li>
                  <li className="flex items-center gap-1.5">✓ Real purchased credits</li>
                  <li className="flex items-center gap-1.5">✓ Built-in & real sources</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 space-y-2">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Trash2 size={13} /> Will Reset
                </span>
                <ul className="space-y-1.5 text-neutral-300 text-[11px]">
                  <li className="flex items-center gap-1.5">• Test/demo jobs</li>
                  <li className="flex items-center gap-1.5">• Test/demo applications</li>
                  <li className="flex items-center gap-1.5">• Test/demo activity</li>
                  <li className="flex items-center gap-1.5">• Test/demo fixtures</li>
                </ul>
              </div>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400 text-xs font-medium">
                {resetError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-lg shadow-rose-900/40 flex items-center gap-2 disabled:opacity-60"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Reset App Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Users Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181616] border border-rose-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#FAF7F2]">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete all users?</h3>
                  <p className="text-xs text-rose-400 font-medium mt-0.5">
                    This action permanently deletes all user accounts and associated user data. This cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingUsers) {
                    setShowDeleteAllModal(false);
                    setAdminPassword('');
                    setConfirmationText('');
                    setIsSecondConfirmStep(false);
                  }
                }}
                className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors"
                disabled={isDeletingUsers}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Confirmation phrase & Admin Password */}
            {!isSecondConfirmStep ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs text-neutral-300 space-y-2">
                  <p className="font-semibold text-rose-300">
                    This will permanently delete:
                  </p>
                  <ul className="grid grid-cols-2 gap-1 text-[11px] text-neutral-400">
                    <li>• All registered users</li>
                    <li>• Candidate profiles</li>
                    <li>• User applications</li>
                    <li>• User subscriptions</li>
                    <li>• User quotas & rewards</li>
                    <li>• User sessions & devices</li>
                  </ul>
                  <p className="text-[11px] text-neutral-400 pt-1 border-t border-rose-900/30">
                    Admin accounts, settings, and built-in platform sources will remain safe.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300">
                    To confirm, please type <span className="font-mono text-rose-400 font-bold select-all">DELETE ALL USERS</span>:
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => {
                      setConfirmationText(e.target.value);
                      if (deleteAllError) setDeleteAllError(null);
                    }}
                    placeholder="DELETE ALL USERS"
                    disabled={isDeletingUsers}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-600 font-mono text-xs focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Admin Password / Secret:
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (deleteAllError) setDeleteAllError(null);
                    }}
                    placeholder="Enter admin password"
                    disabled={isDeletingUsers}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-600 text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            ) : (
              /* Step 2: Final Second Confirmation */
              <div className="space-y-3 py-2">
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-center space-y-2">
                  <AlertTriangle size={28} className="text-rose-500 mx-auto" />
                  <h4 className="text-base font-bold text-white">Are you absolutely sure?</h4>
                  <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
                    This action is permanent and completely irreversible. All user accounts and their associated records will be purged immediately.
                  </p>
                </div>
              </div>
            )}

            {deleteAllError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-400 text-xs font-medium">
                {deleteAllError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={() => {
                  if (isSecondConfirmStep) {
                    setIsSecondConfirmStep(false);
                  } else {
                    setShowDeleteAllModal(false);
                    setAdminPassword('');
                    setConfirmationText('');
                  }
                }}
                disabled={isDeletingUsers}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSecondConfirmStep ? 'Back' : 'Cancel'}
              </button>

              {!isSecondConfirmStep ? (
                <button
                  type="button"
                  onClick={() => setIsSecondConfirmStep(true)}
                  disabled={confirmationText !== 'DELETE ALL USERS' || !adminPassword.trim() || isDeletingUsers}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={13} />
                  <span>Delete All Users</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteDeleteAllUsers}
                  disabled={isDeletingUsers}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2 disabled:opacity-60"
                >
                  {isDeletingUsers ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting users...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Yes, Delete All Users Permanently</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

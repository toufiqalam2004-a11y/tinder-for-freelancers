import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  User,
  Crown,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  X,
  ExternalLink,
  Shield,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminUsers() {
  const { apiFetch } = useAdmin();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (planFilter !== 'all') params.append('plan', planFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const data = await apiFetch(`/users?${params.toString()}`);
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [planFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleOpenUserDetail = async (user) => {
    setDetailLoading(true);
    setSelectedUser(null);
    try {
      const data = await apiFetch(`/users/${user.id}`);
      if (data.success && data.user) {
        setSelectedUser(data.user);
      }
    } catch (e) {
      console.error('Failed to load user detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const [banConfirm, setBanConfirm] = useState(null);

  const handleBanAction = async () => {
    if (!banConfirm) return;
    try {
      const { type, userId } = banConfirm;
      const data = await apiFetch(`/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ banType: type }),
      });
      if (data.success) {
        setBanConfirm(null);
        setSelectedUser((prev) => prev ? { ...prev, status: data.user.status, banType: data.user.banType, banUntil: data.user.banUntil } : prev);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to ban user');
      }
    } catch (e) {
      console.error('Failed to ban user:', e);
      alert('Error banning user');
    }
  };

  const handleUnbanUser = async (userId) => {
    if (!window.confirm('Are you sure you want to unban this user?')) return;
    try {
      const data = await apiFetch(`/users/${userId}/unban`, { method: 'POST' });
      if (data.success) {
        setSelectedUser((prev) => prev ? { ...prev, status: data.user.status, banType: null, banUntil: null } : prev);
        fetchUsers();
      } else {
        alert(data.error || 'Failed to unban user');
      }
    } catch (e) {
      console.error('Failed to unban user:', e);
      alert('Error unbanning user');
    }
  };

  const getPlanBadge = (plan) => {
    const p = (plan || 'free').toLowerCase();
    if (p === 'pro') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
          <Zap size={11} /> Pro
        </span>
      );
    }
    if (p === 'plus') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
          <Crown size={11} /> Plus
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[10px] font-semibold uppercase tracking-wider">
        Free
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">User Management</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Browse registered candidate accounts, active subscription tiers, and quota utilization.
          </p>
        </div>

        <div className="text-xs text-neutral-400">
          Showing <span className="text-white font-bold">{users.length}</span> user{users.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-[#1C1A1A] border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, craft..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors placeholder:text-neutral-500"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Plan Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="hidden md:inline font-medium">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="plus">Plus</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="hidden md:inline font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Phone</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Applications</th>
                <th className="px-4 py-3.5">Sources</th>
                <th className="px-4 py-3.5">Device</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                      <span>Loading user directory...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => handleOpenUserDetail(u)}
                    className="hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-rose-400 font-bold text-[11px] flex-shrink-0">
                          {u.name ? u.name.charAt(0).toUpperCase() : <User size={13} />}
                        </div>
                        <div className="flex flex-col truncate max-w-[160px]">
                          <span className="font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                            {u.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 truncate">{u.profession}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-neutral-300 whitespace-nowrap">
                      {u.phone || '—'}
                    </td>
                    <td className="px-4 py-3.5">{getPlanBadge(u.plan)}</td>
                    <td className="px-4 py-3.5 font-semibold text-neutral-200">
                      {u.applicationsCount}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400">{u.sourcesCount} custom</td>
                    <td className="px-4 py-3.5 text-neutral-400 flex items-center gap-1 pt-4">
                      <Smartphone size={12} className="text-neutral-500" />
                      <span className="truncate max-w-[90px]">{u.device}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {u.status === 'cancelled' || u.status === 'inactive' ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold capitalize">
                          <XCircle size={12} /> {u.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold capitalize">
                          <CheckCircle2 size={12} /> {u.status || 'active'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-semibold transition-colors">
                        Inspect <ChevronRight size={12} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal / Slide-Out */}
      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1A1A] border border-neutral-700 w-full max-w-2xl max-h-[90vh] rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-hidden relative">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute right-5 top-5 p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              aria-label="Close user modal"
            >
              <X size={17} />
            </button>

            {detailLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <div className="w-6 h-6 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                <span>Loading complete user record...</span>
              </div>
            ) : selectedUser ? (
              <div className="overflow-y-auto space-y-6 pr-1 no-scrollbar">
                {/* Header */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-800">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : <User size={20} />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedUser.name}</h2>
                    <p className="text-xs text-neutral-400">
                      {selectedUser.profile?.profession || 'Freelancer'} • {selectedUser.phone}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                      USERNAME: {selectedUser.username ? `@${selectedUser.username}` : 'No username set'}
                    </p>
                  </div>
                </div>

                {/* Section: USER ACCESS */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3">
                    User Access
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Status</span>
                      {selectedUser.status === 'banned' ? (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                            <Shield size={11} /> Banned ({selectedUser.banType})
                          </span>
                          {selectedUser.banUntil && (
                            <div className="text-[10px] text-neutral-500 mt-1">
                              Until: {new Date(selectedUser.banUntil).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedUser.status === 'banned' ? (
                        <button
                          onClick={() => handleUnbanUser(selectedUser.id)}
                          className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold border border-neutral-700 transition-colors"
                        >
                          Unban User
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setBanConfirm({ type: 'temporary', userId: selectedUser.id })}
                            className="px-4 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-bold border border-orange-500/20 transition-colors"
                          >
                            Ban for 7 Days
                          </button>
                          <button
                            onClick={() => setBanConfirm({ type: 'permanent', userId: selectedUser.id })}
                            className="px-4 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold border border-rose-500/20 transition-colors"
                          >
                            Permanent Ban
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 1: Profile & Skills */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3">
                    Craft & Profile
                  </h3>
                  {selectedUser.profile ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Category</span>
                          <span className="text-neutral-200 font-semibold">
                            {selectedUser.profile.category || 'General'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Experience</span>
                          <span className="text-neutral-200 font-semibold">
                            {selectedUser.profile.experience || 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Target Rates</span>
                          <span className="text-neutral-200 font-semibold">
                            {selectedUser.profile.targetRates || 'Open / Negotiable'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Availability</span>
                          <span className="text-neutral-200 font-semibold">
                            {selectedUser.profile.availability || 'Immediate'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Remote Preference</span>
                          <span className="text-neutral-200 font-semibold">
                            {selectedUser.profile.remotePreference || 'Remote'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Portfolio</span>
                          {selectedUser.profile.portfolioUrl ? (
                            <a
                              href={selectedUser.profile.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-rose-400 hover:underline flex items-center gap-1 font-semibold truncate"
                            >
                              View Link <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-neutral-400">None attached</span>
                          )}
                        </div>
                      </div>

                      {/* Skills tags */}
                      {selectedUser.profile.skills && selectedUser.profile.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedUser.profile.skills.map((s, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px] border border-neutral-700"
                            >
                              {typeof s === 'string' ? s : s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-neutral-500 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                      Candidate has not saved their craft profile yet.
                    </p>
                  )}
                </div>

                {/* Section 2: Subscription & Quota Usage */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3">
                    Subscription & Quota Allocation
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Active Plan</span>
                      <div className="mt-0.5">{getPlanBadge(selectedUser.subscription?.plan)}</div>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Window Quota</span>
                      <span className="text-white font-bold">
                        {selectedUser.applicationUsage?.quotaLimit || 5} apps / {selectedUser.applicationUsage?.windowHours || 8}h
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Remaining / Used</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedUser.applicationUsage?.remainingQuota ?? '—'} / {selectedUser.applicationUsage?.applicationsUsed ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Bonus Tokens / Streak</span>
                      <span className="text-amber-300 font-bold">
                        {selectedUser.applicationUsage?.bonusTokens || 0} bonus • {selectedUser.applicationUsage?.currentStreak || 0}d streak
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Custom Sources */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-3">
                    Configured Custom Sources ({selectedUser.sourcesUsage?.customSourceCount || 0}/
                    {selectedUser.sourcesUsage?.maxLimit || 1})
                  </h3>
                  {selectedUser.sourcesUsage?.sources && selectedUser.sourcesUsage.sources.length > 0 ? (
                    <div className="space-y-2">
                      {selectedUser.sourcesUsage.sources.map((src) => (
                        <div
                          key={src.id}
                          className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white block">{src.name}</span>
                            <span className="text-[10px] text-neutral-400">{src.url || src.platform}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              src.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {src.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
                      No custom monitoring sources added yet.
                    </p>
                  )}
                </div>

                {/* Section 4: Device & Registration */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                    Device & Registration Security
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Device Platform</span>
                      <span className="text-neutral-300 font-medium">
                        {selectedUser.device?.platform || 'Web Browser'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Registered On</span>
                      <span className="text-neutral-300 font-medium">
                        {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-4 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {banConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1A1A] border border-neutral-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Confirm Action</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Are you sure you want to {banConfirm.type === 'temporary' ? 'ban this user for 7 days' : 'permanently ban this user'}?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBanConfirm(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBanAction}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-500/20"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

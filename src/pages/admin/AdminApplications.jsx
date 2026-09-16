import React, { useEffect, useState } from 'react';
import { FileText, Send, Bookmark, Edit3, Filter, Clock, Sparkles, Search } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminApplications() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState({ stats: null, applications: [] });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planFilter !== 'all') params.append('plan', planFilter);
      if (search.trim()) params.append('search', search.trim());
      if (dateFilter !== 'all') params.append('date', dateFilter);

      const res = await apiFetch(`/applications?${params.toString()}`);
      if (res.success) {
        setData({ stats: res.stats, applications: res.applications || [] });
      }
    } catch (e) {
      console.error('Failed to load applications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, planFilter, dateFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApplications();
  };

  const { stats, applications } = data;

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'applied') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] uppercase">
          <Send size={10} /> Applied
        </span>
      );
    }
    if (s === 'saved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[10px] uppercase">
          <Bookmark size={10} /> Saved
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px] uppercase">
          <Edit3 size={10} /> Draft
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold text-[10px] uppercase">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Application Pipeline</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Monitor real-time proposal activity, saved opportunities, and outreach status across all candidate plans.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Tracked', count: stats?.total, icon: FileText, color: 'text-white' },
          { label: 'Submitted (Applied)', count: stats?.applied, icon: Send, color: 'text-emerald-400' },
          { label: 'Saved Gigs', count: stats?.saved, icon: Bookmark, color: 'text-rose-400' },
          { label: 'Draft Pitches', count: stats?.draft, icon: Edit3, color: 'text-amber-400' },
        ].map((item, idx) => {
          const IconComp = item.icon;
          return (
            <div key={idx} className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-medium">{item.label}</span>
                <IconComp size={15} className={item.color} />
              </div>
              <span className={`text-2xl font-black ${item.color}`}>
                {loading ? '—' : (item.count || 0).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="bg-[#1C1A1A] border border-neutral-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* User / Title Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate user or job..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700/80 text-white text-xs focus:outline-none focus:border-rose-500 placeholder:text-neutral-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="applied">Applied</option>
              <option value="saved">Saved</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="font-medium">Plan:</span>
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

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="font-medium">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-neutral-400 text-right">
          Showing <span className="text-white font-bold">{applications.length}</span> record{applications.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Applications Data Table */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Opportunity</th>
                <th className="px-4 py-3.5">Applicant User</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Platform Source</th>
                <th className="px-4 py-3.5">Match Fit</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Activity Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                      <span>Loading pipeline records...</span>
                    </div>
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No application records found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col truncate max-w-[220px]">
                        <span className="font-bold text-white truncate">{app.title}</span>
                        <span className="text-[10px] text-neutral-400">{app.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-neutral-300 truncate max-w-[140px]">
                      {app.userName}
                    </td>
                    <td className="px-4 py-3.5 uppercase font-bold text-[10px] text-neutral-400">
                      {app.userPlan}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-300 capitalize">{app.platform}</td>
                    <td className="px-4 py-3.5">
                      {app.matchScore ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <Sparkles size={11} /> {app.matchScore}%
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(app.status)}</td>
                    <td className="px-5 py-3.5 text-right text-neutral-400 whitespace-nowrap text-[11px]">
                      {app.createdAt ? new Date(app.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Users, Send, Globe } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminAnalytics() {
  const { apiFetch } = useAdmin();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/analytics');
      if (res.success && res.analytics) {
        setAnalytics(res.analytics);
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const planDist = analytics?.planDistribution || { free: 0, plus: 0, pro: 0 };
  const appDist = analytics?.applicationStatusDistribution || { applied: 0, saved: 0, draft: 0 };
  const srcDist = analytics?.sourceDistribution || {};

  const totalUsers = analytics?.totalUsers || 1;
  const totalApps = analytics?.totalApplications || 1;

  const freePct = Math.round((planDist.free / totalUsers) * 100);
  const plusPct = Math.round((planDist.plus / totalUsers) * 100);
  const proPct = Math.round((planDist.pro / totalUsers) * 100);

  const appliedPct = Math.round((appDist.applied / totalApps) * 100);
  const savedPct = Math.round((appDist.saved / totalApps) * 100);
  const draftPct = Math.round((appDist.draft / totalApps) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Platform Analytics</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Aggregated analytics computed strictly from real database records (no manufactured graphs).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Plan Distribution */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <Users size={16} className="text-rose-400" />
              <span>User Plan Distribution</span>
            </h2>
            <span className="text-xs text-neutral-500 font-mono">
              {analytics?.totalUsers || 0} users total
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-neutral-500 text-xs">Loading analytics...</div>
          ) : !analytics?.totalUsers || analytics.totalUsers === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-xs">No data yet</div>
          ) : (
            <>
              {/* Visual distribution bar */}
              <div className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden flex">
                <div style={{ width: `${freePct}%` }} className="bg-neutral-600" title={`Free: ${planDist.free}`} />
                <div style={{ width: `${plusPct}%` }} className="bg-rose-500" title={`Plus: ${planDist.plus}`} />
                <div style={{ width: `${proPct}%` }} className="bg-amber-500" title={`Pro: ${planDist.pro}`} />
              </div>

              {/* Legend and numbers */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                    <span className="text-neutral-300">Free Tier</span>
                  </div>
                  <span className="font-bold text-white">
                    {planDist.free} ({freePct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-neutral-300">Plus Tier ($7/mo)</span>
                  </div>
                  <span className="font-bold text-rose-300">
                    {planDist.plus} ({plusPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-neutral-300">Pro Tier ($19/mo)</span>
                  </div>
                  <span className="font-bold text-amber-300">
                    {planDist.pro} ({proPct}%)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2. Application Funnel Ratio */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <Send size={16} className="text-emerald-400" />
              <span>Pipeline Status Distribution</span>
            </h2>
            <span className="text-xs text-neutral-500 font-mono">
              {analytics?.totalApplications || 0} applications
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-neutral-500 text-xs">Loading analytics...</div>
          ) : !analytics?.totalApplications || analytics.totalApplications === 0 ? (
            <div className="py-8 text-center text-neutral-500 text-xs">No data yet</div>
          ) : (
            <>
              {/* Visual distribution bar */}
              <div className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden flex">
                <div style={{ width: `${appliedPct}%` }} className="bg-emerald-500" title={`Applied: ${appDist.applied}`} />
                <div style={{ width: `${savedPct}%` }} className="bg-rose-500" title={`Saved: ${appDist.saved}`} />
                <div style={{ width: `${draftPct}%` }} className="bg-amber-500" title={`Draft: ${appDist.draft}`} />
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-neutral-300">Submitted (Applied)</span>
                  </div>
                  <span className="font-bold text-emerald-400">
                    {appDist.applied} ({appliedPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-neutral-300">Bookmarked (Saved)</span>
                  </div>
                  <span className="font-bold text-rose-300">
                    {appDist.saved} ({savedPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-neutral-300">In Draft Composer</span>
                  </div>
                  <span className="font-bold text-amber-300">
                    {appDist.draft} ({draftPct}%)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Opportunities by Source */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200 mb-4 flex items-center gap-2">
          <Globe size={16} className="text-cyan-400" />
          <span>Discovered Opportunities Breakdown by Source Stream</span>
        </h2>

        {Object.keys(srcDist).length === 0 ? (
          <p className="text-xs text-neutral-500 py-6 text-center">
            No data yet
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(srcDist).map(([src, count]) => (
              <div
                key={src}
                className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between"
              >
                <div className="truncate max-w-[170px]">
                  <span className="text-xs font-bold text-white block truncate">{src}</span>
                  <span className="text-[10px] text-neutral-400">Stream Identifier</span>
                </div>
                <span className="text-sm font-black text-rose-400 font-mono">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

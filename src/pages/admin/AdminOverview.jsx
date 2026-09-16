import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Crown,
  Zap,
  FileText,
  Calendar,
  Globe,
  Activity,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminOverview({ onNavigateTab }) {
  const { apiFetch } = useAdmin();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/stats');
      if (data.success && data.stats) {
        setStats(data.stats);
      } else {
        setError('Could not parse stats data.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load platform statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const metricCards = [
    {
      id: 'totalUsers',
      label: 'Total Users',
      val: stats?.totalUsers,
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      tab: 'users',
    },
    {
      id: 'freeUsers',
      label: 'Free Users',
      val: stats?.freeUsers,
      icon: UserCheck,
      color: 'from-neutral-600 to-neutral-700',
      tab: 'users',
    },
    {
      id: 'plusUsers',
      label: 'Plus Users',
      val: stats?.plusUsers,
      icon: Crown,
      color: 'from-rose-500 to-pink-600',
      tab: 'subscriptions',
    },
    {
      id: 'proUsers',
      label: 'Pro Users',
      val: stats?.proUsers,
      icon: Zap,
      color: 'from-amber-500 to-orange-600',
      tab: 'subscriptions',
    },
    {
      id: 'totalApplications',
      label: 'Total Applications',
      val: stats?.totalApplications,
      icon: FileText,
      color: 'from-emerald-500 to-teal-600',
      tab: 'applications',
    },
    {
      id: 'applicationsToday',
      label: 'Applications Today',
      val: stats?.applicationsToday,
      icon: Calendar,
      color: 'from-cyan-500 to-blue-600',
      tab: 'applications',
    },
    {
      id: 'activeSources',
      label: 'Active Sources',
      val: stats?.activeSources,
      icon: Globe,
      color: 'from-purple-500 to-violet-600',
      tab: 'sources',
    },
    {
      id: 'activeUsers',
      label: 'Active Users (7d)',
      val: stats?.activeUsers,
      icon: Activity,
      color: 'from-rose-600 to-rose-700',
      tab: 'users',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Platform Overview</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time platform metrics, user adoption, and active system activity.
          </p>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Database Offline</span>
          </div>
        ) : loading ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Database Live</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 8 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const IconComp = card.icon;
          const displayVal =
            loading ? (
              <span className="inline-block w-8 h-6 bg-neutral-800 animate-pulse rounded" />
            ) : typeof card.val === 'number' ? (
              card.val.toLocaleString()
            ) : (
              'Not available'
            );

          return (
            <div
              key={card.id}
              onClick={() => onNavigateTab && onNavigateTab(card.tab)}
              className="bg-[#1C1A1A] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all hover:-translate-y-0.5 group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  {card.label}
                </span>
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-sm`}
                >
                  <IconComp size={15} />
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {displayVal}
                </span>
                <span className="text-[11px] text-neutral-500 group-hover:text-rose-400 transition-colors flex items-center gap-0.5">
                  Inspect <ArrowRight size={11} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Architecture & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Actions & Navigation */}
        <div className="lg:col-span-7 bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-lg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-rose-400" />
            <span>Administrative Quick Navigation</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: 'User Management',
                desc: 'Inspect registered candidate profiles, subscriptions & quota allocations.',
                tab: 'users',
              },
              {
                title: 'Application Pipeline',
                desc: 'Review submitted proposals, drafts, and client outreach records.',
                tab: 'applications',
              },
              {
                title: 'Opportunities Discovered',
                desc: 'Audit scraped and ingested jobs from Reddit, X, and YouTube.',
                tab: 'opportunities',
              },
              {
                title: 'AI Agent Monitor',
                desc: 'Check discovery health, connected APIs, and qualification statistics.',
                tab: 'ai-agent',
              },
            ].map((act, i) => (
              <button
                key={i}
                onClick={() => onNavigateTab && onNavigateTab(act.tab)}
                className="text-left p-4 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between group"
              >
                <div>
                  <h3 className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors mb-1">
                    {act.title}
                  </h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">{act.desc}</p>
                </div>
                <span className="text-[10px] text-rose-400 font-semibold mt-3 flex items-center gap-1">
                  Open Section <ArrowRight size={10} />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Security & Storage Model Info */}
        <div className="lg:col-span-5 bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span>Storage & Architecture</span>
            </h2>

            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/80">
                <span className="text-neutral-400">Database Engine</span>
                <span className="font-semibold text-white">JSON Atomic File System</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/80">
                <span className="text-neutral-400">Security Layer</span>
                <span className="font-semibold text-emerald-400">Bearer Token + Role Check</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/80">
                <span className="text-neutral-400">Normal User Isolation</span>
                <span className="font-semibold text-emerald-400">403 Forbidden Enforced</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-neutral-400">Discovery Engine</span>
                <span className="font-semibold text-white">AI Agent Multi-Stream</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-[11px] text-neutral-400">
            Protected internal console. Normal users and unauthenticated requests are rejected on all administrative endpoints.
          </div>
        </div>
      </div>
    </div>
  );
}

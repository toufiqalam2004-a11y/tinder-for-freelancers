import React, { useEffect, useState } from 'react';
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  User,
  RefreshCw,
  Layers,
  Phone,
} from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminSources() {
  const { apiFetch } = useAdmin();
  const [sourcesData, setSourcesData] = useState({
    builtinSources: [],
    customSources: [],
    totalBuiltin: 0,
    totalCustom: 0,
    activeCustom: 0,
    disabledCustom: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'builtin' | 'custom'

  const fetchSources = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiFetch('/sources');
      if (res.success) {
        setSourcesData({
          builtinSources: res.builtinSources || [],
          customSources: res.customSources || [],
          totalBuiltin: res.totalBuiltin ?? res.builtinSources?.length ?? 0,
          totalCustom: res.totalCustom ?? res.customSources?.length ?? 0,
          activeCustom: res.activeCustom ?? res.customSources?.filter((s) => s.enabled)?.length ?? 0,
          disabledCustom: res.disabledCustom ?? res.customSources?.filter((s) => !s.enabled)?.length ?? 0,
        });
      }
    } catch (e) {
      console.error('Failed to load sources:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const { builtinSources, customSources, totalBuiltin, totalCustom, activeCustom } = sourcesData;

  return (
    <div className="space-y-6">
      {/* Header & Live Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sources & Pipeline Streams</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time pipeline monitoring for platform built-in discovery feeds and user-connected custom sources.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Refresh Action */}
          <button
            onClick={() => fetchSources(true)}
            disabled={loading || refreshing}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Refresh sources from database"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-rose-400' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Sources'}</span>
          </button>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({totalBuiltin + totalCustom})
            </button>
            <button
              onClick={() => setActiveTab('builtin')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'builtin' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Built-in ({totalBuiltin})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'custom' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              User Custom ({totalCustom})
            </button>
          </div>
        </div>
      </div>

      {/* Real Count Metric Badges (Strictly Separate Built-in vs Custom) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Built-in Sources Counter */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Built-in Sources
            </span>
            <div className="text-2xl font-black text-white mt-0.5">
              {loading ? '...' : totalBuiltin}
            </div>
            <span className="text-[10px] text-rose-400/90 font-medium">Developer / System Platform Default</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldCheck size={18} />
          </div>
        </div>

        {/* User Custom Sources Counter */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              User Custom Sources
            </span>
            <div className="text-2xl font-black text-white mt-0.5">
              {loading ? '...' : totalCustom}
            </div>
            <span className="text-[10px] text-amber-400/90 font-medium">Connected by Registered Users</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <User size={18} />
          </div>
        </div>

        {/* Active Custom Sources Counter */}
        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Active Custom Streams
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {loading ? '...' : activeCustom}
            </div>
            <span className="text-[10px] text-neutral-400 font-medium">
              {totalCustom > 0 ? `${totalCustom - activeCustom} currently paused` : 'No custom feeds running'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* 1. BUILT-IN SOURCES SECTION */}
      {(activeTab === 'all' || activeTab === 'builtin') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <ShieldCheck size={16} />
              <span>Platform Built-in Sources ({builtinSources.length})</span>
            </h2>
            <span className="text-[11px] text-neutral-500">
              Developer/System Controlled • Zero User Quota Impact
            </span>
          </div>

          <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Source Stream</th>
                  <th className="px-4 py-3.5">Platform</th>
                  <th className="px-4 py-3.5">Classification</th>
                  <th className="px-4 py-3.5">Ingest Interval</th>
                  <th className="px-4 py-3.5">Target Feed / URL</th>
                  <th className="px-4 py-3.5">Ownership</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {builtinSources.map((src) => (
                  <tr key={src.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                      <Globe size={14} className="text-rose-400 flex-shrink-0" />
                      <span>{src.name}</span>
                    </td>
                    <td className="px-4 py-3.5 uppercase font-bold text-[10px] text-neutral-300">
                      {src.platform}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[10px] uppercase">
                        Built-in
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-300 font-mono text-[11px]">
                      {src.fetchInterval || 15}m
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400 font-mono text-[11px] truncate max-w-[200px]">
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-rose-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{src.url}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400 text-[11px]">
                      {src.owner || 'Platform Default (Built-in)'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. USER CUSTOM SOURCES SECTION */}
      {(activeTab === 'all' || activeTab === 'custom') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <User size={16} />
              <span>User Custom Sources ({customSources.length})</span>
            </h2>
            <span className="text-[11px] text-neutral-500">
              Live records from db.sources connected by candidates
            </span>
          </div>

          <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            {customSources.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto mb-3">
                  <Layers size={22} />
                </div>
                <h3 className="text-sm font-bold text-neutral-200">No custom sources connected yet</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  When candidates connect custom ingestion feeds in the User App, they will automatically appear here from the live database.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Source Name</th>
                    <th className="px-4 py-3.5">Platform</th>
                    <th className="px-4 py-3.5">Target Feed / URL</th>
                    <th className="px-4 py-3.5">Owner / User</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Created Date</th>
                    <th className="px-4 py-3.5">Updated Date</th>
                    <th className="px-5 py-3.5 text-right">Last Refresh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80">
                  {customSources.map((src) => (
                    <tr key={src.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Globe size={13} className="text-amber-400 flex-shrink-0" />
                          <span>{src.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 uppercase font-bold text-[10px] text-neutral-300">
                        {src.platform}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-400 font-mono text-[11px] truncate max-w-[200px]">
                        {src.url ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <span className="truncate">{src.url}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-neutral-200">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white truncate max-w-[150px]">
                            {src.ownerName || 'Unknown User'}
                          </span>
                          {src.ownerPhone && (
                            <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                              <Phone size={9} />
                              {src.ownerPhone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {src.enabled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-neutral-400 font-semibold text-[11px] bg-neutral-800/80 border border-neutral-700/60 px-2 py-0.5 rounded-full">
                            <XCircle size={11} /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap text-[11px]">
                        {src.createdAt ? new Date(src.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap text-[11px]">
                        {src.updatedAt ? new Date(src.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-neutral-400 whitespace-nowrap text-[11px]">
                        {src.lastRefresh ? new Date(src.lastRefresh).toLocaleString() : 'Never refreshed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

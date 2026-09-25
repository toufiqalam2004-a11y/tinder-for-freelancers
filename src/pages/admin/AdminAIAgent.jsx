import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminAIAgent() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAIAgentStatus = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/ai-agent/status');
      if (res.success && res.aiAgent) {
        setData(res.aiAgent);
      }
    } catch (e) {
      console.error('Failed to load AI Agent status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIAgentStatus();
  }, []);

  const services = data?.services || {};
  const metrics = data?.metrics || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">AI Agent Monitor</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Internal administrative health dashboard for the autonomous multi-source opportunity discovery engine.
        </p>
      </div>

      {/* Main Engine Status Card */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] flex items-center justify-center text-white shadow-lg">
              <Bot size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">AI Agent Engine</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    data?.isConfigured
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                  }`}
                >
                  {data?.statusLabel || (loading ? 'Loading...' : 'AI Agent discovery is not configured')}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Last discovery stream check: <span className="text-neutral-300 font-mono">{data?.lastRun ? new Date(data.lastRun).toLocaleString() : 'No runs recorded'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={fetchAIAgentStatus}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* Discovery Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-1">Total Ingested</span>
            <span className="text-2xl font-black text-white">
              {loading ? '—' : (metrics.totalDiscovered || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-1">Qualified (Score &ge; 70)</span>
            <span className="text-2xl font-black text-emerald-400">
              {loading ? '—' : (metrics.qualified || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-1">Rejected / Low Fit</span>
            <span className="text-2xl font-black text-neutral-400">
              {loading ? '—' : (metrics.rejected || 0).toLocaleString()}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-1">Duplicate Posts</span>
            <span className="text-2xl font-black text-amber-400">
              {loading ? '—' : (metrics.duplicates || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Connected Source Integrations */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-4">
          Integrated Public Discovery Providers
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'Reddit API Ingestor',
              desc: 'r/forhire, r/Jobbit, r/designjobs, r/CreatorServices',
              status: services.reddit,
            },
            {
              name: 'YouTube Jobs Scraper',
              desc: 'Creator channel hiring calls & community posts',
              status: services.youtube,
            },
            {
              name: 'X (Twitter) Feed Stream',
              desc: 'Founder hiring tweets & remote contracts',
              status: services.x,
            },
            {
              name: 'AI Proposal Synthesizer',
              desc: 'Semantic relevance qualification & pitch writer',
              status: services.aiModel,
            },
          ].map((item, idx) => {
            const isConnected = item.status === 'connected';
            return (
              <div
                key={idx}
                className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white">{item.name}</span>
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-neutral-500 text-[10px] font-bold uppercase">
                        <AlertCircle size={12} /> Not Configured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
                </div>

                <div className="pt-3 mt-4 border-t border-neutral-800/80 text-[10px] text-neutral-500">
                  {isConnected ? 'Telemetry stream receiving data' : 'Awaiting provider API keys in environment'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

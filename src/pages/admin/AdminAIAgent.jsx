import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, AlertCircle, RefreshCw, Play, Sparkles, Clock, Database } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminAIAgent() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [feedback, setFeedback] = useState(null);

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

  const handleTriggerDiscovery = async () => {
    setTriggering(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/ai-agent/discover', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res && res.success) {
        const raw = res.summary?.rawDiscovered || res.totalRaw || 0;
        const qual = res.summary?.qualified || res.totalQualified || 0;
        const ing = res.summary?.ingested || res.totalIngested || 0;
        const dur = res.durationMs || 0;
        setFeedback({
          type: 'success',
          message: `Discovery complete! Processed ${raw} raw, qualified ${qual}, ingested ${ing} jobs into feed in ${dur}ms.`,
        });
        await fetchAIAgentStatus();
      } else {
        setFeedback({
          type: 'error',
          message: res?.error || 'Discovery execution failed.',
        });
      }
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e.message || 'Failed to trigger discovery run.',
      });
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchAIAgentStatus();
  }, []);

  const services = data?.services || {};
  const metrics = data?.metrics || {};
  const latestRun = data?.latestRun || {};
  const cumulative = data?.cumulative || {};
  const recentRuns = data?.recentRuns || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">AI Agent Monitor</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Internal administrative health & pipeline telemetry for Hermes + Agent Reach opportunity discovery and job feed ingestion.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-white font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

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
                  {data?.statusLabel || (loading ? 'Loading...' : 'Engine Standby')}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Last discovery stream check: <span className="text-neutral-300 font-mono">{data?.lastRun && data.lastRun !== 'No runs recorded' ? new Date(data.lastRun).toLocaleString() : 'No runs recorded'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleTriggerDiscovery}
              disabled={triggering}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {triggering ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Discovering & Ingesting...</span>
                </>
              ) : (
                <>
                  <Play size={13} className="fill-current" />
                  <span>Trigger Discovery Run</span>
                </>
              )}
            </button>
            <button
              onClick={fetchAIAgentStatus}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* LATEST DISCOVERY RUN METRICS */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <span>●</span> Latest Discovery Run
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {latestRun.timestamp ? `Executed at: ${new Date(latestRun.timestamp).toLocaleTimeString()}` : 'Awaiting first run'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Raw Discovered</span>
              <span className="text-2xl font-black text-white">
                {loading ? '—' : (latestRun.rawDiscovered || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Unique (Deduped)</span>
              <span className="text-2xl font-black text-white">
                {loading ? '—' : (latestRun.unique || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Qualified (Score &ge; 60)</span>
              <span className="text-2xl font-black text-emerald-400">
                {loading ? '—' : (latestRun.qualified || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Rejected / Low Fit</span>
              <span className="text-2xl font-black text-neutral-400">
                {loading ? '—' : (latestRun.rejected || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Duplicate Records</span>
              <span className="text-2xl font-black text-amber-400">
                {loading ? '—' : (latestRun.duplicates || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Ingested to Feed</span>
              <span className="text-2xl font-black text-rose-400">
                {loading ? '—' : (latestRun.ingested || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* CUMULATIVE AGENT METRICS */}
        <div className="pt-6 mt-6 border-t border-neutral-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Cumulative Agent Metrics (Session Totals)
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              Total Recorded Runs: <strong className="text-neutral-200">{cumulative.totalRuns || 0}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Raw Discovered</span>
              <span className="text-lg font-bold text-white">
                {loading ? '—' : (cumulative.rawDiscovered || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Unique</span>
              <span className="text-lg font-bold text-white">
                {loading ? '—' : (cumulative.unique || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Qualified</span>
              <span className="text-lg font-bold text-emerald-400">
                {loading ? '—' : (cumulative.qualified || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Rejected</span>
              <span className="text-lg font-bold text-neutral-400">
                {loading ? '—' : (cumulative.rejected || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Duplicates</span>
              <span className="text-lg font-bold text-amber-400">
                {loading ? '—' : (cumulative.duplicates || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block mb-0.5">Total Ingested</span>
              <span className="text-lg font-bold text-rose-400">
                {loading ? '—' : (cumulative.ingested || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* CURRENT DATABASE STATE (LIVE FEED SNAPSHOT) */}
          <div className="mt-3.5 px-4 py-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Database size={13} className="text-rose-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Current Database State:
              </span>
              <span className="text-xs text-neutral-300">
                AI Jobs Currently in Feed: <strong className="text-white font-bold font-mono ml-1">{(data?.databaseMetrics?.aiJobsInFeed ?? metrics?.aiIngested ?? 0).toLocaleString()}</strong>
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                (Total Feed Jobs: {(data?.databaseMetrics?.totalDbJobs ?? 0).toLocaleString()})
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 italic">
              *Total Ingested tracks cumulative run events; AI Jobs Currently in Feed reflects live database records.
            </span>
          </div>
        </div>
      </div>

      {/* Connected AI Architecture Components */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center gap-2">
          <Sparkles size={16} /> Connected Discovery Architecture (Step 2 & 3)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'Hermes Agent Engine',
              desc: 'Autonomous multi-query discovery coordinator via OmniRoute local inference.',
              status: services.hermes || 'connected',
              badge: 'Operational',
            },
            {
              name: 'Agent Reach Web Engine',
              desc: 'Public web & social opportunity extraction adapter via local MCP tool.',
              status: services.agentReach || 'connected',
              badge: 'MCP Ready',
            },
            {
              name: 'Two-Stage AI Qualification',
              desc: 'Zero-cost prompt injection filter, heuristic relevance & Pro-Match scorer.',
              status: services.qualificationEngine || 'connected',
              badge: 'Stage 1 & 2 Active',
            },
            {
              name: 'n8n Orchestration Layer',
              desc: 'Local orchestration workflow for triggering discovery, qualification, deduplication and feed ingestion.',
              status: services.n8n || 'ready',
              badge: 'Workflow Ready',
            },
          ].map((item, idx) => {
            const isConnected = item.status === 'connected' || item.status === 'ready';
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
                        <CheckCircle2 size={12} /> {item.badge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-neutral-500 text-[10px] font-bold uppercase">
                        <AlertCircle size={12} /> Offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
                </div>

                <div className="pt-3 mt-4 border-t border-neutral-800/80 text-[10px] text-neutral-500 flex items-center justify-between">
                  <span>Status: <strong className="text-neutral-300 font-mono uppercase">{item.status}</strong></span>
                  <span className="text-emerald-400/80 font-mono">Local</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Pipeline Runs Telemetry */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center gap-2">
          <Clock size={16} /> Recent Discovery Runs Telemetry
        </h2>

        <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          {recentRuns.length === 0 ? (
            <div className="p-8 text-center">
              <Bot className="mx-auto text-neutral-600 mb-2" size={32} />
              <p className="text-xs text-neutral-400">
                No recent live discovery pipeline executions recorded in this session.
              </p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Click <strong>"Trigger Discovery Run"</strong> above or call <code className="text-rose-400 font-mono">POST /api/agent/discover</code> to generate telemetry.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-900/60 border-b border-neutral-800 text-[11px] text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Run Time</th>
                    <th className="py-3 px-4">Queries</th>
                    <th className="py-3 px-4">Raw Found</th>
                    <th className="py-3 px-4">Unique</th>
                    <th className="py-3 px-4">Qualified</th>
                    <th className="py-3 px-4">Ingested</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {recentRuns.map((run, idx) => (
                    <tr key={run.id || idx} className="hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-300">
                        {run.timestamp ? new Date(run.timestamp).toLocaleTimeString() : 'Recent'}
                      </td>
                      <td className="py-3 px-4 text-neutral-300">{run.queriesRun || run.queries || 6}</td>
                      <td className="py-3 px-4 text-neutral-300">{run.rawCount || run.rawDiscovered || 0}</td>
                      <td className="py-3 px-4 text-neutral-300">{run.uniqueCount || run.uniqueOpportunities || 0}</td>
                      <td className="py-3 px-4 text-emerald-400 font-semibold">{run.qualifiedCount || run.qualified || 0}</td>
                      <td className="py-3 px-4 text-rose-400 font-semibold">{run.ingestedCount !== undefined ? run.ingestedCount : (run.ingested || 0)}</td>
                      <td className="py-3 px-4 font-mono text-neutral-400">{run.durationMs ? `${run.durationMs}ms` : '—'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase">
                          {run.status || 'Success'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

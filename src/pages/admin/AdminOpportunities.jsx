import React, { useEffect, useState } from 'react';
import { Search, ExternalLink, Sparkles } from 'lucide-react';
import { useAdmin } from './AdminContext';

export default function AdminOpportunities() {
  const { apiFetch } = useAdmin();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiFetch(`/opportunities?${params.toString()}`);
      if (res.success) {
        setOpportunities(res.opportunities || []);
      }
    } catch (e) {
      console.error('Failed to load opportunities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [sourceFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOpportunities();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Opportunity Explorer</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Browse genuine client contracts, freelance posts, and gigs discovered across public networks.
          </p>
        </div>

        <div className="text-xs text-neutral-400">
          Showing <span className="text-white font-bold">{opportunities.length}</span> opportunit{opportunities.length === 1 ? 'y' : 'ies'}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#1C1A1A] border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-80 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, client, skill..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors placeholder:text-neutral-500"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="hidden md:inline font-medium">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Sources</option>
              <option value="reddit">Reddit</option>
              <option value="youtube">YouTube</option>
              <option value="x">X (Twitter)</option>
              <option value="custom">Custom Feed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="hidden md:inline font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="unqualified">Unqualified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities Data Grid/Table */}
      <div className="bg-[#1C1A1A] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Opportunity Title</th>
                <th className="px-4 py-3.5">Client / Company</th>
                <th className="px-4 py-3.5">Category & Skills</th>
                <th className="px-4 py-3.5">Budget</th>
                <th className="px-4 py-3.5">Source Stream</th>
                <th className="px-4 py-3.5">Match Score</th>
                <th className="px-5 py-3.5 text-right">Discovered Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                      <span>Loading discovered opportunities...</span>
                    </div>
                  </td>
                </tr>
              ) : opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No opportunities yet
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col truncate max-w-[240px]">
                        <span className="font-bold text-white truncate">{opp.title}</span>
                        {opp.sourceUrl ? (
                          <a
                            href={opp.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 font-medium mt-0.5 truncate"
                          >
                            <span>Open Source Post</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-[10px] text-neutral-500">Internal Stream</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-neutral-300 truncate max-w-[130px]">
                      {opp.company}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 max-w-[180px]">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">
                          {opp.category}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(opp.skills || []).slice(0, 2).map((s, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 rounded bg-neutral-800 text-[9px] text-neutral-300"
                            >
                              {s}
                            </span>
                          ))}
                          {(opp.skills || []).length > 2 && (
                            <span className="text-[9px] text-neutral-500">
                              +{opp.skills.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-rose-300 whitespace-nowrap">
                      {opp.budget}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400 font-mono text-[11px] truncate max-w-[120px]">
                      {opp.sourceId}
                    </td>
                    <td className="px-4 py-3.5">
                      {opp.matchScore ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                          <Sparkles size={11} /> {opp.matchScore}%
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-neutral-400 whitespace-nowrap text-[11px]">
                      {opp.createdAt ? new Date(opp.createdAt).toLocaleString() : '—'}
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

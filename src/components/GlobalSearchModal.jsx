import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, X, Briefcase, Building2, FileText, Globe, 
  ArrowRight, Sparkles, Filter 
} from 'lucide-react';
import { searchService } from '../services/searchService';

const SUGGESTED_TAGS = [
  'Video Editor',
  'After Effects',
  'Remote',
  'Motion Design',
  'YouTube',
  'Shorts',
  'SaaS',
];

const GlobalSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      const searchRes = searchService.search(query);
      setResults(searchRes);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectJob = (jobId) => {
    navigate(`/job/${jobId}`);
    onClose();
  };

  const handleSelectApplication = (appId) => {
    navigate(`/application/${appId}`);
    onClose();
  };

  const handleSelectSource = (srcId) => {
    navigate(`/source/${srcId}`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          className="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col max-h-[85vh] text-text-primary"
        >
          {/* Search Input Bar */}
          <div className="p-3.5 border-b border-border flex items-center gap-3 bg-surface">
            <Search size={18} className="text-primary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, companies, applications, sources..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-text-muted hover:text-text-primary transition-colors rounded-lg"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors"
            >
              Esc
            </button>
          </div>

          {/* Quick Filter Bar */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-border bg-surface-hover/30 overflow-x-auto no-scrollbar text-xs">
            {['all', 'jobs', 'companies', 'applications', 'sources'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-full font-medium capitalize transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results Area */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {!query.trim() ? (
              <div className="space-y-3 py-4">
                <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Popular Searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-hover/60 border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles size={12} className="text-primary" />
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : results && results.totalResults === 0 ? (
              <div className="text-center py-10 text-xs text-text-secondary">
                No matching results found for "{query}".
              </div>
            ) : (
              <div className="space-y-4">
                {/* Jobs */}
                {(categoryFilter === 'all' || categoryFilter === 'jobs') &&
                  results?.jobs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase size={13} className="text-primary" />
                        <span>Jobs ({results.jobs.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {results.jobs.map((job) => (
                          <div
                            key={job.id}
                            onClick={() => handleSelectJob(job.id)}
                            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-text-primary truncate group-hover:text-primary transition-colors">
                                {job.title}
                              </div>
                              <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                                <span>{job.company || job.client || 'Hiring Client'}</span>
                                <span>•</span>
                                <span className="uppercase text-[10px] font-semibold">{job.platform}</span>
                                {job.matchScore && (
                                  <>
                                    <span>•</span>
                                    <span className="text-primary font-bold">{job.matchScore}%</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Companies */}
                {(categoryFilter === 'all' || categoryFilter === 'companies') &&
                  results?.companies.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={13} className="text-amber-500" />
                        <span>Clients & Channels ({results.companies.length})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {results.companies.map((comp, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (comp.lastSeenJobId) handleSelectJob(comp.lastSeenJobId);
                              else navigate('/jobs');
                            }}
                            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all cursor-pointer"
                          >
                            <div className="text-xs font-bold text-text-primary truncate">
                              {comp.name}
                            </div>
                            <div className="text-[10px] text-text-muted uppercase mt-0.5">
                              {comp.platform} • {comp.jobCount} post(s)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Applications */}
                {(categoryFilter === 'all' || categoryFilter === 'applications') &&
                  results?.applications.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <FileText size={13} className="text-purple-500" />
                        <span>Applications ({results.applications.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {results.applications.map((app) => (
                          <div
                            key={app.id}
                            onClick={() => handleSelectApplication(app.id)}
                            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-text-primary truncate">
                                {app.title || app.jobTitle}
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                {app.company} • <span className="capitalize text-primary font-semibold">{app.status}</span>
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-text-muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Sources */}
                {(categoryFilter === 'all' || categoryFilter === 'sources') &&
                  results?.sources.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Globe size={13} className="text-sky-500" />
                        <span>Sources ({results.sources.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {results.sources.map((src) => (
                          <div
                            key={src.id}
                            onClick={() => handleSelectSource(src.id)}
                            className="p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div className="text-xs font-bold text-text-primary truncate">
                              {src.name}
                            </div>
                            <span className="text-[10px] font-semibold uppercase text-text-secondary bg-surface-hover px-2 py-0.5 rounded border border-border">
                              {src.platform}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GlobalSearchModal;

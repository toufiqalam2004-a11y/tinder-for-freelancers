import React, { useState } from 'react';
import { MessageSquare, Sparkles, Search, Compass } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { useSources } from '../contexts/SourcesContext';
import { monitoringService } from '../services/monitoringService';

const POPULAR_SUBREDDITS = [
  { name: 'r/forhire', desc: 'Job offers & hiring posts' },
  { name: 'r/freelance', desc: 'Freelance gig opportunities' },
  { name: 'r/VideoEditing', desc: 'Video creator community & gigs' },
  { name: 'r/remotejobs', desc: 'Worldwide remote hiring' },
];

export default function AddRedditModal({ isOpen, onClose, onAdded }) {
  const { addSource } = useSources();
  const [activeTab, setActiveTab] = useState('subreddit'); // 'subreddit' | 'search'
  const [subredditInput, setSubredditInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('video editor hiring');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectSub = (sub) => {
    setSubredditInput(sub);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let sourceName = '';
    let sourceUrl = '';
    let sourceType = '';
    let query = '';

    if (activeTab === 'subreddit') {
      const cleanSub = subredditInput.trim().replace(/^r\//, '');
      if (!cleanSub) {
        setError('Please enter or select a subreddit name (e.g. r/forhire)');
        return;
      }
      sourceName = `r/${cleanSub}`;
      sourceUrl = `https://reddit.com/r/${cleanSub}`;
      sourceType = 'subreddit';
    } else {
      if (!searchQuery.trim()) {
        setError('Please enter a search query');
        return;
      }
      sourceName = `Reddit Search: "${searchQuery.trim()}"`;
      sourceUrl = `https://reddit.com/search?q=${encodeURIComponent(searchQuery.trim())}`;
      sourceType = 'search';
      query = searchQuery.trim();
    }

    setLoading(true);
    setError('');

    try {
      const newSource = addSource({
        platform: 'reddit',
        sourceType,
        sourceName,
        sourceUrl,
        query,
        status: 'added',
      });

      // Run initial check
      await monitoringService.checkSource(newSource);

      toast.success(`${sourceName} added as job source!`);
      setSubredditInput('');
      onAdded?.(newSource);
      onClose();
    } catch (err) {
      setError('Failed to add Reddit source.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Reddit Source">
      <p className="text-xs text-text-secondary -mt-2 mb-4 leading-relaxed">
        Discover hiring posts across active freelancer subreddits and search feeds.
      </p>

      {/* Tabs: A. Add Subreddit | B. Search Reddit Jobs */}
      <div className="grid grid-cols-2 gap-2 bg-surface-hover p-1 rounded-xl mb-4 border border-border">
        <button
          type="button"
          onClick={() => {
            setActiveTab('subreddit');
            setError('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'subreddit'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Compass size={14} />
          Subreddit
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('search');
            setError('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'search'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Search size={14} />
          Search Jobs
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {activeTab === 'subreddit' ? (
          <div>
            <label className="block text-sm text-text-secondary mb-1.5 font-medium">
              Subreddit Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-text-muted font-mono text-sm">r/</span>
              <input
                type="text"
                placeholder="forhire, freelance, VideoEditing"
                value={subredditInput.replace(/^r\//, '')}
                onChange={(e) => {
                  setSubredditInput(e.target.value);
                  setError('');
                }}
                className="w-full bg-surface-hover border border-border rounded-input pl-8 pr-4 py-2.5 text-text-primary placeholder-text-muted outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 text-sm font-sans"
              />
            </div>

            {/* Popular Subreddit Pills */}
            <div className="mt-3">
              <span className="text-[11px] text-text-muted font-medium block mb-1.5">
                Popular Freelance Subreddits:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {POPULAR_SUBREDDITS.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => handleSelectSub(sub.name)}
                    className={`text-left p-2 rounded-lg border transition-all text-xs ${
                      subredditInput === sub.name
                        ? 'bg-primary/20 border-primary text-primary-light'
                        : 'bg-surface border-border hover:border-primary/40 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="font-semibold text-text-primary">{sub.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{sub.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Input
              label="Reddit Search Query"
              placeholder="e.g. video editor hiring, freelance editor"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setError('');
              }}
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Searches public posts across Reddit for recent hiring opportunities.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="pt-2">
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            <Sparkles size={15} className="mr-1.5" />
            Add Reddit Source
          </Button>
        </div>
      </form>
    </Modal>
  );
}

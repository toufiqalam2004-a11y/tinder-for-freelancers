import React, { useState } from 'react';
import { MessageSquare, Sparkles, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { useProfile } from '../contexts/ProfileContext';
import { useSources } from '../contexts/SourcesContext';
import { monitoringService } from '../services/monitoringService';

const X_SUGGESTED_QUERIES = [
  'video editor hiring',
  'video editor needed',
  'looking for video editor',
  'youtube editor',
  'hire video editor',
  'video editing job',
];

export default function AddXModal({ isOpen, onClose, onAdded }) {
  const { profile } = useProfile();
  const { addSource } = useSources();

  const profession = profile?.profession || 'Video Editor';
  const specialization = profile?.specialization || 'YouTube Video Editor';

  const [query, setQuery] = useState('video editor hiring');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setError('Please enter or select a search query');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newSource = addSource({
        platform: 'x',
        sourceType: 'search',
        sourceName: `X: "${cleanQuery}"`,
        sourceUrl: `https://x.com/search?q=${encodeURIComponent(cleanQuery)}`,
        query: cleanQuery,
        status: 'added',
      });

      // Run initial monitoring check
      await monitoringService.checkSource(newSource);

      toast.success(`X search "${cleanQuery}" added!`);
      onAdded?.(newSource);
      onClose();
    } catch (err) {
      setError('Failed to add X source.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add X (Twitter) Source">
      <p className="text-xs text-text-secondary -mt-2 mb-4 leading-relaxed">
        Search public posts on X to find founders, creators, and agencies actively hiring.
      </p>

      {/* Concept Clarification Notice */}
      <div className="bg-surface-hover/80 border border-border rounded-xl p-3 mb-4">
        <div className="flex items-start gap-2 text-xs text-text-secondary">
          <Info size={16} className="text-primary-light flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-text-primary">Public Search Mode:</strong> Searches public hiring tweets. Tinder for Freelancers will never mirror your private feed or request your personal credentials.
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5 font-medium">
            X Search Query
          </label>
          <Input
            placeholder="e.g. video editor hiring"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError('');
            }}
          />
        </div>

        {/* Profile-based suggested queries */}
        <div>
          <span className="text-[11px] text-text-muted font-medium flex items-center gap-1 mb-2">
            <Sparkles size={12} className="text-primary-light" />
            Suggested for {profession} ({specialization}):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {X_SUGGESTED_QUERIES.map((q) => {
              const isSelected = query.toLowerCase() === q.toLowerCase();
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuery(q);
                    setError('');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-primary/20 border-primary text-primary-light shadow-sm'
                      : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-primary/40'
                  }`}
                >
                  {isSelected && <Check size={12} className="text-primary-light" />}
                  "{q}"
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="pt-2">
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            <MessageSquare size={16} className="mr-1.5" />
            Add X Search
          </Button>
        </div>
      </form>
    </Modal>
  );
}

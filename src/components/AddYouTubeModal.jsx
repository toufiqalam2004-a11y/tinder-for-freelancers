import React, { useState } from 'react';
import { Youtube, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { useProfile } from '../contexts/ProfileContext';
import { useSources } from '../contexts/SourcesContext';
import { monitoringService } from '../services/monitoringService';

const SUGGESTED_QUERIES = [
  'video editor hiring',
  'video editor wanted',
  'looking for video editor',
  'youtube editor needed',
  'hire video editor',
  'video editor job',
  'freelance video editor',
];

export default function AddYouTubeModal({ isOpen, onClose, onAdded }) {
  const { profile } = useProfile();
  const { addSource } = useSources();

  const profession = profile?.profession || 'Video Editor';
  const specialization = profile?.specialization || 'YouTube Video Editor';

  const [query, setQuery] = useState('youtube editor needed');
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
        platform: 'youtube',
        sourceType: 'search',
        sourceName: `YouTube: "${cleanQuery}"`,
        sourceUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
        query: cleanQuery,
        status: 'added',
      });

      // Run initial monitoring check
      await monitoringService.checkSource(newSource);

      toast.success(`YouTube source "${cleanQuery}" added!`);
      onAdded?.(newSource);
      onClose();
    } catch (err) {
      setError('Failed to add YouTube source.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add YouTube Source">
      <p className="text-xs text-text-secondary -mt-2 mb-4 leading-relaxed">
        Discover creators and studios hiring editors through public video posts and descriptions.
      </p>

      {/* Profile Context Banner */}
      <div className="bg-surface-hover/80 border border-border rounded-xl p-3 mb-4">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block mb-1">
          Profile Context
        </span>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-primary font-medium">{profession}</span>
          <span className="text-primary-light font-medium">{specialization}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5 font-medium">
            Search Query
          </label>
          <Input
            placeholder="e.g. youtube editor needed"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError('');
            }}
          />
        </div>

        {/* Suggested Queries based on profile */}
        <div>
          <span className="text-[11px] text-text-muted font-medium flex items-center gap-1 mb-2">
            <Sparkles size={12} className="text-primary-light" />
            Generated Queries for {specialization}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.map((q) => {
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
            <Youtube size={16} className="mr-1.5 text-red-400" />
            Add YouTube Search
          </Button>
        </div>
      </form>
    </Modal>
  );
}

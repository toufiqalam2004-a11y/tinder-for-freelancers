import React, { useState } from 'react';
import {
  Radio,
  Youtube,
  MessageSquare,
  Facebook,
  FilePlus2,
  ChevronRight,
  Sparkles,
  Check,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { useSources } from '../contexts/SourcesContext';
import { useProfile } from '../contexts/ProfileContext';
import { redditService } from '../services/redditService';
import { youtubeService } from '../services/youtubeService';
import { xService } from '../services/xService';
import { isValidFacebookGroupUrl } from '../utils/validators';
import { createJob } from '../data/models.js';
import { addJob } from '../data/storage.js';
import { extractJobAttributes, calculateProfileMatch } from '../services/jobClassifier';

const PLATFORMS_CONFIG = [
  {
    id: 'reddit',
    label: 'Reddit',
    subtext: 'r/forhire, r/freelance, r/FindVideoEditors',
    icon: Radio,
    color: 'text-[#FF4500]',
    bgColor: 'bg-[#FF4500]/10',
    borderColor: 'hover:border-[#FF4500]/50',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    subtext: 'Search creator & client hiring videos',
    icon: Youtube,
    color: 'text-[#FF0000]',
    bgColor: 'bg-[#FF0000]/10',
    borderColor: 'hover:border-[#FF0000]/50',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    subtext: 'Public hiring tweets from founders & creators',
    icon: MessageSquare,
    color: 'text-text-primary',
    bgColor: 'bg-surface-hover',
    borderColor: 'hover:border-primary/50',
  },
  {
    id: 'facebook_group',
    label: 'Facebook Groups',
    subtext: 'Public freelancer & client groups',
    icon: Facebook,
    color: 'text-[#1877F2]',
    bgColor: 'bg-[#1877F2]/10',
    borderColor: 'hover:border-[#1877F2]/50',
  },
  {
    id: 'manual_import',
    label: 'Manual Job Import',
    subtext: 'Paste any job title, URL & description',
    icon: FilePlus2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'hover:border-primary',
  },
];

const SUGGESTIONS = {
  reddit: ['r/forhire', 'r/freelance', 'r/FindVideoEditors', 'r/VideoEditing'],
  youtube: ['video editor hiring', 'looking for video editor', 'youtube editor needed', 'hire video editor'],
  x: ['video editor hiring', '"video editor" needed', 'looking for video editor', 'motion designer hiring'],
};

export default function AddSourceModal({
  isOpen,
  onClose,
  initialPlatform = null,
  onAdded,
}) {
  const { addSource, refreshSource } = useSources();
  const { profile } = useProfile();

  const [step, setStep] = useState(initialPlatform ? 2 : 1);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || 'reddit');
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset when opening
  React.useEffect(() => {
    if (isOpen) {
      if (initialPlatform) {
        setSelectedPlatform(initialPlatform);
        setStep(2);
      } else {
        setStep(1);
      }
      setInputVal('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialPlatform]);

  const handleSelectPlatform = (platformId) => {
    setSelectedPlatform(platformId);
    setError('');
    setInputVal('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!inputVal.trim()) {
      setError('Please provide a valid input to continue.');
      return;
    }

    setLoading(true);

    try {
      let sourceData = null;

      if (selectedPlatform === 'reddit') {
        const check = redditService.validateSubreddit(inputVal);
        if (!check.isValid) {
          setError('Please enter a valid subreddit (e.g. r/FindVideoEditors or r/forhire).');
          setLoading(false);
          return;
        }
        sourceData = {
          platform: 'reddit',
          type: 'reddit_subreddit',
          name: check.cleanedName,
          url: `https://reddit.com/${check.cleanedName}`,
          query: check.cleanedName,
        };
      } else if (selectedPlatform === 'youtube') {
        const clean = inputVal.trim();
        sourceData = {
          platform: 'youtube',
          type: 'youtube_search',
          name: `YouTube: "${clean}"`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`,
          query: clean,
        };
      } else if (selectedPlatform === 'x') {
        const clean = inputVal.trim();
        sourceData = {
          platform: 'x',
          type: 'x_search',
          name: `X: "${clean}"`,
          url: `https://x.com/search?q=${encodeURIComponent(clean)}`,
          query: clean,
        };
      } else if (selectedPlatform === 'facebook_group') {
        if (!isValidFacebookGroupUrl(inputVal)) {
          setError('Please enter a valid public Facebook Group URL.');
          setLoading(false);
          return;
        }
        sourceData = {
          platform: 'facebook_group',
          type: 'facebook_manual',
          name: 'Facebook Group',
          url: inputVal.trim(),
        };
      }

      if (sourceData) {
        const created = addSource(sourceData);
        // Instant check & ingest
        await refreshSource(created.id);
        toast.success(`${created.name} added and synced!`);
        onAdded?.(created);
        onClose();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to add source. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? 'Add Job Source' : `Configure ${selectedPlatform.toUpperCase()} Source`}
    >
      {step === 1 ? (
        /* STEP 1: SELECT PLATFORM */
        <div className="space-y-2.5">
          <p className="text-xs text-text-secondary mb-3">
            Choose where Tinder for Freelancers should look for relevant client posts:
          </p>
          {PLATFORMS_CONFIG.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPlatform(p.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border border-border bg-surface ${p.borderColor} hover:bg-surface-hover transition-all text-left group`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${p.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={p.color} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors">
                      {p.label}
                    </h4>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">{p.subtext}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-text-muted group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      ) : (
        /* STEP 2: CONFIGURE SELECTED PLATFORM */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-primary font-medium hover:underline"
            >
              ← Choose different platform
            </button>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
              Step 2 of 2
            </span>
          </div>

          {selectedPlatform === 'reddit' && (
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Subreddit Name or URL
              </label>
              <Input
                placeholder="e.g. r/FindVideoEditors or r/forhire"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                error={error}
                autoFocus
              />
              <div className="mt-2.5">
                <span className="text-[11px] text-text-muted block mb-1.5">Suggested Subreddits:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.reddit.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setInputVal(sub)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        inputVal === sub
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedPlatform === 'youtube' && (
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Hiring Search Query
              </label>
              <Input
                placeholder="e.g. video editor hiring, looking for video editor"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                error={error}
                autoFocus
              />
              <div className="mt-2.5">
                <span className="text-[11px] text-text-muted block mb-1.5">Suggested Searches:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.youtube.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInputVal(q)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        inputVal === q
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedPlatform === 'x' && (
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Public Search Query
              </label>
              <Input
                placeholder="e.g. video editor hiring, editor needed"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                error={error}
                autoFocus
              />
              <div className="mt-2.5">
                <span className="text-[11px] text-text-muted block mb-1.5">Suggested Queries:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.x.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInputVal(q)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        inputVal === q
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedPlatform === 'facebook_group' && (
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Public Facebook Group Link
              </label>
              <Input
                placeholder="https://www.facebook.com/groups/..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                error={error}
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                Accepts standard group links and share links (/share/g/...). In V2, opportunities from Facebook can also be imported via manual post links.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button variant="primary" fullWidth loading={loading} type="submit">
              + Save & Connect Source
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

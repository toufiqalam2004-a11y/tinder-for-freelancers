import React, { useState } from 'react';
import { Sparkles, Link2, FileText, User } from 'lucide-react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { DEMO_SAMPLE_POSTS } from '../services/jobClassifier';

export default function ImportPostModal({
  isOpen,
  onClose,
  onImport,
  source,
}) {
  const [postUrl, setPostUrl] = useState('');
  const [postText, setPostText] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoadSample = (sample) => {
    setPostUrl(sample.postUrl);
    setPostText(sample.text);
    setAuthor(sample.author);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!postText.trim()) {
      setError('Please paste or enter the Facebook post text.');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate AI pipeline detection
    setTimeout(() => {
      const result = onImport({
        source,
        postUrl: postUrl.trim() || source?.groupUrl || 'https://facebook.com',
        postText: postText.trim(),
        author: author.trim() || 'Facebook Group Member',
      });

      setLoading(false);
      // Reset
      setPostUrl('');
      setPostText('');
      setAuthor('');
      onClose();
    }, 400);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Post Link">
      <p className="text-xs text-text-secondary -mt-2 mb-4 leading-relaxed">
        Paste the link or text of a specific Facebook group hiring post. The AI pipeline will extract the job details and calculate match percentage.
      </p>

      {/* Quick Sample Selector */}
      <div className="mb-4 bg-surface-hover/80 border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary-light" />
            Try a Sample Hiring Post:
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {DEMO_SAMPLE_POSTS.map((sample, idx) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleLoadSample(sample)}
              className="text-left text-xs bg-surface border border-border/80 hover:border-primary/50 text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg transition-colors truncate"
            >
              #{idx + 1}: {sample.text.slice(0, 50)}...
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Post URL"
          placeholder="https://www.facebook.com/groups/.../posts/123"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
        />

        <Input
          label="Author / Poster Name"
          placeholder="e.g. Alex Rivera (Producer)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />

        <div>
          <label className="block text-sm text-text-secondary mb-1.5 font-medium">
            Post Content / Text <span className="text-error">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Paste the hiring post text here (e.g. 'We are hiring a freelance YouTube Video Editor...')"
            value={postText}
            onChange={(e) => {
              setPostText(e.target.value);
              setError('');
            }}
            className="w-full bg-surface-hover border border-border rounded-input px-3.5 py-2.5 text-text-primary text-sm placeholder-text-muted outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
          >
            <Sparkles size={16} className="mr-1.5" />
            Run AI Job Detection
          </Button>
        </div>
      </form>
    </Modal>
  );
}

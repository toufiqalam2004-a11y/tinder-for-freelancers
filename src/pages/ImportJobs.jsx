import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Facebook,
  Linkedin,
  MessageSquare,
  Instagram,
  AtSign,
  Youtube,
  Radio,
  FilePlus2,
  Plus,
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import AddSourceModal from '../components/AddSourceModal';

const ImportJobs = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlatform, setModalPlatform] = useState(null);

  const handleOpenModal = (platform) => {
    setModalPlatform(platform);
    setModalOpen(true);
  };

  const handleSourceAdded = () => {
    navigate('/sources');
  };

  return (
    <PageTransition>
      <div className="px-6 py-6 pb-28 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => navigate(-1)}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Connect Job Sources</h1>
            <p className="text-text-secondary text-sm mt-1">
              Add platforms where your clients post hiring opportunities.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {/* 1. Reddit (Available in V2) */}
          <Card className="border border-border/80 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF4500]/15 flex items-center justify-center flex-shrink-0">
                  <Radio className="text-[#FF4500]" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">Reddit</h3>
                    <StatusBadge status="Available" variant="success" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Monitor subreddits like r/FindVideoEditors, r/forhire, or r/freelance.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => handleOpenModal('reddit')}
              >
                + Add Subreddit
              </Button>
            </div>
          </Card>

          {/* 2. YouTube (Available in V2) */}
          <Card className="border border-border/80 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF0000]/15 flex items-center justify-center flex-shrink-0">
                  <Youtube className="text-[#FF0000]" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">YouTube</h3>
                    <StatusBadge status="Available" variant="success" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Discover client videos hiring video editors, designers & animators.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => handleOpenModal('youtube')}
              >
                + Add Search
              </Button>
            </div>
          </Card>

          {/* 3. X / Twitter (Available in V2) */}
          <Card className="border border-border/80 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0 border border-border">
                  <MessageSquare className="text-text-primary" size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">X (Twitter)</h3>
                    <StatusBadge status="Available" variant="success" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Track public posts and tweets from founders & creators actively hiring.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => handleOpenModal('x')}
              >
                + Add Search
              </Button>
            </div>
          </Card>

          {/* 4. Manual Job Import (Available in V2) */}
          <Card className="border border-primary/40 bg-primary/5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <FilePlus2 className="text-primary" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">Manual Job Import</h3>
                    <StatusBadge status="Available" variant="success" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Paste any job URL, title, or post text to add directly to your swipe feed.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => navigate('/manual-import')}
              >
                + Import Job Manually
              </Button>
            </div>
          </Card>

          {/* 5. Facebook Groups (Manual Import Only in V2) */}
          <Card className="border border-border/80 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1877F2]/15 flex items-center justify-center flex-shrink-0">
                  <Facebook className="text-[#1877F2]" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">Facebook Groups</h3>
                    <StatusBadge status="Manual Only" variant="warning" />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Save group links. To comply with Meta policies, post links are imported manually.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => handleOpenModal('facebook_group')}
              >
                + Add Facebook Group
              </Button>
            </div>
          </Card>

          {/* Future Sources: LinkedIn, Instagram, Threads */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2 px-1">
              Coming in Future Versions
            </span>
            <div className="space-y-2">
              <Card className="opacity-50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                      <Linkedin className="text-[#0A66C2]" size={16} />
                    </div>
                    <span className="text-xs font-semibold text-text-primary">LinkedIn</span>
                  </div>
                  <StatusBadge status="Coming Soon" variant="muted" />
                </div>
              </Card>

              <Card className="opacity-50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E1306C]/10 flex items-center justify-center">
                      <Instagram className="text-[#E1306C]" size={16} />
                    </div>
                    <span className="text-xs font-semibold text-text-primary">Instagram</span>
                  </div>
                  <StatusBadge status="Coming Soon" variant="muted" />
                </div>
              </Card>

              <Card className="opacity-50 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center">
                      <AtSign className="text-text-primary" size={16} />
                    </div>
                    <span className="text-xs font-semibold text-text-primary">Threads</span>
                  </div>
                  <StatusBadge status="Coming Soon" variant="muted" />
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Unified Add Source Modal */}
        <AddSourceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialPlatform={modalPlatform}
          onAdded={handleSourceAdded}
        />
      </div>
    </PageTransition>
  );
};

export default ImportJobs;

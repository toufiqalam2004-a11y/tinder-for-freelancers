import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  Plus,
  Facebook,
  Radio,
  Youtube,
  MessageSquare,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FilePlus2,
  RefreshCw,
  Crown,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import SourceCard from '../components/SourceCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import Card from '../components/Card';
import AddSourceModal from '../components/AddSourceModal';
import UpgradeModal from '../components/UpgradeModal';
import { useSources } from '../contexts/SourcesContext';
import { isDemoMode, setDemoMode } from '../data/storage';
import { subscriptionService } from '../services/subscriptionService';

const Sources = () => {
  const navigate = useNavigate();
  const { sources, removeSource, toggleSourceEnabled } = useSources();
  const [demoMode, setDemoState] = useState(() => isDemoMode());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const handleOpenAddModal = () => {
    const check = subscriptionService.canAddSource(sources.length);
    if (!check.allowed) {
      setUpgradeReason(check.reason);
      setShowUpgradeModal(true);
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleToggleDemo = () => {
    const next = !demoMode;
    setDemoState(next);
    setDemoMode(next);
    toast.success(next ? 'Demo Mode enabled (simulated data)' : 'Live API Mode enabled');
    setRefreshKey((k) => k + 1);
  };

  const handleRemove = (id) => {
    if (window.confirm('Are you sure you want to remove this source?')) {
      removeSource(id);
      toast.success('Source removed.');
      setRefreshKey((k) => k + 1);
    }
  };

  const handleToggle = (id) => {
    toggleSourceEnabled(id);
    toast('Source updated.', { icon: '⚙️' });
    setRefreshKey((k) => k + 1);
  };

  // Grouped counts
  const fbCount = sources.filter((s) => s.platform === 'facebook_group').length;
  const redditCount = sources.filter((s) => s.platform === 'reddit').length;
  const youtubeCount = sources.filter((s) => s.platform === 'youtube').length;
  const xCount = sources.filter((s) => s.platform === 'x').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <div className="px-6 py-6 pb-28 max-w-md mx-auto" key={refreshKey}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Job Sources</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {sources.length} active connection{sources.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            className="text-xs"
          >
            <Plus size={15} className="mr-1" />
            Add Source
          </Button>
        </div>

        {/* Demo Mode Configuration Bar */}
        <div className="mt-4 bg-surface-hover/80 border border-border rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-light" />
            <div>
              <span className="text-xs font-semibold text-text-primary block">
                {demoMode ? 'Demo Mode Active' : 'Live API Mode'}
              </span>
              <span className="text-[10px] text-text-muted">
                {demoMode
                  ? 'Simulated hiring opportunities without API keys'
                  : 'Official Reddit, YouTube & X live API calls'}
              </span>
            </div>
          </div>
          <button
            onClick={handleToggleDemo}
            className="text-text-secondary hover:text-text-primary p-1 transition-colors"
            title="Toggle Demo Mode"
          >
            {demoMode ? (
              <ToggleRight size={28} className="text-primary-light" />
            ) : (
              <ToggleLeft size={28} className="text-text-muted" />
            )}
          </button>
        </div>

        {/* Connected Sources Overview Grid */}
        <div className="mt-4">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-2">
            Platforms Connected
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface border border-border rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF4500]/15 flex items-center justify-center flex-shrink-0">
                <Radio className="text-[#FF4500]" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-text-muted block truncate">Reddit</span>
                <span className="text-xs font-bold text-text-primary">{redditCount} sources</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF0000]/15 flex items-center justify-center flex-shrink-0">
                <Youtube className="text-[#FF0000]" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-text-muted block truncate">YouTube</span>
                <span className="text-xs font-bold text-text-primary">{youtubeCount} searches</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0 border border-border">
                <MessageSquare className="text-text-primary" size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-text-muted block truncate">X (Twitter)</span>
                <span className="text-xs font-bold text-text-primary">{xCount} searches</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1877F2]/15 flex items-center justify-center flex-shrink-0">
                <Facebook className="text-[#1877F2]" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-text-muted block truncate">Facebook Groups</span>
                <span className="text-xs font-bold text-text-primary">{fbCount} sources</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sources List */}
        <div className="mt-6">
          {sources.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No sources connected yet"
              subtitle="Add Reddit, YouTube, X, or Facebook groups to discover opportunities."
              action={{
                label: '+ Connect First Source',
                onClick: () => setIsAddModalOpen(true),
              }}
            />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {sources.map((source) => (
                <motion.div key={source.id} variants={itemVariants}>
                  <SourceCard
                    source={source}
                    onView={() => navigate(`/source/${source.id}`)}
                    onRemove={() => handleRemove(source.id)}
                    onToggleEnabled={() => handleToggle(source.id)}
                    onRefreshed={() => setRefreshKey((k) => k + 1)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Add Source Modal */}
        <AddSourceModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdded={() => setRefreshKey((k) => k + 1)}
        />

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="Source Limit Reached"
          message={upgradeReason}
        />
      </div>
    </PageTransition>
  );
};

export default Sources;

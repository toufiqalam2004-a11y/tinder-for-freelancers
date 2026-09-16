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
  Crown,
  Lock,
  AlertTriangle,
  Info,
  ShieldCheck,
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
import { isDemoMode, setDemoMode } from '../data/storage.js';
import { subscriptionService } from '../services/subscriptionService';
import { getCustomSourceLimit } from '../utils/sourceConfig.js';
import { toCanonicalPlan } from '../utils/planUtils.js';

const Sources = () => {
  const navigate = useNavigate();
  const { sources, builtinSources, customSources, removeSource, toggleSourceEnabled } = useSources();
  const [demoMode, setDemoState] = useState(() => isDemoMode());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const currentPlanDetails = subscriptionService.getCurrentPlanDetails();
  const canonicalPlan = toCanonicalPlan(currentPlanDetails.id);
  const planLimit = getCustomSourceLimit(canonicalPlan);
  const customCount = customSources.length;
  const isLimitReached = customCount >= planLimit;
  const isOverLimit = customCount > planLimit;

  const handleOpenAddModal = () => {
    const check = subscriptionService.canAddSource(customCount);
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

  const handleRemove = async (id) => {
    if (window.confirm('Are you sure you want to remove this source?')) {
      await removeSource(id);
      toast.success('Source removed. Slot has been freed.');
      setRefreshKey((k) => k + 1);
    }
  };

  const handleToggle = (id) => {
    toggleSourceEnabled(id);
    toast('Source updated.', { icon: '⚙️' });
    setRefreshKey((k) => k + 1);
  };

  // Grouped counts across all active sources
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
            <h1 className="text-2xl font-bold text-text-primary">Sources</h1>
            <p className="text-text-secondary text-xs mt-0.5">
              Add sources to discover opportunities that match your profile.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            disabled={isLimitReached}
            className="text-xs"
          >
            <Plus size={15} className="mr-1" />
            Add Source
          </Button>
        </div>

        {/* Custom Source Quota Usage Bar */}
        <div className="mt-4 bg-surface border border-border rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                My Sources
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                {currentPlanDetails.name}: {customCount} / {planLimit}
              </span>
            </div>
            {isLimitReached && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {isOverLimit ? 'Over Limit' : 'Limit Reached'}
              </span>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden border border-border/50">
            <div
              className={`h-full transition-all duration-300 ${
                isOverLimit
                  ? 'bg-rose-500'
                  : isLimitReached
                  ? 'bg-amber-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, (customCount / planLimit) * 100)}%` }}
            />
          </div>

          {/* Quota notices */}
          {isOverLimit ? (
            <div className="mt-2.5 flex items-start gap-2 text-xs text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                You currently have <strong>{customCount}</strong> custom sources, which exceeds the {currentPlanDetails.name} plan limit of <strong>{planLimit}</strong>. Your existing sources remain active, but you cannot add new ones until you upgrade or remove excess sources.
              </span>
            </div>
          ) : isLimitReached ? (
            <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <Info size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                You have reached the maximum allowed custom sources ({planLimit}) for the {currentPlanDetails.name} plan. Upgrade your subscription to connect more sources.
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted mt-2">
              Free plan allows 1 custom source, Plus allows 3, and Pro allows 5.
            </p>
          )}
        </div>

        {/* MY SOURCES (CUSTOM USER SOURCES) LIST */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Connected Custom Sources</h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                {customCount} of {planLimit} slots used
              </p>
            </div>
            {isLimitReached && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUpgradeReason(subscriptionService.canAddSource(customCount).reason);
                  setShowUpgradeModal(true);
                }}
                className="text-[11px] !py-1 !px-2.5 text-primary border-primary/30"
              >
                <Crown size={12} className="mr-1" />
                Upgrade
              </Button>
            )}
          </div>

          {customSources.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No custom sources added yet"
              subtitle={`You have ${planLimit} custom source slot${planLimit === 1 ? '' : 's'} available on your ${currentPlanDetails.name} plan.`}
              action={{
                label: '+ Connect Custom Source',
                onClick: handleOpenAddModal,
              }}
            />
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3 mt-3"
            >
              {customSources.map((source) => (
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
          title="Custom Source Limit"
          message={upgradeReason}
        />
      </div>
    </PageTransition>
  );
};

export default Sources;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Building2,
  Calendar,
  ChevronRight,
  Edit3,
  TrendingUp,
  Clock,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Sliders,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import PageTransition from '../components/PageTransition';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { subscriptionService } from '../services/subscriptionService';
import { usageService } from '../services/usageService';
import StatusUpdateModal from '../components/StatusUpdateModal';
import {
  getApplications,
  updateApplication,
  getApplicationAnalytics,
  getFunnelAnalytics,
  getAutoDeletePreference,
  setAutoDeletePreference,
  cleanupOldApplications,
  isDemoMode,
  getCurrentUserId,
} from '../data/storage.js';
import { APPLICATION_STATUS_CONFIG } from '../utils/constants';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'applied', label: 'Applied' },
  { id: 'saved', label: 'Saved' },
  { id: 'viewed', label: 'Viewed' },
];

const Applications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [applications, setApplications] = useState(() => {
    try {
      return getApplications() || [];
    } catch {
      return [];
    }
  });
  const [analytics, setAnalytics] = useState(() => {
    try {
      return getApplicationAnalytics() || {};
    } catch {
      return {};
    }
  });
  const [funnel, setFunnel] = useState(() => {
    try {
      return getFunnelAnalytics() || { rates: {} };
    } catch {
      return { rates: {} };
    }
  });
  const [showFunnelDetail, setShowFunnelDetail] = useState(true);
  const [selectedAppForStatus, setSelectedAppForStatus] = useState(null);

  // Application auto-delete preferences state
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(() => {
    try {
      return Boolean(getAutoDeletePreference());
    } catch {
      return false;
    }
  });
  const [showPreferencesSection, setShowPreferencesSection] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const refreshApplications = (silent = false) => {
    try {
      setLoadError(null);
      // If auto-delete is enabled, sweep old applications first
      if (getAutoDeletePreference()) {
        try {
          const cleanupRes = cleanupOldApplications();
          if (cleanupRes && cleanupRes.deletedCount > 0 && !silent) {
            toast('Some old applications were automatically removed.', { icon: '🧹' });
          }
        } catch (cleanupErr) {
          console.warn('[Applications] Auto-delete sweep warning:', cleanupErr);
        }
      }
      setApplications(getApplications() || []);
      setAnalytics(getApplicationAnalytics() || {});
      setFunnel(getFunnelAnalytics() || { rates: {} });
    } catch (err) {
      console.error('[Applications] Error loading applications:', err);
      setLoadError(err?.message || 'Failed to load applications');
    }
  };

  useEffect(() => {
    refreshApplications(false);

    const handleDataChange = () => {
      refreshApplications(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('tf_applications_changed', handleDataChange);
      window.addEventListener('tf_job_state_changed', handleDataChange);
      window.addEventListener('storage', handleDataChange);
      return () => {
        window.removeEventListener('tf_applications_changed', handleDataChange);
        window.removeEventListener('tf_job_state_changed', handleDataChange);
        window.removeEventListener('storage', handleDataChange);
      };
    }
  }, []);

  const handleToggleAutoDelete = (nextValue) => {
    if (nextValue === autoDeleteEnabled) return;

    if (nextValue) {
      // Show required user confirmation modal before enabling
      setShowConfirmModal(true);
    } else {
      try {
        setAutoDeletePreference(false);
      } catch (err) {
        console.warn('Could not set auto-delete pref:', err);
      }
      setAutoDeleteEnabled(false);
      toast.success('Auto-delete applications disabled.');
    }
  };

  const confirmEnableAutoDelete = () => {
    try {
      setAutoDeletePreference(true);
    } catch (err) {
      console.warn('Could not set auto-delete pref:', err);
    }
    setAutoDeleteEnabled(true);
    setShowConfirmModal(false);

    if (isDemoMode()) {
      toast.success('Demo: application auto-delete enabled');
    } else {
      toast.success('Auto-delete enabled (7-day rule active)');
    }

    // Trigger cleanup immediately
    try {
      const res = cleanupOldApplications(true);
      if (res && res.deletedCount > 0) {
        toast('Some old applications were automatically removed.', { icon: '🧹' });
      }
    } catch (err) {
      console.warn('Cleanup error:', err);
    }
    refreshApplications(true);
  };

  const handleStatusUpdate = (appId, newStatus, note) => {
    try {
      updateApplication(appId, { status: newStatus, statusNote: note });
      toast.success(`Status updated to ${newStatus}`);
      refreshApplications();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const formatAppliedDate = (dateVal, status) => {
    if ((status || '').toLowerCase() === 'saved') return 'Saved';
    if (!dateVal || (status || '').toLowerCase() === 'draft') return 'Draft (Unsent)';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Draft (Unsent)';
      return `Applied ${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    } catch {
      return 'Draft (Unsent)';
    }
  };

  const currentUid = getCurrentUserId();
  const safeApps = Array.isArray(applications) ? applications : [];
  const filteredApps = safeApps.filter((app) => {
    if (!app) return false;
    if (currentUid !== 'user-default') {
      if (app.userId !== currentUid) return false;
    } else {
      if (app.userId && app.userId !== 'user-default') return false;
    }
    if (activeTab === 'all') return true;
    return (app.status || 'applied').toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <PageTransition>
      <div className="px-5 py-6 pb-28 max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Applications</h1>
            <p className="text-text-secondary text-xs mt-0.5">Track your pipeline, funnel & performance</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/jobs')}
              className="text-xs px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
            >
              + Find Jobs
            </button>
          </div>
        </div>

        {/* Section 0: Quota & Available Applications Status */}
        {(() => {
          try {
            const plan = subscriptionService?.getCurrentPlanDetails?.() || { name: 'Free', id: 'free' };
            const quotaStatus = usageService?.getQuotaStatus?.() || {
              limit: 5,
              used: 0,
              remainingQuota: 5,
              refillFormatted: '8h 00m',
              bonusTokens: 0,
              availableApplications: 5,
              isExhausted: false,
            };
            const limit = Number(quotaStatus?.limit) || 5;
            const used = Number(quotaStatus?.used) || 0;
            const remainingQuota = quotaStatus?.remainingQuota !== undefined ? Number(quotaStatus.remainingQuota) : 0;
            const refillFormatted = quotaStatus?.refillFormatted || '8h 00m';
            const bonusTokens = Number(quotaStatus?.bonusTokens) || 0;
            const isExhausted = Boolean(quotaStatus?.isExhausted);
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const availableTotal = quotaStatus?.availableApplications !== undefined ? quotaStatus.availableApplications : (remainingQuota + bonusTokens);

            return (
              <Card className="mt-4 p-3.5 bg-surface border border-border shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Crown size={15} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-text-primary">
                        {plan?.name || 'Free'} Plan Quota
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Applications: <strong className="text-text-primary font-bold">{used} / {limit}</strong> • Refreshes in: <strong className="text-primary">{refillFormatted}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/membership')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                  >
                    <span>{isExhausted ? 'Upgrade / Top-Up' : 'Manage'}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* Mini progress bar */}
                <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {isExhausted && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between font-medium">
                    <span className="font-bold">Application quota exhausted</span>
                    <span>Next refill in {refillFormatted}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
                  <span>
                    Remaining quota: <strong className="text-primary font-bold">{remainingQuota}</strong>
                  </span>
                  <span>
                    {bonusTokens > 0 ? (
                      <span className="text-amber-500 font-bold">Bonus Tokens: +{bonusTokens}</span>
                    ) : (
                      <span>Available total: <strong className="text-text-primary font-bold">{availableTotal}</strong></span>
                    )}
                  </span>
                </div>
              </Card>
            );
          } catch (quotaErr) {
            console.warn('[Applications] Quota status fallback:', quotaErr);
            return null;
          }
        })()}



        {/* Section 2: Tab Bar */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover text-text-muted hover:text-text-secondary border border-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Section 3: Applications List */}
        <div className="mt-4 flex-1">
          {loadError ? (
            <Card className="p-6 text-center border-rose-500/30 bg-rose-500/5 space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-text-primary">Unable to load applications</h3>
              <p className="text-xs text-text-secondary">{loadError}</p>
              <Button variant="secondary" size="sm" onClick={() => refreshApplications(false)}>
                Retry
              </Button>
            </Card>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredApps.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={activeTab === 'all' ? 'No applications yet' : `No ${activeTab} applications`}
              subtitle={
                activeTab === 'all'
                  ? 'Your applied jobs will appear here. Use AI Apply on any job in your feed to craft personalized proposals.'
                  : `No applications found with status "${activeTab}".`
              }
              action={activeTab === 'all' ? { label: 'Explore Job Feed', onClick: () => navigate('/jobs') } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredApps.map((app) => {
                if (!app || !app.id) return null;
                const statusMeta = APPLICATION_STATUS_CONFIG[app.status?.toLowerCase()] || {
                  label: app.status || 'Applied',
                  color: 'text-text-primary',
                  bg: 'bg-surface-hover',
                  border: 'border-border',
                };

                return (
                  <Card
                    key={app.id}
                    className="p-4 hover:border-primary/40 transition-colors cursor-pointer relative group"
                    onClick={() => navigate(`/application/${app.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-text-primary leading-snug truncate">
                          {app.title || app.jobTitle || 'Untitled Opportunity'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                          <Building2 size={13} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{app.company || 'Direct Client'}</span>
                          <span className="text-text-muted">•</span>
                          <span className="capitalize text-primary">{(app.platform || 'manual').replace('_', ' ')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppForStatus(app);
                        }}
                        className="flex items-center gap-1 p-1 -mr-1 rounded-lg hover:bg-surface-hover transition-colors"
                        title="Update status"
                      >
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusMeta.color || ''} ${statusMeta.bg || ''} ${statusMeta.border || 'border-border'}`}
                        >
                          {statusMeta.label}
                        </span>
                        <Edit3 size={12} className="text-text-muted hover:text-text-primary ml-1" />
                      </button>
                    </div>

                    {/* Message Snippet */}
                    {app.message && (
                      <p className="text-[11px] text-text-secondary line-clamp-2 mt-2.5 bg-surface-hover p-2.5 rounded-lg border border-border/60 italic font-sans">
                        "{app.message}"
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border text-[11px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatAppliedDate(app.appliedAt, app.status)}
                      </span>

                      <div className="flex items-center gap-2">
                        {app.matchScore && (
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Sparkles size={11} />
                            {app.matchScore}% Match
                          </span>
                        )}
                        <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Update Modal */}
        <StatusUpdateModal
          isOpen={!!selectedAppForStatus}
          onClose={() => setSelectedAppForStatus(null)}
          application={selectedAppForStatus}
          onStatusUpdate={handleStatusUpdate}
        />

        {/* User Warning Confirmation Modal */}
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Enable Auto-Delete"
        >
          <div className="space-y-3.5 pt-1 text-text-primary">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-sm font-bold text-text-primary">
                Applications older than 7 days may be automatically deleted.
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                Calculation is based on each application's last update date (<code>updatedAt</code>). Applications will be safely moved to trash.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-surface-hover border border-border text-[11px] text-text-muted space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck size={13} />
                <span>Always Protected & Retained:</span>
              </div>
              <p className="text-[10px] pl-4 text-text-secondary">
                Interview • Shortlisted • Negotiation • Hired
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={confirmEnableAutoDelete}
              >
                Enable
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

export default Applications;

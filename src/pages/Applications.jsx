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
  { id: 'saved', label: 'Saved' },
  { id: 'draft', label: 'Drafts' },
  { id: 'applied', label: 'Applied' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'replied', label: 'Replied' },
  { id: 'interview', label: 'Interview' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'hired', label: 'Hired' },
  { id: 'closed', label: 'Closed' },
];

const Applications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [applications, setApplications] = useState(() => getApplications());
  const [analytics, setAnalytics] = useState(() => getApplicationAnalytics());
  const [funnel, setFunnel] = useState(() => getFunnelAnalytics());
  const [showFunnelDetail, setShowFunnelDetail] = useState(true);
  const [selectedAppForStatus, setSelectedAppForStatus] = useState(null);

  // Application auto-delete preferences state
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(() => getAutoDeletePreference());
  const [showPreferencesSection, setShowPreferencesSection] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const refreshApplications = (silent = false) => {
    // If auto-delete is enabled, sweep old applications first
    if (getAutoDeletePreference()) {
      const cleanupRes = cleanupOldApplications();
      if (cleanupRes.deletedCount > 0 && !silent) {
        toast('Some old applications were automatically removed.', { icon: '🧹' });
      }
    }
    setApplications(getApplications());
    setAnalytics(getApplicationAnalytics());
    setFunnel(getFunnelAnalytics());
  };

  useEffect(() => {
    refreshApplications(false);
  }, []);

  const handleToggleAutoDelete = (nextValue) => {
    if (nextValue === autoDeleteEnabled) return;

    if (nextValue) {
      // Show required user confirmation modal before enabling
      setShowConfirmModal(true);
    } else {
      setAutoDeletePreference(false);
      setAutoDeleteEnabled(false);
      toast.success('Auto-delete applications disabled.');
    }
  };

  const confirmEnableAutoDelete = () => {
    setAutoDeletePreference(true);
    setAutoDeleteEnabled(true);
    setShowConfirmModal(false);

    if (isDemoMode()) {
      toast.success('Demo: application auto-delete enabled');
    } else {
      toast.success('Auto-delete enabled (7-day rule active)');
    }

    // Trigger cleanup immediately
    const res = cleanupOldApplications(true);
    if (res.deletedCount > 0) {
      toast('Some old applications were automatically removed.', { icon: '🧹' });
    }
    refreshApplications(true);
  };

  const handleStatusUpdate = (appId, newStatus, note) => {
    updateApplication(appId, { status: newStatus, statusNote: note });
    toast.success(`Status updated to ${newStatus}`);
    refreshApplications();
  };

  const currentUid = getCurrentUserId();
  const filteredApps = applications.filter((app) => {
    if (app.userId && app.userId !== currentUid && app.userId !== 'user-default') return false;
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
              type="button"
              onClick={() => setShowPreferencesSection(!showPreferencesSection)}
              className={`text-xs px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold transition-all ${
                showPreferencesSection || autoDeleteEnabled
                  ? 'border-primary bg-primary/10 text-primary shadow-xs'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              title="Application Preferences & Auto-delete"
              aria-label="Application Settings"
            >
              <Sliders size={13} />
              <span>Settings</span>
              {autoDeleteEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>

            <button
              onClick={() => navigate('/jobs')}
              className="text-xs px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
            >
              + Find Jobs
            </button>
          </div>
        </div>

        {/* APPLICATION PREFERENCES */}
        {showPreferencesSection && (
          <Card className="mt-4 p-4 bg-surface border border-border shadow-card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/70">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Sliders size={14} className="text-primary" /> Application Preferences
              </span>
              <button
                type="button"
                onClick={() => setShowPreferencesSection(false)}
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-hover/70 border border-border space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Trash2 size={13} className="text-primary" />
                    <span>Auto-delete applications</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Automatically remove applications that haven't been updated for 7 days.
                  </p>
                  <div className="text-[10px] text-text-muted mt-1">
                    Status:{' '}
                    <strong className={autoDeleteEnabled ? 'text-primary font-bold' : 'text-text-secondary'}>
                      {autoDeleteEnabled ? 'ON — Deletes old applications after 7 days.' : 'OFF'}
                    </strong>
                  </div>
                </div>

                {/* Clear ON / OFF Toggle Buttons */}
                <div
                  role="radiogroup"
                  aria-label="Auto-delete applications after 7 days"
                  className="flex items-center bg-surface border border-border rounded-xl p-0.5 flex-shrink-0"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!autoDeleteEnabled}
                    onClick={() => handleToggleAutoDelete(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !autoDeleteEnabled
                        ? 'bg-text-secondary text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    OFF
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={autoDeleteEnabled}
                    onClick={() => handleToggleAutoDelete(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      autoDeleteEnabled
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    ON
                  </button>
                </div>
              </div>

              {/* Protection Guarantee Info */}
              <div className="pt-2.5 border-t border-border/80 flex items-start gap-2 text-[10px] text-text-muted leading-relaxed">
                <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Protected from deletion:</strong> Applications with active statuses (<em>Interview</em>, <em>Shortlisted</em>, <em>Negotiation</em>, <em>Hired</em>) are permanently retained and never deleted.
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Section 0: Today's Quota & Credit Status */}
        {(() => {
          const plan = subscriptionService.getCurrentPlanDetails();
          const usage = usageService.getTodayUsage();
          const credits = usageService.getCreditsSummary();
          const dailyLimit = plan.limits.applicationsPerDay;
          const usedToday = usage.applicationsUsed || 0;
          const remainingDaily = Math.max(0, dailyLimit - usedToday);
          const pct = Math.min(100, Math.round((usedToday / dailyLimit) * 100));

          return (
            <Card className="mt-4 p-3.5 bg-surface border border-border shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Crown size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text-primary">
                      {plan.name} Plan Quota
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      {usedToday} / {dailyLimit} applications used today
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/membership')}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                >
                  <span>{remainingDaily === 0 ? 'Upgrade / Top-Up' : 'Manage'}</span>
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

              <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
                <span>
                  Remaining today: <strong className="text-primary font-bold">{remainingDaily}</strong>
                </span>
                <span>
                  Extra credits: <strong className="text-amber-500 font-bold">{credits.activeCredits}</strong>
                </span>
              </div>
            </Card>
          );
        })()}

        {/* Section 1: Visual Conversion Funnel (V4) */}
        <Card className="mt-4 p-4 border-primary/25 bg-surface">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <TrendingUp size={14} className="text-primary" /> Application Pipeline Funnel
            </span>
            <button
              type="button"
              onClick={() => setShowFunnelDetail(!showFunnelDetail)}
              className="text-[11px] text-primary font-semibold hover:underline"
            >
              {showFunnelDetail ? 'Compact' : 'Expanded'}
            </button>
          </div>

          {/* Funnel Stages Horizontal Progression */}
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { label: 'Discovered', count: funnel.discoveredCount, color: 'text-text-secondary' },
              { label: 'Saved', count: funnel.savedCount, color: 'text-amber-500' },
              { label: 'Applied', count: funnel.appliedCount, color: 'text-blue-500' },
              { label: 'Responses', count: funnel.respondedCount, color: 'text-indigo-500' },
              { label: 'Interviews', count: funnel.interviewCount, color: 'text-emerald-500' },
            ].map((stage, idx) => (
              <div key={stage.label} className="p-2 rounded-xl bg-surface-hover border border-border">
                <span className="text-[10px] text-text-muted uppercase block truncate">{stage.label}</span>
                <span className={`text-base font-extrabold block mt-0.5 ${stage.color}`}>
                  {stage.count}
                </span>
              </div>
            ))}
          </div>

          {/* Rates Breakdown */}
          {showFunnelDetail && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-text-muted block">Application Rate</span>
                <span className="font-bold text-text-primary mt-0.5 block">
                  {funnel.rates.applicationRate}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Response Rate</span>
                <span className="font-bold text-primary mt-0.5 block">
                  {funnel.rates.responseRate}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Interview Rate</span>
                <span className="font-bold text-emerald-500 mt-0.5 block">
                  {funnel.rates.interviewRate}%
                </span>
              </div>
            </div>
          )}

          {/* AI Performance Insight Pill */}
          <div className="mt-3 p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-2 text-xs">
            <Sparkles size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-text-secondary leading-snug text-[11px]">
              {funnel.appliedCount >= 3
                ? `You have a ${funnel.rates.responseRate}% client response rate. Applications with portfolio links receive 2.4x more interview invitations.`
                : 'Send at least 3 personalized AI applications to unlock data-backed response trend insights.'}
            </p>
          </div>
        </Card>


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
          {filteredApps.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={activeTab === 'all' ? 'No applications yet' : `No ${activeTab} applications`}
              subtitle={
                activeTab === 'all'
                  ? 'Use AI Apply on any job in your feed to craft personalized proposals.'
                  : `No applications found with status "${activeTab}".`
              }
              action={activeTab === 'all' ? { label: 'Explore Job Feed', onClick: () => navigate('/jobs') } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredApps.map((app) => {
                const statusMeta = APPLICATION_STATUS_CONFIG[app.status?.toLowerCase()] || {
                  label: app.status || 'Applied',
                  color: 'text-text-primary',
                  bg: 'bg-surface-hover',
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
                          {app.title || app.jobTitle}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                          <Building2 size={13} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{app.company}</span>
                          <span className="text-text-muted">•</span>
                          <span className="capitalize text-primary">{app.platform?.replace('_', ' ')}</span>
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
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusMeta.color} ${statusMeta.bg} ${statusMeta.border}`}
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
                        {app.appliedAt
                          ? `Applied ${new Date(app.appliedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}`
                          : 'Draft (Unsent)'}
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

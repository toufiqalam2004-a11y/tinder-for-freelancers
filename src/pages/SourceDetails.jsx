import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Link2,
  Camera,
  ShieldAlert,
  Info,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import JobCard from '../components/JobCard';
import ImportPostModal from '../components/ImportPostModal';
import UploadScreenshotModal from '../components/UploadScreenshotModal';
import { useSources } from '../contexts/SourcesContext';
import { monitoringService } from '../services/monitoringService';
import {
  getJobs,
  updateJobStatus,
  addApplication,
  getPosts,
} from '../data/storage.js';

const SourceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getSourceById, removeSource } = useSources();

  const source = getSourceById(id);

  // Monitoring state
  const [monitoringData, setMonitoringData] = useState(() =>
    source ? monitoringService.getStatus(source.id) : null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [jobs, setJobs] = useState(() => (source ? getJobs(source.id) : []));
  const [posts, setPosts] = useState(() => (source ? getPosts(source.id) : []));

  // Modals for fallback flows
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);

  // Refresh local jobs/posts
  const refreshJobsAndPosts = useCallback(() => {
    if (source) {
      setJobs(getJobs(source.id));
      setPosts(getPosts(source.id));
      setMonitoringData(monitoringService.getStatus(source.id));
    }
  }, [source]);

  // Run initial or explicit check
  const handleTestMonitoring = async () => {
    if (!source) return;
    setIsChecking(true);

    try {
      // 1. Validate & check official Meta API
      const result = await monitoringService.checkSource(source);
      setMonitoringData(result);
      refreshJobsAndPosts();

      if (result.isFeasible) {
        toast.success('Official Meta API connection active!');
      } else {
        toast(
          'Automatic monitoring requires official Facebook permissions. Fallback options available.',
          {
            icon: 'ℹ️',
            duration: 4000,
          }
        );
      }
    } catch (err) {
      toast.error('Error testing monitoring endpoint');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRemove = () => {
    if (window.confirm('Are you sure you want to remove this source?')) {
      removeSource(source.id);
      toast.success('Source removed.');
      navigate('/sources');
    }
  };

  // Job Actions
  const handleSkipJob = (job) => {
    updateJobStatus(job.id, 'skipped');
    toast('Job skipped', { icon: '⏭️' });
    refreshJobsAndPosts();
  };

  const handleSaveJob = (job) => {
    updateJobStatus(job.id, 'saved');
    toast.success('Job saved to your feed!');
    refreshJobsAndPosts();
  };

  const handleApplyJob = (job) => {
    updateJobStatus(job.id, 'applied');
    addApplication({
      id: `app-${Date.now()}`,
      jobId: job.id,
      title: job.title,
      company: job.author || source.groupName,
      platform: job.platform || 'facebook_group',
      status: 'applied',
      appliedAt: new Date().toISOString(),
      matchScore: job.matchScore || 85,
    });
    toast.success('Application recorded! Added to Applications.');
    refreshJobsAndPosts();
  };

  // Fallback ingestion handler
  const handleIngestPost = (postPayload) => {
    const { post, job } = monitoringService.ingestPost(postPayload);
    refreshJobsAndPosts();

    if (job) {
      toast.success(`Hiring post detected! ${job.matchScore}% Profile Match`);
    } else {
      toast('Post added, but no clear hiring indicators were detected.', {
        icon: 'ℹ️',
      });
    }
  };

  if (!source) {
    return (
      <PageTransition>
        <div className="px-6 py-6 pb-24 max-w-md mx-auto text-center">
          <p className="text-text-secondary mt-10 mb-4">Source not found</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </PageTransition>
    );
  }

  const formattedDate = new Date(source.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedLastChecked = monitoringData?.lastChecked
    ? new Date(monitoringData.lastChecked).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  // Status indicators: 🟢 Active | 🟡 API Access Required | 🔴 Not Available
  const renderStatusBadge = () => {
    const status = monitoringData?.status || 'api_required';
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </span>
      );
    }
    if (status === 'not_available') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-error/15 text-error border border-error/30">
          <span className="w-2 h-2 rounded-full bg-error" />
          Not Available
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        API Access Required
      </span>
    );
  };

  const hasBeenTested = monitoringData?.hasBeenTested;

  const displayName = source.sourceName || source.groupName || 'Job Source';
  const displayUrl = source.sourceUrl || source.groupUrl || '';

  const getPlatformLabel = () => {
    switch (source.platform) {
      case 'reddit':
        return source.sourceType === 'search' ? 'Reddit Search' : 'Reddit Subreddit';
      case 'youtube':
        return 'YouTube Search Feed';
      case 'x':
        return 'X (Twitter) Public Search';
      default:
        return 'Facebook Public Group';
    }
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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary truncate">{displayName}</h1>
            <p className="text-xs text-text-muted">Source Details & Feasibility</p>
          </div>
        </div>

        {/* Source Metadata Card */}
        <Card className="mt-4 p-0 divide-y divide-border">
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted">Platform</span>
            <span className="text-text-primary font-medium">{getPlatformLabel()}</span>
          </div>
          {displayUrl && (
            <div className="px-4 py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted">Source URL / Query</span>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-light hover:underline max-w-[200px] truncate flex items-center gap-1 font-mono text-[11px]"
              >
                <span>{displayUrl}</span>
                <ExternalLink size={11} />
              </a>
            </div>
          )}
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted">Status</span>
            <StatusBadge status="Source Added" variant="success" />
          </div>
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted">Added</span>
            <span className="text-text-primary">{formattedDate}</span>
          </div>
          <div className="px-4 py-3 flex justify-between items-center text-xs">
            <span className="text-text-muted">Source Type</span>
            <span className="text-text-primary">{getPlatformLabel()}</span>
          </div>
        </Card>

        {/* SECTION: Automatic Post Monitoring (Feasibility MVP) */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw
                size={16}
                className={`text-primary-light ${isChecking ? 'animate-spin' : ''}`}
              />
              <h2 className="text-base font-bold text-text-primary">Automatic Post Monitoring</h2>
            </div>
            {hasBeenTested && renderStatusBadge()}
          </div>

          <Card className="p-4 bg-surface border-border">
            {/* Status & Telemetry Grid */}
            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-surface-hover/70 rounded-xl border border-border/60 text-center mb-4">
              <div>
                <span className="text-[10px] text-text-muted block">Last Checked</span>
                <span className="text-xs font-semibold text-text-primary truncate block mt-0.5">
                  {formattedLastChecked}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Posts Found</span>
                <span className="text-xs font-semibold text-text-primary block mt-0.5">
                  {monitoringData?.postsFound ?? posts.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted block">Relevant Jobs</span>
                <span className="text-xs font-semibold text-primary-light block mt-0.5">
                  {monitoringData?.relevantJobs ?? jobs.length}
                </span>
              </div>
            </div>

            {/* Test Monitoring / Check Now Button */}
            <Button
              variant="primary"
              fullWidth
              loading={isChecking}
              onClick={handleTestMonitoring}
              className="text-sm font-semibold"
            >
              <RefreshCw size={15} className={`mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              {hasBeenTested ? 'Check Now' : 'Test Monitoring'}
            </Button>

            {/* Untested Notice */}
            {!hasBeenTested && !isChecking && (
              <p className="text-xs text-text-muted text-center mt-2.5">
                Status: <span className="text-text-secondary">Checking availability... Click "Test Monitoring" to evaluate official Meta API access.</span>
              </p>
            )}

            {/* If API access is NOT available (Current Feasibility Result) */}
            {hasBeenTested && !monitoringData?.isFeasible && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {/* Feasibility Warning Box */}
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-text-primary leading-snug">
                        Automatic monitoring is not available for this source with the current Facebook permissions.
                      </h4>
                      <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                        To comply with Meta Terms of Service (Section 3.2.3) and user privacy, Tinder for Freelancers does not scrape or bypass Facebook security.
                      </p>
                    </div>
                  </div>

                  {/* Missing Configuration Details */}
                  {monitoringData?.missingConfig && monitoringData.missingConfig.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-amber-500/20">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300 block mb-1">
                        Missing Official API Configuration:
                      </span>
                      <ul className="space-y-1 text-[11px] text-text-secondary">
                        {monitoringData.missingConfig.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400">•</span>
                            <span className="font-mono text-[10px] text-text-primary">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Fallback Options Header */}
                <div className="pt-1">
                  <span className="text-xs font-semibold text-text-primary block mb-2">
                    Fallback Discovery Options:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsImportModalOpen(true)}
                      className="text-xs !py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <Link2 size={14} className="text-primary-light" />
                      Import Post Link
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsScreenshotModalOpen(true)}
                      className="text-xs !py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <Camera size={14} className="text-emerald-400" />
                      Upload Screenshot
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* SECTION: Discovered Jobs from this Source */}
        {jobs.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={16} className="text-primary-light" />
                <h3 className="text-base font-bold text-text-primary">Discovered Jobs ({jobs.length})</h3>
              </div>
              <span className="text-xs text-text-muted">AI Filtered</span>
            </div>

            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSkip={handleSkipJob}
                  onSave={handleSaveJob}
                  onApply={handleApplyJob}
                />
              ))}
            </div>
          </div>
        )}

        {/* Remove Source */}
        <div className="mt-8">
          <Button
            variant="ghost"
            fullWidth
            onClick={handleRemove}
            className="!text-error hover:!bg-error/10 text-xs"
          >
            <Trash2 size={16} className="mr-2" />
            Remove Source
          </Button>
        </div>

        {/* Fallback Modals */}
        <ImportPostModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleIngestPost}
          source={source}
        />

        <UploadScreenshotModal
          isOpen={isScreenshotModalOpen}
          onClose={() => setIsScreenshotModalOpen(false)}
          onImport={handleIngestPost}
          source={source}
        />
      </div>
    </PageTransition>
  );
};

export default SourceDetails;

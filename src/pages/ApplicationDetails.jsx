import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink,
  Edit3,
  Copy,
  Clock,
  Send,
  FileText,
  Briefcase,
  CheckCircle,
  Paperclip,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { getApplicationById, updateApplication, getJobById } from '../data/storage';
import { APPLICATION_STATUS_CONFIG } from '../utils/constants';

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [job, setJob] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    const app = getApplicationById(id);
    if (!app) {
      toast.error('Application not found');
      navigate('/applications');
      return;
    }
    setApplication(app);
    if (app.jobId) {
      setJob(getJobById(app.jobId));
    }
  }, [id, navigate]);

  const handleStatusUpdate = (appId, newStatus, note) => {
    updateApplication(appId, { status: newStatus, statusNote: note });
    const refreshed = getApplicationById(id);
    setApplication(refreshed);
    toast.success(`Application updated to ${newStatus}`);
  };

  const handleCopyMessage = () => {
    if (application?.message) {
      navigator.clipboard.writeText(application.message);
      toast.success('Message copied to clipboard!');
    }
  };

  if (!application) return null;

  const currentStatusConfig = APPLICATION_STATUS_CONFIG[application.status?.toLowerCase()] || {
    label: application.status,
    color: 'text-text-primary',
    bg: 'bg-surface-hover',
  };

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-5 py-6 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/applications')}
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={22} className="mr-0.5" />
            <span className="text-sm font-medium">Applications</span>
          </button>

          <button
            onClick={() => setIsStatusModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold hover:opacity-85 transition-opacity"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className={`w-2 h-2 rounded-full ${currentStatusConfig.bg.replace('/10', '') || 'bg-primary'}`} />
            <span className="capitalize">{application.status}</span>
            <Edit3 size={11} className="text-text-muted ml-0.5" />
          </button>
        </div>

        {/* Section 1: Job Summary Card */}
        <Card className="p-4 mb-4 border border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-text-muted block">
                Job Opportunity
              </span>
              <h1 className="text-base font-bold text-text-primary mt-0.5 leading-snug truncate">
                {application.title || application.jobTitle}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                <Building2 size={13} className="text-text-muted flex-shrink-0" />
                <span className="truncate">{application.company}</span>
                <span className="text-text-muted">•</span>
                <span className="capitalize text-primary">{application.platform?.replace('_', ' ')}</span>
              </div>
            </div>

            {application.matchScore && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                {application.matchScore}% Match
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border text-xs">
            <div className="flex items-center gap-3 text-text-muted text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {application.appliedAt
                  ? new Date(application.appliedAt).toLocaleDateString()
                  : 'Draft (Not sent)'}
              </span>
              <span>Method: {application.applicationMethod || 'Email'}</span>
            </div>

            {(application.sourceUrl || job?.postUrl) && (
              <a
                href={application.sourceUrl || job?.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
              >
                <span>View Job</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        </Card>

        {/* Section 2: Application Message Sent / Draft */}
        <Card className="p-4 mb-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-primary" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Application Message</h3>
            </div>
            <button
              onClick={handleCopyMessage}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              <Copy size={12} />
              Copy
            </button>
          </div>

          <div className="bg-surface-hover p-3 rounded-xl border border-border text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
            {application.message || 'No message recorded.'}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-text-muted pt-1">
            {application.tone && (
              <span className="bg-surface px-2 py-0.5 rounded border border-border">
                Tone: <strong>{application.tone}</strong>
              </span>
            )}
            {application.cvAttached && (
              <span className="bg-surface px-2 py-0.5 rounded border border-border flex items-center gap-1">
                <Paperclip size={10} /> CV Attached
              </span>
            )}
            {application.portfolioIncluded && (
              <span className="bg-surface px-2 py-0.5 rounded border border-border">
                ✓ Portfolio Included
              </span>
            )}
          </div>
        </Card>

        {/* Section 3: Status History Timeline */}
        <Card className="p-4 mb-6 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-primary" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Status History Timeline</h3>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {(application.statusHistory || [
              { status: application.status, timestamp: application.createdAt, note: 'Initial status' },
            ]).map((item, idx) => (
              <div key={idx} className="relative">
                <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary border-2 border-surface" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary capitalize">{item.status}</span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(item.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {item.note && <p className="text-[11px] text-text-secondary mt-0.5">{item.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions Row */}
        <div className="space-y-2">
          {application.jobId && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(`/apply/${application.jobId}`)}
              className="text-xs"
            >
              Open AI Application Workspace
            </Button>
          )}

          <Button
            variant="secondary"
            fullWidth
            onClick={() => setIsStatusModalOpen(true)}
            className="text-xs"
          >
            Update Application Status
          </Button>
        </div>

        {/* Status Update Modal */}
        <StatusUpdateModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          application={application}
          onStatusUpdate={handleStatusUpdate}
        />
      </div>
    </PageTransition>
  );
};

export default ApplicationDetails;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Sparkles,
  ExternalLink,
  MapPin,
  DollarSign,
  Bookmark,
  Check,
  X,
  Facebook,
  Radio,
  Youtube,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Building2,
  FilePlus2,
  Briefcase,
  Mail,
  Phone,
} from 'lucide-react';
import Card from './Card';
import Button from './Button';
import Modal from './Modal';
import { extractContactInfo } from '../utils/contactExtractor.js';
import { getUserJobState, isJobAppliedByUser } from '../data/storage.js';


export default function JobCard({
  job,
  onSkip,
  onSave,
  onApply,
  onUndo,
  showActions = true,
  isSwipeable = false,
  quickApplyActive = false,
  style = {},
}) {
  const navigate = useNavigate();
  const [showWhy, setShowWhy] = useState(false);

  const userState = getUserJobState(job.id);
  const isSaved = job.status === 'saved' || userState === 'saved';
  const isApplied = job.status === 'applied' || userState === 'applied' || isJobAppliedByUser(job.id);
  const isSkipped = job.status === 'skipped' || userState === 'skipped';

  // Swipe drag motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Rotate card as dragged horizontally
  const rotate = useTransform(x, [-200, 200], [-18, 18]);

  // Visual opacity stamps for Tinder swipe gestures
  const applyOpacity = useTransform(x, [50, 140], [0, 1]);
  const skipOpacity = useTransform(x, [-140, -50], [1, 0]);
  const saveOpacity = useTransform(y, [-120, -40], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (!isSwipeable) return;

    const threshold = 90;
    const { offset, velocity } = info;

    if (offset.x > threshold || velocity.x > 500) {
      // Swipe Right -> APPLY
      onApply?.(job);
    } else if (offset.x < -threshold || velocity.x < -500) {
      // Swipe Left -> SKIP
      onSkip?.(job);
    } else if (offset.y < -threshold || velocity.y < -500) {
      // Swipe Up -> SAVE
      onSave?.(job);
    }
  };

  if (isSkipped && !isSwipeable) {
    return (
      <Card className="opacity-50 border-dashed border-border py-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Job skipped: {job.title}</span>
          <button
            onClick={() => (onUndo ? onUndo(job) : onSave?.(job))}
            className="text-primary font-semibold hover:underline"
          >
            Undo
          </button>
        </div>
      </Card>
    );
  }

  // Source platform badge styling with authentic identities
  const renderSourceBadge = () => {
    switch (job.platform) {
      case 'reddit':
        return (
          <span className="inline-flex items-center gap-1 bg-[#FF4500]/15 text-[#FF4500] border border-[#FF4500]/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <Radio size={11} />
            Reddit
          </span>
        );
      case 'youtube':
        return (
          <span className="inline-flex items-center gap-1 bg-[#FF0000]/15 text-[#e11d48] dark:text-[#ff4444] border border-[#FF0000]/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <Youtube size={11} />
            YouTube
          </span>
        );
      case 'x':
        return (
          <span className="inline-flex items-center gap-1 bg-surface-hover text-text-primary border border-border px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <MessageSquare size={11} />
            X (Twitter)
          </span>
        );
      case 'manual_import':
        return (
          <span className="inline-flex items-center gap-1 bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <FilePlus2 size={11} />
            Manual Import
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-[#1877F2]/15 text-[#2563eb] dark:text-[#3b82f6] border border-[#1877F2]/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
            <Facebook size={11} />
            Facebook
          </span>
        );
    }
  };

  const [showScoreModal, setShowScoreModal] = useState(false);

  const getMatchTier = (score) => {
    if (score >= 90) return { tier: 'Excellent Match', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    if (score >= 80) return { tier: 'Strong Match', color: 'bg-primary/15 text-primary border-primary/30' };
    if (score >= 60) return { tier: 'Possible Match', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    return { tier: 'Low Match', color: 'bg-surface-hover text-text-muted border-border' };
  };

  const matchTierInfo = getMatchTier(job.matchScore || 85);

  const formatTimeAgo = (isoDate) => {
    if (!isoDate) return 'Recently';
    const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}h ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}d ago`;
    return new Date(isoDate).toLocaleDateString();
  };

  const qualityBadge = job.jobQuality || 'High Quality';
  const riskSignals = Array.isArray(job.riskSignals) ? job.riskSignals : [];
  const breakdown = job.matchBreakdown || {
    roleScore: 30,
    skillsScore: 25,
    experienceScore: 15,
    specializationScore: 10,
    jobTypeScore: 5,
    remoteScore: 5,
    salaryScore: 5,
    portfolioScore: 5,
  };

  const contactInfo = job.contact || extractContactInfo(job);

  return (
    <>
      <motion.div
        style={isSwipeable ? { x, y, rotate, ...style } : style}
        drag={isSwipeable}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
        className={`relative select-none ${isSwipeable ? 'touch-none' : ''}`}
      >
        {/* Visual Swipe Direction Stamps (Tinder Style) */}
        {isSwipeable && (
          <>
            {/* APPLY stamp (swipe right) */}
            <motion.div
              style={{ opacity: applyOpacity }}
              className="absolute top-8 left-8 z-30 pointer-events-none border-4 border-emerald-500 text-emerald-500 rounded-xl px-4 py-1.5 font-extrabold text-2xl tracking-wider rotate-[-15deg] bg-surface/90 backdrop-blur-md shadow-elevated"
            >
              {quickApplyActive ? 'QUICK APPLY' : 'APPLY'}
            </motion.div>

            {/* SKIP stamp (swipe left) */}
            <motion.div
              style={{ opacity: skipOpacity }}
              className="absolute top-8 right-8 z-30 pointer-events-none border-4 border-rose-500 text-rose-500 rounded-xl px-4 py-1.5 font-extrabold text-2xl tracking-wider rotate-[15deg] bg-surface/90 backdrop-blur-md shadow-elevated"
            >
              SKIP
            </motion.div>

            {/* SAVE stamp (swipe up) */}
            <motion.div
              style={{ opacity: saveOpacity }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none border-4 border-primary text-primary-dark dark:text-primary-light rounded-xl px-5 py-1.5 font-extrabold text-xl tracking-wider bg-surface/90 backdrop-blur-md shadow-elevated"
            >
              SAVE
            </motion.div>
          </>
        )}

        <Card
          onClick={() => !isSwipeable && navigate(`/job/${job.id}`)}
          className="relative overflow-hidden transition-all duration-200 hover:border-primary/40 p-5 bg-surface shadow-card text-text-primary cursor-pointer"
        >
          {/* Top row: Match Score, Source Badge & Quality */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScoreModal(true);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-transform active:scale-95 ${matchTierInfo.color}`}
                title="View Match Breakdown"
              >
                <Sparkles size={12} />
                <span>{job.matchScore || 85}% • {matchTierInfo.tier}</span>
              </button>

              {renderSourceBadge()}

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  qualityBadge === 'High Quality'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : qualityBadge === 'Standard Quality'
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}
              >
                {qualityBadge}
              </span>

              {/* Direct Contact Verification Badge */}
              {contactInfo.hasDirectContact ? (
                <span className="inline-flex items-center gap-1 bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                  <Mail size={11} />
                  {contactInfo.hasEmail && contactInfo.hasPhone
                    ? 'Direct: Email + WA'
                    : contactInfo.hasEmail
                    ? 'Direct: Email'
                    : 'Direct: WhatsApp'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-surface-hover text-text-muted border border-border px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <ExternalLink size={10} />
                  Manual Apply
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {job.isDemo && (
                <span className="text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                  DEMO
                </span>
              )}

              {(job.postUrl || job.sourceUrl) && (
                <a
                  href={job.postUrl || job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary transition-colors ml-1"
                  title="View original post"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>

          {/* Risk Signal Alert (if present) */}
          {riskSignals.length > 0 && (
            <div className="mb-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <span className="font-bold flex-shrink-0">⚠️ Caution:</span>
              <span className="leading-snug">{riskSignals.join(' • ')}</span>
            </div>
          )}

          {/* Title & Client */}
          <h3 className="text-lg font-bold text-text-primary leading-snug">{job.title}</h3>

          <div className="flex items-center justify-between text-xs text-text-secondary mt-1">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 size={13} className="text-text-muted flex-shrink-0" />
              <span className="truncate text-text-primary font-medium">
                {job.company || job.client || job.author || 'Hiring Client'}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-text-muted flex-shrink-0 ml-2">
              <Clock size={11} />
              <span>{formatTimeAgo(job.createdAt)}</span>
            </div>
          </div>


        {/* Badges: Salary, Location/Remote, Role, JobType */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.salary && job.salary !== 'Negotiable' && (
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <DollarSign size={12} />
              {job.salary}
            </span>
          )}
          <span className="inline-flex items-center gap-1 bg-surface-hover px-2.5 py-1 rounded-md text-[11px] font-medium text-text-secondary border border-border">
            <MapPin size={12} />
            {job.remote ? 'Remote' : job.location || 'On-site'}
          </span>
          {job.jobType && (
            <span className="inline-flex items-center gap-1 bg-surface-hover px-2.5 py-1 rounded-md text-[11px] font-medium text-text-secondary border border-border capitalize">
              <Briefcase size={12} />
              {job.jobType}
            </span>
          )}
          {job.jobRole && (
            <span className="bg-primary/10 text-primary-dark dark:text-primary-light px-2.5 py-1 rounded-md text-[11px] font-medium border border-primary/20 truncate max-w-[150px]">
              {job.jobRole}
            </span>
          )}
        </div>

        {/* Description Snippet */}
        <p className="text-xs text-text-secondary line-clamp-3 mt-3 bg-surface-hover p-3 rounded-xl border border-border leading-relaxed font-sans">
          "{job.description}"
        </p>

        {/* Accordion: "Why this job?" (Profile Matching Reasons) */}
        <div className="mt-3 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowWhy(!showWhy);
            }}
            className="flex items-center justify-between w-full text-left py-1 text-xs text-primary font-semibold hover:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} />
              Why this matches ({job.matchReasons?.length || 2} signals)
            </span>
            {showWhy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showWhy && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-1.5 bg-surface-hover rounded-xl p-3 border border-border text-xs"
            >
              {(job.matchReasons || [
                '✓ Matches your editing & creative background',
                '✓ 100% Remote flexibility',
              ]).map((reason, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-1.5 font-medium ${
                    reason.startsWith('⚠')
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className="leading-snug">{reason}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Actions: SKIP, SAVE, AI APPLY, APPLY */}
        {showActions && (
          <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSkip?.(job);
              }}
              className="text-[11px] !py-2 !px-1 text-text-muted hover:text-error hover:bg-error/10"
            >
              <X size={14} className="mr-0.5" />
              SKIP
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSave?.(job);
              }}
              disabled={isSaved}
              className={`text-[11px] !py-2 !px-1 ${
                isSaved ? '!text-primary border-primary/50 bg-primary/10' : ''
              }`}
            >
              {isSaved ? (
                <>
                  <Check size={13} className="mr-0.5 text-primary" />
                  SAVED
                </>
              ) : (
                <>
                  <Bookmark size={13} className="mr-0.5" />
                  SAVE
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/apply/${job.id}`);
              }}
              className="text-[11px] !py-2 !px-1 border-primary/40 bg-primary/5 text-primary hover:bg-primary/15"
              title="Open AI Application Assistant"
            >
              <Sparkles size={13} className="mr-0.5 text-primary" />
              AI APPLY
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApply?.(job);
              }}
              disabled={isApplied}
              className={`text-[11px] !py-2 !px-1 font-semibold ${
                isApplied ? '!bg-emerald-600 border-emerald-500' : ''
              }`}
            >
              {isApplied ? (
                <>
                  <Check size={13} className="mr-0.5" />
                  APPLIED
                </>
              ) : (
                'APPLY'
              )}
            </Button>
          </div>
        )}

        {/* Swipe hint in swipeable mode */}
        {isSwipeable && (
          <p className="text-[10px] text-text-muted text-center mt-3 pt-2 border-t border-border/60">
            Swipe left: <span className="text-rose-500 font-semibold">SKIP</span> • Swipe up:{' '}
            <span className="text-primary font-semibold">SAVE</span> • Swipe right:{' '}
            <span className="text-emerald-500 font-semibold">APPLY</span>
          </p>
        )}
      </Card>
    </motion.div>

    {/* Pro Multi-Factor Match Breakdown Modal */}
    <Modal
      isOpen={showScoreModal}
      onClose={() => setShowScoreModal(false)}
      title="Match Score Breakdown"
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Pro Score</span>
            <h4 className="text-xl font-extrabold text-primary">{job.matchScore || 85}% Match</h4>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface text-text-primary border border-border font-semibold text-xs">
            {job.jobQuality || 'High Quality'}
          </span>
        </div>

        {/* 8-Factor Breakdown List */}
        <div className="space-y-2">
          <h5 className="font-bold text-text-primary uppercase tracking-wider text-[10px]">
            Weighted Factors (100% Total)
          </h5>

          {[
            { label: 'Role Alignment', score: breakdown.roleScore || 28, max: 30 },
            { label: 'Skills Match', score: breakdown.skillsScore || 22, max: 25 },
            { label: 'Experience Level', score: breakdown.experienceScore || 14, max: 15 },
            { label: 'Specialization Alignment', score: breakdown.specializationScore || 9, max: 10 },
            { label: 'Job Type Match', score: breakdown.jobTypeScore || 5, max: 5 },
            { label: 'Remote Location', score: breakdown.remoteScore || 5, max: 5 },
            { label: 'Salary Target', score: breakdown.salaryScore || 4, max: 5 },
            { label: 'Portfolio & Verified CV', score: breakdown.portfolioScore || 4, max: 5 },
          ].map((factor) => (
            <div key={factor.label} className="p-2 rounded-lg bg-surface border border-border">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-text-primary">{factor.label}</span>
                <span className="font-mono text-text-secondary">
                  {factor.score} / {factor.max} pts
                </span>
              </div>
              <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(factor.score / factor.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Positive & Caution Reasons */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <h5 className="font-bold text-text-primary uppercase tracking-wider text-[10px]">
            Key Signals
          </h5>
          {(job.matchReasons || ['✓ Aligns with your career category']).map((r, i) => (
            <p key={i} className="text-emerald-600 dark:text-emerald-400 font-medium">
              {r}
            </p>
          ))}
          {(job.matchCautionReasons || []).map((c, i) => (
            <p key={i} className="text-amber-600 dark:text-amber-400 font-medium">
              {c}
            </p>
          ))}
        </div>

        <Button variant="secondary" fullWidth onClick={() => setShowScoreModal(false)} size="sm">
          Close Breakdown
        </Button>
      </div>
    </Modal>
  </>
  );
}


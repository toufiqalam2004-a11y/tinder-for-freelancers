import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle2, AlertTriangle, ExternalLink, Send, ShieldCheck, Target, Sparkles, User, Briefcase, Award
} from 'lucide-react';
import { calculateProMatch } from '../services/proMatchEngine.js';

export default function AutopilotDetailModal({ lead, profile, isOpen, onClose }) {
  if (!isOpen || !lead) return null;

  // Calculate deterministic match profile
  const matchResult = calculateProMatch(
    {
      title: lead.jobTitle || lead.title,
      description: lead.jobDescription || lead.description || lead.notes,
      jobRole: lead.jobRole || lead.title,
      requiredSkills: lead.requiredSkills || lead.skills || [],
      salary: lead.budget || lead.salary,
      jobType: lead.jobType || 'freelance',
      remote: true,
    },
    profile || {}
  );

  const score = lead.matchScore || matchResult.matchScore || 90;
  const reasons = matchResult.matchReasons || [];

  const rawSkills = profile?.skills || ['Premiere Pro', 'After Effects', 'Short-form editing'];
  const userSkills = rawSkills.map((s) => (typeof s === 'string' ? s : s.name));

  // Determine valid source URL
  const validSourceUrl = lead.sourceUrl && lead.sourceUrl.startsWith('http') ? lead.sourceUrl : null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-surface border border-border rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl overflow-y-auto max-h-[90vh] text-text-primary space-y-5"
        >
          {/* Top Bar / Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                AUTOPILOT APPLICATION
              </span>
              <h2 className="text-base font-bold text-text-primary mt-1">Application Detail</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-background hover:bg-border text-text-secondary transition-colors"
              aria-label="Close detail modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* SECTION 1: JOB / OPPORTUNITY & MATCH SCORE */}
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-background border border-border/70 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-text-secondary uppercase">JOB / OPPORTUNITY</span>
                  <h3 className="text-sm font-bold text-text-primary leading-snug">{lead.jobTitle || lead.title || 'Freelance Project'}</h3>
                </div>
                {/* Match Score Badge */}
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-bold text-text-secondary block">PROFILE MATCH</span>
                  <span className="text-sm font-extrabold text-emerald-500">{score}%</span>
                </div>
              </div>

              {/* Match Score Progress Bar */}
              <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-text-secondary block">CLIENT / COMPANY</span>
                  <span className="font-semibold text-text-primary">{lead.clientName || lead.company || 'Client'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-secondary block">SOURCE</span>
                  <span className="font-semibold text-primary">{lead.source || lead.channel || 'Reddit'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-secondary block">ACTION</span>
                  <span className="font-semibold text-text-primary">{lead.action || 'Outreach Sent'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-secondary block">CHANNEL</span>
                  <span className="font-semibold text-text-primary">{lead.channel || 'Email'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: WHY IT MATCHED */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              WHY IT MATCHED
            </h4>
            <div className="p-3 rounded-2xl bg-background border border-border/70 space-y-1.5 text-xs">
              {reasons.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-text-primary font-medium">
                  <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{r.replace(/^✓\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: KEY REQUIREMENTS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Target size={13} className="text-primary" />
              KEY REQUIREMENTS
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {['Video editing', 'YouTube', 'Short-form content', 'Premiere Pro'].map((req, i) => (
                <span key={i} className="text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-xl border border-primary/20">
                  {req}
                </span>
              ))}
            </div>
          </div>

          {/* SECTION 4: YOUR PROFILE FIT */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-primary" />
              YOUR PROFILE FIT
            </h4>
            <div className="p-3 rounded-2xl bg-background border border-border/70 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-text-secondary">Profession</span>
                <span className="font-semibold text-text-primary flex items-center gap-1">
                  {profile?.profession || profile?.primaryRole || 'Video Editor'} <CheckCircle2 size={12} className="text-emerald-500" />
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-text-secondary">Experience</span>
                <span className="font-semibold text-text-primary flex items-center gap-1">
                  {profile?.yearsOfExperience || 3}+ years <CheckCircle2 size={12} className="text-emerald-500" />
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-text-secondary">Skills</span>
                <span className="font-semibold text-text-primary flex items-center gap-1">
                  {userSkills.slice(0, 2).join(', ')} <CheckCircle2 size={12} className="text-emerald-500" />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Portfolio</span>
                <span className="font-semibold text-text-primary flex items-center gap-1">
                  {profile?.portfolioUrl ? 'Verified Link' : 'Relevant Work'} <CheckCircle2 size={12} className="text-emerald-500" />
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: OUTREACH MESSAGE */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Send size={13} className="text-primary" />
              OUTREACH
            </h4>
            <div className="p-3.5 rounded-2xl bg-background border border-border/70 space-y-2 text-xs">
              <p className="italic text-text-secondary leading-relaxed bg-surface/60 p-2.5 rounded-xl border border-border/50">
                "{lead.proposal || lead.message || `Hi ${lead.clientName || 'there'}, I noticed your post for ${lead.jobTitle || 'video editing'}. I specialize in fast-paced retention editing and high-converting creative content...`}"
              </p>
              <div className="flex items-center justify-between text-[11px] text-text-secondary pt-1">
                <span>Channel: <strong className="text-text-primary">{lead.channel || 'Email'}</strong></span>
                <span>Status: <strong className="text-emerald-500">Sent</strong></span>
                <span>Sent: <strong className="text-text-primary">{lead.appliedAt || lead.date || 'Recently'}</strong></span>
              </div>
            </div>
          </div>

          {/* SECTION 6: SOURCE OPPORTUNITY LINK (IF VALID) */}
          {validSourceUrl && (
            <div className="pt-2">
              <a
                href={validSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <span>View Original Opportunity</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

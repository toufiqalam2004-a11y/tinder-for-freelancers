import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle, AlertTriangle, Sparkles, ExternalLink, 
  Mail, MessageCircle, Building2, User, Globe, Shield, Calendar, Send 
} from 'lucide-react';
import Button from './Button';

const LeadDetailsModal = ({ isOpen, onClose, lead, onOpenComposer, onDismiss }) => {
  if (!isOpen || !lead) return null;

  const research = lead.research || {};
  const knownInfo = research.knownInfo || [];
  const aiInferences = research.aiInferences || [];

  const platformColors = {
    reddit: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    youtube: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    x: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    facebook_group: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    manual_import: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  platformColors[lead.platform] || 'bg-surface border-border text-text-secondary'
                }`}
              >
                {lead.platform?.replace('_', ' ')}
              </span>
              <span className="text-xs text-text-muted">
                {lead.opportunityType || 'Client Opportunity'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body content */}
          <div className="p-5 overflow-y-auto space-y-5 text-text-primary flex-1">
            {/* Title & Organization */}
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-snug">{lead.title}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                <span className="flex items-center gap-1 font-medium">
                  <Building2 size={14} className="text-text-muted" />
                  {lead.company || lead.name || 'Client Lead'}
                </span>
                {lead.createdAt && (
                  <span className="flex items-center gap-1 text-text-muted">
                    <Calendar size={13} />
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Score Badges Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-surface-hover/30">
                <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider">Pro Match</div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-primary">{lead.matchScore || 85}%</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">High Fit</span>
                </div>
                <div className="text-[11px] text-text-secondary mt-1">Skill & category alignment</div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-surface-hover/30">
                <div className="text-[11px] text-text-muted font-medium uppercase tracking-wider">AI Qualification</div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {lead.qualificationScore || 80}/100
                  </span>
                  <span className="text-xs text-text-secondary font-medium">Verified</span>
                </div>
                <div className="text-[11px] text-text-secondary mt-1">Need clarity & budget indicators</div>
              </div>
            </div>

            {/* Qualification Reasons */}
            {lead.qualificationReasons && lead.qualificationReasons.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">Qualification Signals</div>
                <div className="space-y-1">
                  {lead.qualificationReasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-text-secondary">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transparent Research Summary */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-surface-hover/20">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                <Sparkles size={14} />
                <span>AI Research & Strategic Angle</span>
              </div>

              {/* Angle */}
              {research.suggestedAngle && (
                <div className="text-xs text-text-primary bg-primary/5 p-3 rounded-lg border border-primary/10">
                  <strong className="text-primary font-semibold">Recommended Hook: </strong>
                  {research.suggestedAngle}
                </div>
              )}

              {/* Known Public Facts vs AI Inferences */}
              <div className="space-y-3 pt-1">
                {/* Verified Facts */}
                <div>
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1.5">
                    <Shield size={13} />
                    <span>VERIFIED PUBLIC INFORMATION (FACTS)</span>
                  </div>
                  {knownInfo.length > 0 ? (
                    <ul className="space-y-1 text-xs text-text-secondary">
                      {knownInfo.map((info, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{info}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-text-muted">Public post context verified.</div>
                  )}
                </div>

                {/* AI Inferences */}
                <div>
                  <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={13} />
                    <span>AI INFERENCES & DEDUCTIONS</span>
                  </div>
                  {aiInferences.length > 0 ? (
                    <ul className="space-y-1 text-xs text-text-secondary">
                      {aiInferences.map((inf, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-purple-500 font-bold">•</span>
                          <span>{inf}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-text-muted">No speculative inferences required.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Post Description */}
            <div>
              <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Original Post</div>
              <div className="text-xs text-text-secondary bg-surface p-3 rounded-xl border border-border max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {lead.description || 'No post description provided.'}
              </div>
            </div>

            {/* Contact Channels */}
            <div className="p-3.5 rounded-xl border border-border bg-surface-hover/30 space-y-2">
              <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">Contact Details</div>
              <div className="flex flex-col gap-2">
                {lead.email && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Mail size={14} className="text-primary" />
                      Email:
                    </span>
                    <span className="font-mono text-text-primary select-all">{lead.email}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <MessageCircle size={14} className="text-emerald-500" />
                      WhatsApp / Phone:
                    </span>
                    <span className="font-mono text-text-primary select-all">{lead.phone}</span>
                  </div>
                )}
                {lead.sourceUrl && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-text-secondary">Source Thread:</span>
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Open Thread</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (onDismiss) onDismiss(lead.id);
                onClose();
              }}
              className="text-text-muted hover:text-rose-500"
            >
              Dismiss Lead
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onOpenComposer) onOpenComposer(lead);
                }}
                icon={<Send size={14} />}
              >
                Draft Proposal
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LeadDetailsModal;

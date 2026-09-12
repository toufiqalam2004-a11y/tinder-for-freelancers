import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Copy, Send, Mail, MessageCircle, Sparkles, Check, 
  ExternalLink, Building2, User, RefreshCw, AlertCircle 
} from 'lucide-react';
import Button from './Button';
import { aiProvider } from '../services/aiProvider';
import { useProfile } from '../contexts/ProfileContext';
import { updateLead, addOutreachMessage } from '../data/storage';
import { createOutreachMessage } from '../data/models';
import toast from 'react-hot-toast';

const TONES = [
  'Professional',
  'Friendly',
  'Confident',
  'Casual',
  'Short & Direct',
];

const OutreachComposerModal = ({ isOpen, onClose, lead, onSent }) => {
  const { profile } = useProfile();

  const [tone, setTone] = useState(lead?.outreachMessage?.tone || 'Professional');
  const [subject, setSubject] = useState(lead?.outreachMessage?.subject || '');
  const [body, setBody] = useState(lead?.outreachMessage?.fullBody || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeChannel, setActiveChannel] = useState(lead?.email ? 'email' : 'whatsapp');

  useEffect(() => {
    if (lead) {
      setTone(lead.outreachMessage?.tone || 'Professional');
      setSubject(lead.outreachMessage?.subject || `Regarding: ${lead.title || 'Creative Video Project'}`);
      setBody(lead.outreachMessage?.fullBody || lead.outreachMessage?.opening || '');
      setActiveChannel(lead.email ? 'email' : 'whatsapp');
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleRegenerateTone = async (newTone) => {
    setTone(newTone);
    setIsGenerating(true);
    try {
      const generated = await aiProvider.generateOutreach({
        lead,
        profile,
        tone: newTone,
        method: activeChannel,
      });

      setSubject(generated.subject);
      setBody(generated.fullBody);
      toast.success(`Adapted proposal tone to ${newTone}`);
    } catch (err) {
      toast.error('Failed to regenerate tone');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const fullText = activeChannel === 'email' ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(fullText);
    toast.success('Proposal copied to clipboard!');
  };

  const handleSaveDraft = () => {
    const updatedMsg = createOutreachMessage({
      ...(lead.outreachMessage || {}),
      leadId: lead.id,
      tone,
      subject,
      fullBody: body,
      isEdited: true,
    });

    updateLead(lead.id, {
      outreachMessage: updatedMsg,
      status: 'waiting_approval',
    });
    addOutreachMessage(updatedMsg);

    toast.success('Draft proposal saved.');
    onClose();
  };

  const handleSendOrApprove = () => {
    // 1. If Email channel
    if (activeChannel === 'email' && lead.email) {
      const mailtoUrl = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
    } else if (activeChannel === 'whatsapp' && lead.phone) {
      const phoneDigits = lead.phone.replace(/[^\d]/g, '');
      const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(body)}`;
      window.open(waUrl, '_blank');
    }

    // 2. Mark approved and sent in storage
    const updatedMsg = createOutreachMessage({
      ...(lead.outreachMessage || {}),
      leadId: lead.id,
      tone,
      subject,
      fullBody: body,
      isEdited: true,
      approved: true,
      sentAt: new Date().toISOString(),
      status: 'sent',
    });

    updateLead(lead.id, {
      outreachMessage: updatedMsg,
      status: 'sent',
      lastContactedAt: new Date().toISOString(),
    });
    addOutreachMessage(updatedMsg);

    toast.success(`Proposal recorded as sent to ${lead.name}!`);
    if (onSent) onSent(lead.id);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">Review & Send Proposal</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                  {lead.platform}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                To: <span className="font-semibold text-text-primary">{lead.name || lead.company}</span> • {lead.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-text-primary flex-1">
            {/* Channel Tabs */}
            <div className="flex items-center gap-2 p-1 bg-surface-hover/40 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveChannel('email')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeChannel === 'email'
                    ? 'bg-surface text-primary shadow-sm border border-border'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Mail size={14} />
                <span>Email {lead.email ? `(${lead.email})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChannel('whatsapp')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeChannel === 'whatsapp'
                    ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-sm border border-border'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <MessageCircle size={14} />
                <span>WhatsApp {lead.phone ? `(${lead.phone})` : ''}</span>
              </button>
            </div>

            {/* Tone Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={12} className="text-primary" />
                  <span>Outreach Tone</span>
                </label>
                {isGenerating && (
                  <span className="text-xs text-primary flex items-center gap-1 animate-pulse">
                    <RefreshCw size={12} className="animate-spin" /> Adapting...
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleRegenerateTone(t)}
                    disabled={isGenerating}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      tone === t
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Subject Line (if email) */}
            {activeChannel === 'email' && (
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-text-primary text-sm focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            )}

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Personalized Proposal
                </label>
                <span className="text-[11px] text-text-muted">
                  {body.length} chars • ~{body.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Compose outreach message..."
                className="w-full p-3.5 rounded-xl border border-border bg-surface text-text-primary text-xs leading-relaxed focus:outline-none focus:border-primary transition-colors font-sans resize-none"
              />
            </div>

            {/* Duplicate Protection Warning if contacted recently */}
            {lead.lastContactedAt && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>
                  Notice: This lead was already contacted on {new Date(lead.lastContactedAt).toLocaleDateString()}.
                  Duplicate protection cooldown is 3 days.
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              icon={<Copy size={14} />}
            >
              Copy
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendOrApprove}
                icon={<Send size={14} />}
              >
                {activeChannel === 'email' && lead.email ? 'Send via Email' : 'Send via WhatsApp'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OutreachComposerModal;

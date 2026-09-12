import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Sparkles,
  Copy,
  Mail,
  MessageCircle,
  CheckCircle,
  FileText,
  ExternalLink,
  RotateCcw,
  Languages,
  Send,
  Save,
  AlertCircle,
  Check,
  Building2,
  Paperclip,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import UpgradeModal from '../components/UpgradeModal';
import { useProfile } from '../contexts/ProfileContext';
import { createApplication } from '../data/models.js';
import { addApplication, updateJobStatus, getJobById, getApplicationByJobId, setUserJobApplied, getCurrentUserId } from '../data/storage.js';
import { aiService } from '../services/aiService';
import { usageService } from '../services/usageService';
import { subscriptionService } from '../services/subscriptionService';
import { APPLICATION_TONES, APPLICATION_LENGTHS } from '../utils/constants';
import { normalizeWhatsAppNumber } from '../utils/validators.js';

const ApplyJob = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const [job, setJob] = useState(null);
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('Medium');
  const [cvAttached, setCvAttached] = useState(!!profile?.cvUrl);
  const [portfolioIncluded, setPortfolioIncluded] = useState(!!profile?.portfolioUrl);

  const [message, setMessage] = useState('');
  const [originalGenerated, setOriginalGenerated] = useState('');
  const [isEdited, setIsEdited] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);

  // Bangla draft workspace
  const [showBanglaWorkspace, setShowBanglaWorkspace] = useState(false);
  const [banglaDraft, setBanglaDraft] = useState('');

  // Modals
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [pendingSendType, setPendingSendType] = useState(null); // 'email' | 'whatsapp'

  // Why you match accordion
  const [showMatchReasons, setShowMatchReasons] = useState(false);

  // Load Job & Check for existing draft
  useEffect(() => {
    const jobData = getJobById(jobId);
    if (!jobData) {
      toast.error('Job not found');
      navigate(-1);
      return;
    }
    setJob(jobData);

    // Check if an existing draft exists for this job
    const existingApp = getApplicationByJobId(jobId);
    if (existingApp && existingApp.status === 'draft') {
      setMessage(existingApp.message);
      setOriginalGenerated(existingApp.originalGeneratedMessage || existingApp.message);
      setTone(existingApp.tone || 'Professional');
      setLength(existingApp.length || 'Medium');
      setCvAttached(existingApp.cvAttached !== undefined ? existingApp.cvAttached : true);
      setPortfolioIncluded(existingApp.portfolioIncluded !== undefined ? existingApp.portfolioIncluded : true);
      toast('Loaded your saved draft.', { icon: '📝' });
    } else {
      // Generate initial AI application
      handleGenerate(jobData, 'Professional', 'Medium', true, true);
    }
  }, [jobId, profile, navigate]);

  // Quota Upgrade Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const handleGenerate = async (
    targetJob = job,
    targetTone = tone,
    targetLength = length,
    targetCv = cvAttached,
    targetPortfolio = portfolioIncluded
  ) => {
    if (!targetJob) return;

    // Check AI generation quota
    const aiCheck = usageService.canUseAIApply();
    if (!aiCheck.allowed) {
      setUpgradeReason(aiCheck.reason);
      setShowUpgradeModal(true);
      return;
    }

    setLoadingAI(true);
    try {
      const res = await aiService.generateApplicationMessage({
        job: targetJob,
        profile,
        tone: targetTone,
        length: targetLength,
        cvAttached: targetCv,
        portfolioIncluded: targetPortfolio,
      });

      // Consume AI Apply quota
      usageService.consumeAIApply();

      setMessage(res.message);
      setOriginalGenerated(res.message);
      setIsEdited(false);
    } catch (err) {
      toast.error('Failed to generate application message');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleRegenerateClick = () => {
    if (isEdited && message !== originalGenerated) {
      setShowRegenConfirm(true);
    } else {
      handleGenerate();
      toast.success('Generated fresh application message!');
    }
  };

  const confirmRegenerate = () => {
    setShowRegenConfirm(false);
    handleGenerate();
    toast.success('Generated fresh application message!');
  };

  const handleToneChange = (newTone) => {
    setTone(newTone);
    handleGenerate(job, newTone, length, cvAttached, portfolioIncluded);
  };

  const handleLengthChange = (newLength) => {
    setLength(newLength);
    handleGenerate(job, tone, newLength, cvAttached, portfolioIncluded);
  };

  const handleTranslateBangla = async () => {
    if (!banglaDraft.trim()) {
      toast.error('Please write a Bangla draft first');
      return;
    }
    setLoadingAI(true);
    try {
      const res = await aiService.translateAndImproveBangla(banglaDraft, profile, job);
      setMessage(res.message);
      setIsEdited(true);
      setShowBanglaWorkspace(false);
      toast.success('Translated & polished to professional English!');
    } catch (err) {
      toast.error('Translation error');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast.success('Message copied to clipboard!');
  };

  // Contacts
  const contactInfo = job ? aiService.extractContactInfo(job) : { hasEmail: false, hasPhone: false };
  const suggestions = job ? aiService.generateSuggestions(job, profile) : [];

  // Deep Links with Send Confirmation Flow
  const triggerEmail = () => {
    const subject = encodeURIComponent(`Application: ${job?.title || 'Job Opening'}`);
    const body = encodeURIComponent(message);
    const recipient = contactInfo.email ? contactInfo.email.replace(/[^\w.@+-]/g, '') : '';
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    setPendingSendType('Email');
    setShowSendConfirmation(true);
  };

  const triggerWhatsApp = () => {
    const waText = aiService.generateWhatsAppMessage(job, profile, message);
    const phone = contactInfo.phone ? normalizeWhatsAppNumber(contactInfo.phone) : '';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener,noreferrer');
    setPendingSendType('WhatsApp');
    setShowSendConfirmation(true);
  };

  const handleSaveDraft = () => {
    const app = createApplication({
      jobId: job.id,
      title: job.title,
      company: job.company || job.author,
      platform: job.platform,
      sourceUrl: job.sourceUrl || job.postUrl,
      message,
      originalGeneratedMessage: originalGenerated,
      tone,
      length,
      cvAttached,
      portfolioIncluded,
      applicationMethod: 'Manual',
      recipient: contactInfo.email || contactInfo.phone || '',
      status: 'draft',
      matchScore: job.matchScore,
      matchReasons: job.matchReasons,
    });

    addApplication(app);
    toast.success('Application saved as draft!');
    navigate('/applications');
  };

  const handleConfirmSent = (didSend) => {
    setShowSendConfirmation(false);

    if (didSend) {
      const applyCheck = usageService.canApply();
      if (!applyCheck.allowed) {
        setUpgradeReason(applyCheck.reason);
        setShowUpgradeModal(true);
        return;
      }

      const currentUid = profile?.id || getCurrentUserId();
      const app = createApplication({
        jobId: job.id,
        userId: currentUid,
        title: job.title,
        company: job.company || job.author,
        platform: job.platform,
        sourceUrl: job.sourceUrl || job.postUrl,
        message,
        originalGeneratedMessage: originalGenerated,
        tone,
        length,
        cvAttached,
        portfolioIncluded,
        applicationMethod: pendingSendType || 'Email',
        recipient: contactInfo.email || contactInfo.phone || '',
        status: 'applied',
        matchScore: job.matchScore,
        matchReasons: job.matchReasons,
      });

      try {
        usageService.consumeApplication();
      } catch (err) {
        setUpgradeReason(err.message);
        setShowUpgradeModal(true);
        return;
      }

      addApplication(app);
      setUserJobApplied(job.id, currentUid);
      updateJobStatus(job.id, 'applied');
      toast.success('Application recorded! Added to Applications.');
      navigate('/applications');
    } else {
      // Saved as draft
      handleSaveDraft();
    }
  };

  if (!job) return null;

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-5 py-6 pb-36">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={22} className="mr-0.5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles size={12} />
            <span>AI Assistant ({aiService.isApiConfigured() ? 'AI Powered' : 'Demo AI Mode'})</span>
          </div>
        </div>

        {/* Section 1: Job Context & Match Card */}
        <Card className="mb-4 p-4 border border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
                Applying For
              </span>
              <h2 className="text-base font-bold text-text-primary leading-tight mt-0.5 truncate">{job.title}</h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                <Building2 size={13} className="text-text-muted flex-shrink-0" />
                <span className="truncate">{job.company || job.author || 'Hiring Client'}</span>
                <span className="text-text-muted">•</span>
                <span className="capitalize text-primary">{job.platform.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {job.matchScore || 85}% Match
              </span>
            </div>
          </div>

          {/* Accordion: Why you match */}
          <div className="mt-3 pt-2.5 border-t border-border/70">
            <button
              type="button"
              onClick={() => setShowMatchReasons(!showMatchReasons)}
              className="w-full flex items-center justify-between text-xs font-semibold text-primary hover:opacity-85"
            >
              <span>Why you match ({job.matchReasons?.length || 2} signals)</span>
              {showMatchReasons ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showMatchReasons && (
              <div className="mt-2 space-y-1 bg-surface-hover p-2.5 rounded-xl border border-border text-xs">
                {(job.matchReasons || ['✓ Matches specialization', '✓ Remote flexibility']).map((r, i) => (
                  <p key={i} className="text-text-secondary flex items-start gap-1">
                    <span>{r}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Smart suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/70 text-[11px] text-text-secondary space-y-1">
              <span className="font-semibold text-text-primary block text-[11px]">💡 Smart suggestions:</span>
              {suggestions.map((sug, i) => (
                <p key={i} className="flex items-start gap-1 leading-snug">
                  <span>•</span>
                  <span>{sug}</span>
                </p>
              ))}
            </div>
          )}
        </Card>

        {/* Section 2: AI Tone & Length Controls */}
        <div className="space-y-3 mb-4">
          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">Application Tone</label>
            <div className="grid grid-cols-2 gap-1.5">
              {APPLICATION_TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToneChange(t.id)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    tone === t.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="text-xs font-bold block">{t.label}</span>
                  <span className="text-[10px] text-text-muted truncate block">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Length Selector & Attachments */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">Message Length</label>
              <div className="flex bg-surface border border-border rounded-xl p-1 gap-1">
                {APPLICATION_LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleLengthChange(l.id)}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                      length === l.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bangla draft toggle button */}
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">Language Mode</label>
              <button
                type="button"
                onClick={() => setShowBanglaWorkspace(!showBanglaWorkspace)}
                className={`w-full py-1.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  showBanglaWorkspace
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <Languages size={14} />
                <span>Bangla Draft Mode</span>
              </button>
            </div>
          </div>

          {/* Bangla Draft Expansion Workspace */}
          {showBanglaWorkspace && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-surface border border-primary/30 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">Write in Bangla:</span>
                <span className="text-[10px] text-text-muted">Will translate into professional English</span>
              </div>
              <textarea
                rows={3}
                placeholder="যেমন: ভাই আমি একজন ভিডিও এডিটর, আপনার ইউটিউব চ্যানেলের জন্য কোয়ালিটি এডিটিং করতে পারব..."
                value={banglaDraft}
                onChange={(e) => setBanglaDraft(e.target.value)}
                className="w-full bg-surface-hover border border-border rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-primary"
              />
              <Button
                variant="primary"
                size="sm"
                fullWidth
                loading={loadingAI}
                onClick={handleTranslateBangla}
              >
                Improve & Translate to Professional English
              </Button>
            </motion.div>
          )}

          {/* Application Quality Score Widget (V4) */}
          {(() => {
            const qualityEval = aiService.calculateApplicationQualityScore({
              message,
              job,
              profile,
              cvAttached,
              portfolioIncluded,
            });
            return (
              <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primary" />
                    <span className="text-xs font-bold text-text-primary">
                      Application Quality Score
                    </span>
                  </div>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${qualityEval.color} ${qualityEval.bg} ${qualityEval.border}`}
                  >
                    {qualityEval.score}/100 • {qualityEval.rating}
                  </span>
                </div>

                <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all duration-300"
                    style={{ width: `${qualityEval.score}%` }}
                  />
                </div>

                <div className="space-y-1 pt-1">
                  {qualityEval.feedback.map((f, i) => (
                    <p
                      key={i}
                      className={`text-[11px] leading-tight ${
                        f.startsWith('⚠') ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Attachments Checklist */}
          <div className="flex items-center gap-4 bg-surface border border-border rounded-xl p-2.5 px-3">

            <button
              type="button"
              onClick={() => {
                const next = !cvAttached;
                setCvAttached(next);
                handleGenerate(job, tone, length, next, portfolioIncluded);
              }}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {cvAttached ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-text-muted" />}
              <span>Attach CV {profile?.cvUrl ? '(demo-cv.pdf)' : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !portfolioIncluded;
                setPortfolioIncluded(next);
                handleGenerate(job, tone, length, cvAttached, next);
              }}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {portfolioIncluded ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-text-muted" />}
              <span>Include Portfolio</span>
            </button>
          </div>
        </div>

        {/* Section 3: Editable Message Workspace */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-text-primary">Personalized Application Message</label>
              {isEdited && (
                <span className="text-[10px] text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  Edited
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleRegenerateClick}
              disabled={loadingAI}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} className={loadingAI ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>

          <textarea
            rows={10}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setIsEdited(true);
            }}
            placeholder="AI will generate your application message here..."
            className="w-full bg-surface border border-border rounded-xl p-3.5 text-xs text-text-primary leading-relaxed font-sans focus:outline-none focus:border-primary transition-colors shadow-inner"
          />

          <div className="flex items-center justify-between mt-1 text-[10px] text-text-muted px-1">
            <span>{message.trim().split(/\s+/).filter(Boolean).length} words • {message.length} chars</span>
            <button onClick={handleCopy} className="text-primary hover:underline flex items-center gap-1 font-medium">
              <Copy size={11} />
              Copy message
            </button>
          </div>
        </div>

        {/* Section 4: Application Preview Card */}
        <Card className="p-3.5 border border-border/80 bg-surface-hover/50 mb-4">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">
            Final Preview
          </span>
          <div className="text-xs space-y-1 text-text-secondary border-b border-border pb-2 mb-2">
            <p className="truncate">
              <strong className="text-text-primary">To:</strong> {job.company || 'Hiring Client'}{' '}
              {contactInfo.email ? `(${contactInfo.email})` : contactInfo.phone ? `(${contactInfo.phone})` : ''}
            </p>
            <p className="truncate">
              <strong className="text-text-primary">Subject:</strong> Application for {job.title} — {profile?.name || 'Applicant'}
            </p>
            <p className="truncate text-[11px] text-text-muted">
              <strong className="text-text-primary">Attachments:</strong>{' '}
              {cvAttached ? '✓ CV attached' : 'No CV'} • {portfolioIncluded ? `✓ Portfolio (${profile?.portfolioUrl || 'link'})` : 'No portfolio'}
            </p>
          </div>
          <p className="text-[11px] text-text-muted italic line-clamp-2">"{message.slice(0, 120)}..."</p>
        </Card>

        {/* Sticky Bottom Actions Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface/95 backdrop-blur-md border-t border-border p-3.5 px-5 z-20 shadow-elevated flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveDraft}
            className="text-xs text-text-secondary hover:text-text-primary border border-border"
            title="Save as Draft"
          >
            <Save size={15} className="mr-1" />
            Draft
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={triggerWhatsApp}
            className="flex-1 text-xs"
            title="Open WhatsApp with pre-filled application"
          >
            <MessageCircle size={15} className="mr-1.5 text-emerald-500" />
            WhatsApp
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={triggerEmail}
            className="flex-1 text-xs"
            title="Open Email client with pre-filled application"
          >
            <Mail size={15} className="mr-1.5" />
            Send Email
          </Button>
        </div>

        {/* Regenerate Confirmation Modal */}
        <Modal
          isOpen={showRegenConfirm}
          onClose={() => setShowRegenConfirm(false)}
          title="Regenerate Application?"
        >
          <div className="space-y-4 text-center py-2">
            <AlertCircle size={36} className="text-amber-500 mx-auto" />
            <p className="text-xs text-text-secondary leading-relaxed">
              You have manually edited this application. Regenerating will create a new draft and overwrite your custom edits.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth onClick={() => setShowRegenConfirm(false)}>
                Keep My Edits
              </Button>
              <Button variant="primary" fullWidth onClick={confirmRegenerate}>
                Generate New
              </Button>
            </div>
          </div>
        </Modal>

        {/* Send Confirmation Modal */}
        <Modal
          isOpen={showSendConfirmation}
          onClose={() => setShowSendConfirmation(false)}
          title="Application Confirmation"
        >
          <div className="space-y-4 text-center py-2">
            <CheckCircle size={38} className="text-primary mx-auto" />
            <h3 className="text-sm font-bold text-text-primary">Did you send this application?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              We just opened your {pendingSendType} client with the pre-filled message. Once you press Send, confirm here to record it in your Application Tracker.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="primary" fullWidth onClick={() => handleConfirmSent(true)}>
                ✓ Yes, Mark as Applied
              </Button>
              <Button variant="secondary" fullWidth onClick={() => handleConfirmSent(false)}>
                Not Yet, Save as Draft
              </Button>
            </div>
          </div>
        </Modal>

        {/* Upgrade / Quota Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          title="Daily Quota Exceeded"
          message={upgradeReason}
        />
      </div>
    </PageTransition>
  );
};

export default ApplyJob;

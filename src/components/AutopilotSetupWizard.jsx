import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, ChevronRight, ChevronLeft, Bot, Sparkles, 
  Target, Shield, Mail, MessageCircle, Sliders, Zap, CheckCircle2, Lock 
} from 'lucide-react';
import Button from './Button';
import { getAutopilotSettings, saveAutopilotSettings, logAgentActivity } from '../data/storage.js';
import { createAgentActivity } from '../data/models.js';
import { subscriptionService } from '../services/subscriptionService';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, title: 'What are you looking for?', desc: 'Define your primary objective' },
  { id: 2, title: 'Opportunity Types', desc: 'Select target client categories' },
  { id: 3, title: 'Preferred Sources', desc: 'Where the agent monitors' },
  { id: 4, title: 'Min Match Score', desc: 'Filter out low relevance leads' },
  { id: 5, title: 'Target Audience', desc: 'Keywords and client types' },
  { id: 6, title: 'Outreach Method', desc: 'How proposals are routed' },
  { id: 7, title: 'Safety & Control Mode', desc: 'Daily limits and approval rules' },
];

const LOOKING_FOR_OPTIONS = [
  { id: 'clients', label: 'Client Opportunities', desc: 'High-paying freelance clients, creators & projects' },
  { id: 'freelance', label: 'Freelance & Contract Gigs', desc: 'Short-term and retainer-based freelance roles' },
  { id: 'fulltime', label: 'Full-Time Remote Roles', desc: 'Permanent positions at global companies' },
  { id: 'all', label: 'All Opportunities', desc: 'Discover both client gigs and full-time vacancies' },
];

const OPPORTUNITY_TYPE_OPTIONS = [
  'YouTube Channels & Creators',
  'Tech Startups & SaaS',
  'Creative Agencies & Studios',
  'E-commerce & DTC Brands',
  'Podcasters & Media Brands',
  'Founders & Solopreneurs',
];

const SOURCE_OPTIONS = [
  { id: 'reddit', label: 'Reddit', desc: 'r/forhire, r/HireaWriter, r/freelance' },
  { id: 'youtube', label: 'YouTube', desc: 'Community posts and creator hiring threads' },
  { id: 'x', label: 'X / Twitter', desc: 'Real-time hiring posts and founder shouts' },
  { id: 'facebook_group', label: 'Facebook Groups', desc: 'Public community groups & job boards' },
];

const MATCH_SCORE_OPTIONS = [
  { score: 60, label: '60%+', desc: 'Broadest discovery' },
  { score: 70, label: '70%+', desc: 'Balanced discovery' },
  { score: 80, label: '80%+', desc: 'High match precision', recommended: true },
  { score: 90, label: '90%+', desc: 'Strict best match' },
];

const AUDIENCE_TAGS = [
  'YouTubers',
  'Content Creators',
  'Tech Founders',
  'Marketing Directors',
  'Podcasters',
  'SaaS Executives',
  'Creative Directors',
  'Course Creators',
];

const OUTREACH_METHODS = [
  { id: 'both', label: 'Email & WhatsApp / Direct', desc: 'Use whatever contact info is verified on the post' },
  { id: 'email', label: 'Email Only', desc: 'Only prepare and send proposals via direct email' },
  { id: 'whatsapp', label: 'WhatsApp / Phone Only', desc: 'Target WhatsApp and mobile contact leads' },
];

const CONTROL_MODES = [
  { 
    id: 'approval', 
    label: 'Approval Mode (Recommended)', 
    badge: 'DEFAULT',
    desc: 'AI discovers, qualifies and drafts proposals. You approve before anything is sent.' 
  },
  { 
    id: 'manual', 
    label: 'Manual Mode', 
    desc: 'AI qualifies and prepares message templates. You manually initiate each contact.' 
  },
  { 
    id: 'autopilot', 
    label: 'Autopilot Mode', 
    desc: 'Agent sends qualified opportunities automatically within strict daily limits.' 
  },
];

const AutopilotSetupWizard = ({ isOpen, onClose, onComplete }) => {
  const currentSettings = getAutopilotSettings();
  const [step, setStep] = useState(1);

  // Form states
  const [lookingFor, setLookingFor] = useState('clients');
  const [opportunityTypes, setOpportunityTypes] = useState(
    currentSettings.opportunityTypes || ['Freelance', 'Contract', 'Client Work']
  );
  const [sources, setSources] = useState(
    currentSettings.sources || ['reddit', 'youtube', 'x', 'facebook_group']
  );
  const [minMatchScore, setMinMatchScore] = useState(currentSettings.minMatchScore || 80);
  const [targetAudience, setTargetAudience] = useState(
    currentSettings.targetAudience || ['Creators', 'YouTubers', 'Startups']
  );
  const [outreachMethod, setOutreachMethod] = useState(currentSettings.outreachMethod || 'both');
  const [dailyLimit, setDailyLimit] = useState(currentSettings.dailyLimit || 5);
  const [controlMode, setControlMode] = useState(() => {
    const initial = currentSettings.mode || 'manual';
    const check = subscriptionService.canUseAutopilot(initial);
    return check.allowed ? initial : 'manual';
  });
  const [enableFollowUps, setEnableFollowUps] = useState(
    currentSettings.enableFollowUps !== undefined ? currentSettings.enableFollowUps : true
  );

  if (!isOpen) return null;

  const toggleArrayItem = (setter, currentList, item) => {
    if (currentList.includes(item)) {
      if (currentList.length > 1) {
        setter(currentList.filter((i) => i !== item));
      } else {
        toast.error('At least one option must be selected.');
      }
    } else {
      setter([...currentList, item]);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    const updatedSettings = {
      ...currentSettings,
      status: 'active', // Activate when wizard completes
      mode: controlMode,
      lookingFor,
      opportunityTypes,
      sources,
      minMatchScore,
      targetAudience,
      outreachMethod,
      dailyLimit,
      enableFollowUps,
      isConfigured: true,
      autopilotSetupCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    saveAutopilotSettings(updatedSettings);

    logAgentActivity(
      createAgentActivity({
        action: 'Autopilot Configured',
        detail: `Agent configured in ${controlMode.toUpperCase()} mode (Limit: ${dailyLimit}/day, Min match: ${minMatchScore}%).`,
        status: 'success',
      })
    );

    toast.success('AI Autopilot is configured and active!');
    if (onComplete) onComplete(updatedSettings);
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-text-primary">Autopilot Setup Wizard</h2>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">V5</span>
                </div>
                <p className="text-xs text-text-secondary">Step {step} of {STEPS.length}: {STEPS[step - 1].title}</p>
              </div>
            </div>
            {currentSettings.autopilotSetupCompleted && (
              <button
                onClick={onClose}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-border h-1">
            <div
              className="bg-gradient-to-r from-primary to-emerald-500 h-1 transition-all duration-300"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Step Content */}
          <div className="p-5 overflow-y-auto flex-1 text-text-primary">
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary mb-2">
                  What type of opportunities should your AI career agent prioritize?
                </p>
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLookingFor(opt.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between ${
                      lookingFor === opt.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-surface hover:bg-surface-hover/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm text-text-primary">{opt.label}</div>
                      <div className="text-xs text-text-secondary mt-0.5">{opt.desc}</div>
                    </div>
                    {lookingFor === opt.id && (
                      <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary mb-2">
                  Select the types of clients or organizations you want the agent to target:
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {OPPORTUNITY_TYPE_OPTIONS.map((type) => {
                    const isSelected = opportunityTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleArrayItem(setOpportunityTypes, opportunityTypes, type)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-text-primary font-medium'
                            : 'border-border bg-surface text-text-secondary hover:bg-surface-hover/60'
                        }`}
                      >
                        <span>{type}</span>
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary mb-2">
                  Select which public channels the agent should monitor for opportunities:
                </p>
                <div className="space-y-2.5">
                  {SOURCE_OPTIONS.map((src) => {
                    const isSelected = sources.includes(src.id);
                    return (
                      <button
                        key={src.id}
                        onClick={() => toggleArrayItem(setSources, sources, src.id)}
                        className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-surface hover:bg-surface-hover/60'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm text-text-primary">{src.label}</div>
                          <div className="text-xs text-text-secondary mt-0.5">{src.desc}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                            isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Set the minimum Pro Match score required before the agent initiates research or prepares outreach:
                </p>
                <div className="space-y-2.5">
                  {MATCH_SCORE_OPTIONS.map((opt) => (
                    <button
                      key={opt.score}
                      onClick={() => setMinMatchScore(opt.score)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        minMatchScore === opt.score
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-surface hover:bg-surface-hover/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-primary">{opt.label}</span>
                        <div>
                          <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                            {opt.desc}
                            {opt.recommended && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                                RECOMMENDED
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {minMatchScore === opt.score && (
                        <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-3 bg-surface-hover/40 rounded-xl border border-border text-xs text-text-secondary flex items-start gap-2">
                  <Shield size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>The agent calculates 8-dimension match scores and automatically discards posts below this threshold.</span>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Select target client roles & keywords to prioritize in proposal drafting:
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {AUDIENCE_TAGS.map((tag) => {
                    const isSelected = targetAudience.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleArrayItem(setTargetAudience, targetAudience, tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary mb-2">
                  How should outreach be routed when public contact details are discovered?
                </p>
                <div className="space-y-2.5">
                  {OUTREACH_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setOutreachMethod(m.id)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                        outreachMethod === m.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-surface hover:bg-surface-hover/60'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-text-primary">{m.label}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{m.desc}</div>
                      </div>
                      {outreachMethod === m.id && (
                        <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-5">
                {/* Control Mode Selection */}
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">
                    Operating Control Mode
                  </label>
                  <div className="space-y-2">
                    {CONTROL_MODES.map((mode) => {
                      const check = subscriptionService.canUseAutopilot(mode.id);
                      const isLocked = !check.allowed;

                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            if (isLocked) {
                              toast.error(check.reason || 'Upgrade required for this mode');
                              return;
                            }
                            setControlMode(mode.id);
                          }}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                            controlMode === mode.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : isLocked
                              ? 'border-border/60 bg-surface/50 opacity-75'
                              : 'border-border bg-surface hover:bg-surface-hover/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                              {mode.label}
                              {mode.badge && (
                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                  {mode.badge}
                                </span>
                              )}
                              {isLocked && (
                                <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                                  <Lock size={10} />
                                  <span>{check.requiredPlan === 'pro' ? 'PRO' : 'PLUS'}</span>
                                </span>
                              )}
                            </span>
                            {controlMode === mode.id && (
                              <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                                <Check size={10} />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-1">{mode.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daily Outreach Limit */}
                <div className="p-3.5 bg-surface-hover/30 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">Daily Outreach Limit</div>
                      <div className="text-xs text-text-secondary">Strict cap to prevent spam & protect reputation</div>
                    </div>
                    <div className="text-lg font-bold text-primary">{dailyLimit} / day</div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted mt-1">
                    <span>1 (Conservative)</span>
                    <span>5 (Recommended)</span>
                    <span>15 (Max)</span>
                  </div>
                </div>

                {/* Follow ups toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface">
                  <div>
                    <div className="text-sm font-medium text-text-primary">Polite Follow-ups</div>
                    <div className="text-xs text-text-secondary">Queue friendly 3-day and 7-day follow-ups</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableFollowUps(!enableFollowUps)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      enableFollowUps ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        enableFollowUps ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface">
            {step > 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBack}
                icon={<ChevronLeft size={16} />}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              icon={step === STEPS.length ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
            >
              {step === STEPS.length ? 'Activate Autopilot' : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AutopilotSetupWizard;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Target, Sparkles, Wand2, Send, CheckCircle2, 
  ArrowRight, X, ChevronRight, Zap, Check 
} from 'lucide-react';
import Button from './Button';

const INTRO_STEPS = [
  {
    id: 'discover',
    number: '01',
    icon: Search,
    title: 'Find opportunities',
    subtitle: 'AI scans your connected sources for relevant freelance and remote opportunities.',
    color: 'from-blue-500 to-cyan-500',
    accentColor: 'text-cyan-400',
    bgBadge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  },
  {
    id: 'qualify',
    number: '02',
    icon: Target,
    title: 'Find the best matches',
    subtitle: 'AI checks each opportunity against your skills, experience and preferences.',
    color: 'from-purple-500 to-indigo-500',
    accentColor: 'text-purple-400',
    bgBadge: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  },
  {
    id: 'personalize',
    number: '03',
    icon: Wand2,
    title: 'Prepare personalized applications',
    subtitle: 'AI creates a tailored message based on the opportunity and your profile.',
    color: 'from-pink-500 to-rose-500',
    accentColor: 'text-pink-400',
    bgBadge: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
  },
  {
    id: 'outreach',
    number: '04',
    icon: Send,
    title: 'Reach out automatically',
    subtitle: 'Autopilot sends qualified applications through available contact channels within your plan limits.',
    color: 'from-emerald-500 to-teal-500',
    accentColor: 'text-emerald-400',
    bgBadge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
];

export default function AutopilotIntroAnimation({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-progress through the 4 steps (~1.2s per step for total ~4s duration)
  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;

    if (currentStep < INTRO_STEPS.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStep, isAutoPlaying]);

  if (!isOpen) return null;

  const stepData = INTRO_STEPS[currentStep];
  const StepIcon = stepData.icon;
  const isFinalStep = currentStep === INTRO_STEPS.length - 1;

  const handleNext = () => {
    setIsAutoPlaying(false);
    if (isFinalStep) {
      onComplete ? onComplete() : onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSelectStep = (idx) => {
    setIsAutoPlaying(false);
    setCurrentStep(idx);
  };

  const handleFinish = () => {
    onComplete ? onComplete() : onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-[#0f172a] border border-slate-700/80 rounded-3xl p-6 shadow-2xl overflow-hidden text-white"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header with Title and Close Button */}
          <div className="flex items-start justify-between relative z-10 mb-5">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                  Meet AI Autopilot <span className="text-amber-400">✨</span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Your always-on job application assistant.
              </p>
            </div>
            <button
              onClick={handleFinish}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label="Close intro"
            >
              <X size={16} />
            </button>
          </div>

          {/* Interactive Step Content */}
          <div className="relative z-10 min-h-[260px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepData.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Step Stage Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stepData.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <StepIcon size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                        Step {currentStep + 1} of 4
                      </span>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {stepData.title}
                      </h3>
                    </div>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${stepData.bgBadge}`}>
                    {stepData.id.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {stepData.subtitle}
                </p>

                {/* Micro-interactive Visual Animation per Step */}
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 min-h-[110px] flex flex-col justify-center">
                  {/* STEP 1: DISCOVER Visual */}
                  {stepData.id === 'discover' && (
                    <div className="space-y-2">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          <span className="font-semibold text-white">YouTube Creator Lead</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-bold">$300/video</span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="font-semibold text-white">SaaS Podcast Repurposer</span>
                        </div>
                        <span className="text-[10px] text-blue-400 font-bold">$1,000/mo</span>
                      </motion.div>
                    </div>
                  )}

                  {/* STEP 2: QUALIFY Visual */}
                  {stepData.id === 'qualify' && (
                    <div className="flex flex-col gap-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300"
                      >
                        <span>89% Strong Match</span>
                        <CheckCircle2 size={13} />
                      </motion.div>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '85%' }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs font-semibold text-blue-300"
                      >
                        <span>76% Good Match</span>
                        <Check size={13} />
                      </motion.div>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '50%' }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-slate-700/30 border border-slate-700/50 text-[11px] text-slate-400"
                      >
                        <span>42% Low Match</span>
                        <span className="text-[10px]">Filtered out</span>
                      </motion.div>
                    </div>
                  )}

                  {/* STEP 3: PERSONALIZE Visual */}
                  {stepData.id === 'personalize' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-1.5 text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-1.5 text-pink-400 font-bold text-[10px] uppercase">
                        <Sparkles size={11} />
                        <span>AI Tailored Pitch</span>
                      </div>
                      <p className="italic text-[11px] text-slate-300 leading-snug line-clamp-2">
                        "Hi Alex, I loved your 120k tech channel. I specialize in fast-paced retention editing with Premiere Pro & After Effects..."
                      </p>
                      <div className="text-[10px] text-slate-400 font-medium pt-0.5">
                        ✓ Portfolio & Turnaround tailored to job scope
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4: OUTREACH Visual */}
                  {stepData.id === 'outreach' && (
                    <div className="flex items-center justify-between px-2 text-xs">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">
                          1
                        </div>
                        <span className="text-[10px] text-slate-400">Qualified</span>
                      </motion.div>
                      <ArrowRight size={14} className="text-slate-500" />
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[11px]">
                          2
                        </div>
                        <span className="text-[10px] text-slate-400">Ready</span>
                      </motion.div>
                      <ArrowRight size={14} className="text-slate-500" />
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-[11px]">
                          ✓
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold">Sent</span>
                      </motion.div>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Bottom Controls: Progress Dots & Action Buttons */}
            <div className="pt-5 border-t border-slate-800 flex items-center justify-between gap-4 mt-4">
              {/* Progress Dots */}
              <div className="flex items-center gap-1.5">
                {INTRO_STEPS.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => handleSelectStep(idx)}
                    className={`h-2 rounded-full transition-all ${
                      currentStep === idx
                        ? 'w-6 bg-primary'
                        : 'w-2 bg-slate-700 hover:bg-slate-600'
                    }`}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Action Button */}
              <div>
                {isFinalStep ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFinish}
                    icon={<Zap size={14} />}
                    className="font-bold shadow-lg shadow-primary/30"
                  >
                    Continue to Autopilot
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleNext}
                    icon={<ChevronRight size={14} />}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

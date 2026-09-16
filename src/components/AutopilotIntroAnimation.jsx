import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Target, Wand2, Send, CheckCircle2, 
  ArrowRight, X, ChevronRight, Zap, Check, Sparkles, Bot, Lock, Crown
} from 'lucide-react';
import Button from './Button';

const PIPELINE_STAGES = [
  { id: 'discover', title: 'Discover', label: 'Job Opportunities', icon: Search, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  { id: 'match', title: 'Match', label: 'Profile Match', icon: Target, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  { id: 'qualify', title: 'Qualify', label: 'Lead Qualification', icon: CheckCircle2, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  { id: 'personalize', title: 'Personalize', label: 'AI Personalization', icon: Wand2, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  { id: 'outreach', title: 'Outreach', label: 'Automatic Outreach', icon: Send, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
];

export function AutopilotPreviewAnimation({ interactive = true, onCardClick = null }) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const current = PIPELINE_STAGES[activeStage];

  return (
    <div
      onClick={onCardClick}
      className={`p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden relative ${
        interactive ? 'cursor-pointer hover:border-slate-700 transition-all group' : ''
      }`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Bot size={16} />
          </div>
          <span className="text-xs font-bold text-slate-200">AI Automation Pipeline</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Visual Preview
        </span>
      </div>

      {/* Stage Flow Indicator */}
      <div className="flex items-center justify-between gap-1 mb-4 relative z-10">
        {PIPELINE_STAGES.map((st, idx) => {
          const StageIcon = st.icon;
          const isActive = idx === activeStage;
          return (
            <div
              key={st.id}
              onClick={(e) => {
                if (interactive) {
                  e.stopPropagation();
                  setActiveStage(idx);
                }
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all ${
                isActive ? `${st.bg} ${st.border} border scale-105` : 'bg-slate-800/40 border border-transparent'
              }`}
            >
              <StageIcon size={14} className={isActive ? st.color : 'text-slate-500'} />
              <span className={`text-[9px] font-semibold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                {st.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stage Visual Card */}
      <div className="min-h-[90px] p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-center relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5 text-xs"
          >
            {current.id === 'discover' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">YouTube Tech Editor Lead</span>
                  <span className="text-cyan-400 font-bold">$350/video</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>Found via Reddit & YouTube Community</span>
                </div>
              </div>
            )}

            {current.id === 'match' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">Profile Match Engine</span>
                  <span className="text-purple-400 font-bold">92% Match</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Matches your Premiere Pro, After Effects & Tech editing skills.
                </p>
              </div>
            )}

            {current.id === 'qualify' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-blue-400" />
                    <span>Lead Qualification</span>
                  </span>
                  <span className="text-blue-400 font-bold text-[10px]">Verified Direct Contact</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Only qualified opportunities with verified client contacts are processed.
                </p>
              </div>
            )}

            {current.id === 'personalize' && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-pink-400 font-bold text-[10px] uppercase">
                  <Sparkles size={11} />
                  <span>AI Personalization</span>
                </div>
                <p className="italic text-[11px] text-slate-300 leading-tight line-clamp-2">
                  "Hi Alex, I noticed your tech channel cadence. I specialize in fast-paced retention editing..."
                </p>
              </div>
            )}

            {current.id === 'outreach' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200 flex items-center gap-1">
                    <Send size={12} className="text-emerald-400" />
                    <span>Outreach Prepared</span>
                  </span>
                  <span className="text-emerald-400 font-bold text-[10px]">AUTOMATED OUTREACH</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Dispatched safely within your plan limits and safety controls.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AutopilotIntroAnimation({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

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
          {/* Header */}
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                AI Autopilot Preview <Sparkles size={16} className="text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Let AI find and reach out to the right opportunities for you.
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

          <AutopilotPreviewAnimation interactive={true} />

          <div className="pt-5 flex items-center justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinish}
              icon={<Zap size={14} />}
              className="font-bold shadow-lg shadow-primary/30"
            >
              Continue
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

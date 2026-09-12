import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Shield, Heart, ExternalLink, Code2 } from 'lucide-react';
import Button from './Button';
import { APP_CONFIG } from '../utils/constants';

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col text-text-primary max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white font-extrabold text-xs shadow-glow">
                TF
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">About {APP_CONFIG.NAME}</h2>
                <span className="text-[10px] text-primary font-bold">Version {APP_CONFIG.VERSION}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-text-secondary">
            {/* Tagline Box */}
            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/15 text-center space-y-1">
              <div className="text-sm font-extrabold text-primary">{APP_CONFIG.TAGLINE}</div>
              <p className="text-[11px] text-text-secondary">
                A swipe-based platform built to help freelancers discover relevant opportunities, apply faster, and manage their career outreach.
              </p>
            </div>

            {/* Core Mission */}
            <div>
              <div className="font-bold text-text-primary text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles size={13} className="text-primary" />
                <span>Our Philosophy</span>
              </div>
              <p>
                Freelance job hunting shouldn't feel like an endless chore of refreshing multiple tabs. We combine Tinder-style swipe discovery with proactive AI assistance to match you directly with hiring creators, startups, and clients.
              </p>
            </div>

            {/* Compliance & Safety */}
            <div>
              <div className="font-bold text-text-primary text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Shield size={13} className="text-emerald-500" />
                <span>Zero-Spam & Platform Compliance</span>
              </div>
              <p>
                To protect user privacy and respect third-party terms of service, Tinder for Freelancers monitors only public hiring discussions and threads. We never scrape restricted networks (such as LinkedIn, Instagram, or Threads), never spam clients, and keep your personal data strictly private on your device.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-1.5 pt-1">
              <div className="font-bold text-text-primary text-xs uppercase tracking-wider mb-1">
                Platform Architecture
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg border border-border bg-surface-hover/30">
                  <div className="font-semibold text-text-primary">8-Factor Pro Match</div>
                  <div className="text-text-muted">Weighted scoring engine</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-surface-hover/30">
                  <div className="font-semibold text-text-primary">Lightweight CRM</div>
                  <div className="text-text-muted">9-stage conversion funnel</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-surface-hover/30">
                  <div className="font-semibold text-text-primary">AI Autopilot</div>
                  <div className="text-text-muted">Controlled career agent</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-surface-hover/30">
                  <div className="font-semibold text-text-primary">PWA Ready</div>
                  <div className="text-text-muted">Offline-aware shell</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
            <span className="text-[11px] text-text-muted">© 2026 Tinder for Freelancers</span>
            <Button variant="primary" size="sm" onClick={onClose}>
              Got It
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AboutModal;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles, Zap, ArrowRight, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function UpgradeModal({
  isOpen,
  onClose,
  title = 'Limit Reached',
  message = 'Upgrade your membership or top up application credits to continue.',
  highlightPlan = 'plus',
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 pt-1 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
          <Crown size={28} />
        </div>

        <div>
          <h3 className="text-base font-bold text-text-primary">
            Unlock Full Career Potential
          </h3>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed px-2">
            {message}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-hover border border-border text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <Zap size={14} className="text-primary" />
            <span>Plus Plan — ₹299/mo ($4.99)</span>
          </div>
          <p className="text-[11px] text-text-muted">
            • 20 applications/day • 5 sources • 10 AI Applies • Autopilot
          </p>

          <div className="pt-2 border-t border-border flex items-center gap-2 text-xs font-semibold text-text-primary">
            <Sparkles size={14} className="text-amber-500" />
            <span>Application Credits — from ₹49 ($0.99)</span>
          </div>
          <p className="text-[11px] text-text-muted">
            • Top up +20, +50, or +100 applications valid for 30 days
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              onClose();
              navigate('/membership');
            }}
          >
            <span>View Plans & Top-Up Credits</span>
            <ArrowRight size={15} className="ml-1.5" />
          </Button>

          <Button variant="ghost" fullWidth onClick={onClose} size="sm">
            Maybe Later
          </Button>
        </div>
      </div>
    </Modal>
  );
}

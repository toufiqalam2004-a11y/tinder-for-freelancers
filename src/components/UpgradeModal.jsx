import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Sparkles, Zap, ArrowRight, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function UpgradeModal({
  isOpen,
  onClose,
  title = 'Limit Reached',
  subtitle = null,
  headline = 'Unlock Full Career Potential',
  message = 'Upgrade your membership or top up application credits to continue.',
  highlightPlan = 'plus',
  primaryCtaText = 'View Plans & Top-Up Credits',
  onPrimaryCta = null,
  secondaryCtaText = 'Maybe Later',
  onSecondaryCta = null,
  showComparison = true,
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handlePrimaryClick = () => {
    if (onPrimaryCta) {
      onPrimaryCta();
    } else {
      onClose();
      navigate('/membership');
    }
  };

  const handleSecondaryClick = () => {
    if (onSecondaryCta) {
      onSecondaryCta();
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 pt-1 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
          <Crown size={28} />
        </div>

        <div>
          {subtitle && (
            <span className="inline-block px-2.5 py-0.5 mb-2 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              {subtitle}
            </span>
          )}
          <h3 className="text-base font-bold text-text-primary">
            {headline}
          </h3>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed px-2">
            {message}
          </p>
        </div>

        {showComparison && (
          <div className="p-3.5 rounded-xl bg-surface-hover border border-border text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Zap size={14} className="text-primary" />
              <span>Plus Plan — ₹499/mo ($7)</span>
            </div>
            <p className="text-[11px] text-text-muted">
              • 15 applications/8hr • 3 custom sources • AI Pitch Generator
            </p>

            <div className="pt-2 border-t border-border flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Sparkles size={14} className="text-amber-500" />
              <span>Application Credits — from ₹49 ($0.99)</span>
            </div>
            <p className="text-[11px] text-text-muted">
              • Top up +20, +50, or +100 applications valid for 30 days
            </p>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Button
            variant="primary"
            fullWidth
            onClick={handlePrimaryClick}
          >
            <span>{primaryCtaText}</span>
            <ArrowRight size={15} className="ml-1.5" />
          </Button>

          <Button variant="ghost" fullWidth onClick={handleSecondaryClick} size="sm">
            {secondaryCtaText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Phone, ChevronDown, ArrowRight, CheckCircle2, 
  HelpCircle, X, Shield, Flame, Send, Award, Check 
} from 'lucide-react';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { APP_CONFIG } from '../utils/constants';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+1', country: 'US', label: 'United States (+1)' },
  { code: '+44', country: 'GB', label: 'United Kingdom (+44)' },
  { code: '+971', country: 'AE', label: 'UAE (+971)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
  { code: '+49', country: 'DE', label: 'Germany (+49)' },
  { code: '+33', country: 'FR', label: 'France (+33)' },
  { code: '+81', country: 'JP', label: 'Japan (+81)' },
  { code: '+86', country: 'CN', label: 'China (+86)' },
  { code: '+65', country: 'SG', label: 'Singapore (+65)' },
  { code: '+966', country: 'SA', label: 'Saudi Arabia (+966)' },
  { code: '+234', country: 'NG', label: 'Nigeria (+234)' },
];

const FLOW_STEPS = [
  {
    step: '1',
    title: 'Swipe',
    desc: 'Swipe right on client gigs you love, left to pass.',
    badge: 'Swipe Right = Interested',
  },
  {
    step: '2',
    title: 'Match',
    desc: 'Instant 8-factor Pro match scoring based on your skills.',
    badge: '92% Strong Fit',
  },
  {
    step: '3',
    title: 'Apply',
    desc: 'Personalized AI proposal sent via direct Email or WhatsApp.',
    badge: '1-Click Direct Outreach',
  },
  {
    step: '4',
    title: 'Get Hired',
    desc: 'Manage intro calls, replies, and retainer contracts.',
    badge: 'Track in CRM',
  },
];

const Welcome = () => {
  const navigate = useNavigate();
  const { sendOtp, authLoading, authError } = useAuth();

  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async (e) => {
    e.preventDefault();

    const digits = phoneNumber.replace(/\D/g, '');
    if (!digits || digits.length < 6) {
      setError('Please enter a valid phone number');
      return;
    }

    setError('');
    const fullPhone = `${countryCode}${digits}`;
    const result = await sendOtp(fullPhone);

    if (result.success) {
      navigate('/verify-otp');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-between px-5 py-8 max-w-md mx-auto text-text-primary"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Top Brand Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white font-black text-xs shadow-glow">
            TF
          </div>
          <span className="font-extrabold text-sm text-text-primary tracking-tight">
            Tinder <span className="gradient-text">for Freelancers</span>
          </span>
        </div>

        <button
          onClick={() => setShowHowItWorks(true)}
          className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors flex items-center gap-1 py-1 px-2.5 rounded-full border border-border bg-surface hover:bg-surface-hover"
        >
          <HelpCircle size={13} />
          <span>How It Works</span>
        </button>
      </motion.div>

      {/* Hero Section */}
      <div className="my-auto py-6 space-y-6">
        <motion.div variants={itemVariants} className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={13} />
            <span>Swipe. Match. Get Hired.</span>
          </div>

          <h1 className="text-3xl font-black text-text-primary tracking-tight leading-tight">
            Tinder for Freelancers
          </h1>

          <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
            Discover freelance jobs and client opportunities that match your skills.
          </p>
        </motion.div>

        {/* Visual 4-Step Representation: Swipe -> Match -> Apply -> Get Hired */}
        <motion.div variants={itemVariants} className="space-y-2 bg-surface p-4 rounded-2xl border border-border shadow-card">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center mb-2">
            The Freelance Career Engine
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            {FLOW_STEPS.map((item, idx) => (
              <div
                key={item.step}
                className="p-2 rounded-xl bg-surface-hover/50 border border-border/60 flex flex-col items-center justify-center gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                  {item.step}
                </div>
                <div className="font-bold text-xs text-text-primary">{item.title}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1 text-[11px] text-text-muted pt-1">
            <span>Swipe</span>
            <ArrowRight size={10} />
            <span>Match</span>
            <ArrowRight size={10} />
            <span>Apply</span>
            <ArrowRight size={10} />
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Get Hired</span>
          </div>
        </motion.div>

        {/* Phone OTP Login Form */}
        <motion.div variants={itemVariants} className="space-y-3">
          {!showLoginForm ? (
            <div className="space-y-2 pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setShowLoginForm(true)}
                icon={<ArrowRight size={18} />}
              >
                Get Started
              </Button>
              <button
                type="button"
                onClick={() => setShowHowItWorks(true)}
                className="w-full text-center py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                See How It Works
              </button>
            </div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleContinue}
              className="space-y-3 bg-surface p-4 rounded-2xl border border-border"
            >
              <div className="flex items-center justify-between">
                <label className="block text-xs text-text-secondary font-bold uppercase tracking-wider">
                  Mobile Number Login
                </label>
                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  className="text-[11px] text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>

              <div className="flex gap-2">
                {/* Country code selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-1 bg-surface-hover border border-border rounded-xl px-3 py-3 text-text-primary text-sm font-medium hover:border-primary/50 transition-colors min-w-[88px]"
                  >
                    {countryCode}
                    <ChevronDown size={14} className="text-text-muted" />
                  </button>

                  {showDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-elevated w-56 max-h-52 overflow-y-auto"
                      >
                        {COUNTRY_CODES.map((cc) => (
                          <button
                            key={cc.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(cc.code);
                              setShowDropdown(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${
                              countryCode === cc.code
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-text-primary hover:bg-surface-hover'
                            }`}
                          >
                            <span className="font-medium">{cc.code}</span>
                            <span className="text-text-muted ml-2">{cc.country}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Phone number input */}
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError('');
                  }}
                  className="flex-1 bg-surface-hover border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 text-sm"
                  autoComplete="tel"
                  autoFocus
                />
              </div>

              {/* Error */}
              {(error || authError) && (
                <p className="text-rose-500 text-xs mt-1">{error || authError}</p>
              )}

              {/* Continue button */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={authLoading}
                className="mt-2"
                icon={<Phone size={16} />}
              >
                Send OTP Verification
              </Button>
            </motion.form>
          )}
        </motion.div>
      </div>

      {/* Footer / Demo Notice */}
      <motion.div variants={itemVariants} className="text-center pt-4">
        <p className="text-[11px] text-text-muted">
          Demo Testing Mode — Any valid phone number • OTP: <span className="text-primary font-mono font-bold">123456</span>
        </p>
      </motion.div>

      {/* How It Works Modal */}
      <AnimatePresence>
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-elevated overflow-hidden flex flex-col text-text-primary max-h-[90vh]"
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-xs">
                    TF
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-text-primary">How Tinder for Freelancers Works</h3>
                    <p className="text-[10px] text-text-muted">Swipe. Match. Get Hired.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {FLOW_STEPS.map((step) => (
                  <div key={step.step} className="p-3.5 rounded-xl border border-border bg-surface-hover/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-text-primary flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                          {step.step}
                        </span>
                        {step.title}
                      </span>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {step.badge}
                      </span>
                    </div>
                    <p className="text-text-secondary text-[11px] pl-7">{step.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
                <Button variant="secondary" size="sm" onClick={() => setShowHowItWorks(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowHowItWorks(false);
                    setShowLoginForm(true);
                  }}
                  icon={<ArrowRight size={14} />}
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Welcome;

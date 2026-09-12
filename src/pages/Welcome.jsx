import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Phone, ChevronDown, ArrowRight, CheckCircle2, 
  HelpCircle, X, Shield, Flame, Send, Award, Check, Search 
} from 'lucide-react';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { APP_CONFIG } from '../utils/constants';
import { DEFAULT_COUNTRY_CODES, validatePhoneNumber } from '../utils/validators.js';

const COUNTRY_CODES = DEFAULT_COUNTRY_CODES;

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
  const [selectedCountryIso, setSelectedCountryIso] = useState('IN');
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [error, setError] = useState('');

  const selectedCountry = useMemo(() => {
    return (
      DEFAULT_COUNTRY_CODES.find(
        (c) => c.code === countryCode && (selectedCountryIso ? c.country === selectedCountryIso : true)
      ) ||
      DEFAULT_COUNTRY_CODES.find((c) => c.code === countryCode) ||
      DEFAULT_COUNTRY_CODES[0]
    );
  }, [countryCode, selectedCountryIso]);

  const filteredCountryCodes = useMemo(() => {
    if (!countrySearch.trim()) return DEFAULT_COUNTRY_CODES;
    const q = countrySearch.toLowerCase().trim();
    return DEFAULT_COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleContinue = async (e) => {
    e.preventDefault();

    if (phoneNumber.length !== 10 || !/^[0-9]{10}$/.test(phoneNumber)) {
      return;
    }

    // Strict 10-digit validation guard
    const validation = validatePhoneNumber(countryCode, phoneNumber);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setError('');
    const result = await sendOtp(validation.normalizedNumber, {
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
    });

    if (result && result.success) {
      navigate('/verify-otp');
    } else if (result && result.error) {
      setError(result.error);
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
                {/* Searchable Country code selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(!showDropdown);
                      setCountrySearch('');
                    }}
                    className="flex items-center gap-1.5 bg-surface-hover border border-border rounded-xl px-2.5 py-3 text-text-primary text-sm font-medium hover:border-primary/50 transition-colors min-w-[105px]"
                    title="Select country calling code"
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="font-mono text-xs font-semibold">{countryCode}</span>
                    <ChevronDown size={14} className="text-text-muted ml-auto" />
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
                        className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-elevated w-72 max-h-64 flex flex-col overflow-hidden"
                      >
                        {/* Search Header */}
                        <div className="p-2 border-b border-border bg-surface-hover/50">
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              placeholder="Search country or code..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Scrollable Country List */}
                        <div className="overflow-y-auto max-h-52 divide-y divide-border/40">
                          {filteredCountryCodes.length === 0 ? (
                            <div className="p-3 text-center text-xs text-text-muted">
                              No matching country found
                            </div>
                          ) : (
                            filteredCountryCodes.map((cc) => {
                              const isSelected =
                                countryCode === cc.code && selectedCountry.country === cc.country;
                              return (
                                <button
                                  key={`${cc.country}-${cc.code}`}
                                  type="button"
                                  onClick={() => {
                                    setCountryCode(cc.code);
                                    setSelectedCountryIso(cc.country);
                                    setShowDropdown(false);
                                    setCountrySearch('');
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                                    isSelected
                                      ? 'bg-primary/10 text-primary font-bold'
                                      : 'text-text-primary hover:bg-surface-hover'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-base flex-shrink-0">{cc.flag}</span>
                                    <span className="truncate">{cc.name}</span>
                                  </div>
                                  <span className="font-mono text-text-muted font-semibold ml-2 flex-shrink-0">
                                    {cc.code}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Phone number input - Only numeric digits, max 10 */}
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhoneNumber(val);
                    setError('');
                  }}
                  className="flex-1 bg-surface-hover border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 text-sm font-mono tracking-wide"
                  autoComplete="tel"
                  autoFocus
                />
              </div>

              {/* Digits counter info */}
              <div className="flex justify-between items-center px-1 text-[11px] text-text-muted">
                <span className="truncate max-w-[200px]">
                  Country: <strong className="text-text-primary font-medium">{selectedCountry.name} ({countryCode})</strong>
                </span>
                <span
                  className={
                    phoneNumber.length === 10
                      ? 'text-emerald-500 font-bold'
                      : 'text-text-muted font-medium'
                  }
                >
                  {phoneNumber.length}/10 digits
                </span>
              </div>

              {/* Error */}
              {(error || authError) && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{error || authError}</p>
              )}

              {/* Continue button */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={phoneNumber.length !== 10 || authLoading}
                loading={authLoading}
                className="mt-2"
                icon={<Phone size={16} />}
              >
                Continue / Get OTP
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

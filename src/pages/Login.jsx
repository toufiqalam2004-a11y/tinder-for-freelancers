import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, ChevronDown, ArrowRight, ArrowLeft,
  HelpCircle, X, Sparkles, Search, Briefcase, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/Button';
import CaptchaWidget from '../components/CaptchaWidget';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { DEFAULT_COUNTRY_CODES, validatePhoneNumber } from '../utils/validators.js';

export default function Login({ initialMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOtp, authLoading, authError, isDemo, DEMO_OTP, isAuthenticated, user } = useAuth();
  const { isProfileComplete } = useProfile();

  // Mode: 'signup' or 'login'
  const [mode, setMode] = useState(() => {
    if (initialMode) return initialMode;
    if (location.pathname === '/signup') return 'signup';
    try {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('mode') === 'signup') return 'signup';
    } catch {
      // ignore query fallback
    }
    return 'login';
  });

  const [countryCode, setCountryCode] = useState('+91');
  const [selectedCountryIso, setSelectedCountryIso] = useState('IN');
  const [countrySearch, setCountrySearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetTrigger, setCaptchaResetTrigger] = useState(0);
  const [accountNotice, setAccountNotice] = useState(null);

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname === '/signup') {
      setMode('signup');
      setAccountNotice(null);
    } else if (location.pathname === '/login') {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('mode') === 'signup') {
        setMode('signup');
      } else {
        setMode('login');
      }
      setAccountNotice(null);
    }
  }, [location.pathname, location.search]);

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

  const phoneValidation = useMemo(() => {
    return validatePhoneNumber(countryCode, phoneNumber);
  }, [countryCode, phoneNumber]);
  const isPhoneValid = phoneValidation.isValid;

  const handlePhoneChange = (raw) => {
    let cleaned = String(raw || '').replace(/\D/g, '');
    if (countryCode === '+91' && cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.slice(2);
    }
    cleaned = cleaned.slice(0, 10);
    setPhoneNumber(cleaned);
    setError('');
    setAccountNotice(null);
  };

  const handleContinue = async (e) => {
    e.preventDefault();

    if (!isPhoneValid) {
      if (phoneValidation.error) {
        setError(phoneValidation.error);
      }
      return;
    }

    if (!captchaToken) {
      setError('Please complete the CAPTCHA.');
      return;
    }

    setError('');
    setAccountNotice(null);

    const result = await sendOtp(phoneValidation.normalizedNumber, {
      countryCode: phoneValidation.countryCode,
      localNumber: phoneValidation.localNumber,
      mode,
      captchaToken,
    });

    if (result && result.success) {
      navigate('/verify-otp');
    } else if (result) {
      if (result.code === 'ACCOUNT_NOT_FOUND') {
        setAccountNotice({
          type: 'not_found',
          message: 'No account found with this number.',
        });
      } else if (result.code === 'ACCOUNT_ALREADY_EXISTS') {
        setAccountNotice({
          type: 'already_exists',
          message: 'An account already exists with this number.',
        });
      } else if (result.code === 'CAPTCHA_REQUIRED' || result.code === 'CAPTCHA_FAILED') {
        setError(result.error || 'Please complete the CAPTCHA.');
        setCaptchaToken('');
        setCaptchaResetTrigger((prev) => prev + 1);
      } else {
        setError(result.error || 'Failed to send OTP.');
      }
    }
  };

  const handleGoogleAuth = () => {
    toast('Google authentication will connect with your Google workspace account.', {
      icon: '🔐',
      duration: 3500,
    });
  };

  const toggleMode = (targetMode) => {
    setMode(targetMode);
    setError('');
    setAccountNotice(null);
    const targetUrl = targetMode === 'signup' ? '/signup' : '/login';
    if (location.pathname !== targetUrl) {
      window.history.replaceState(null, '', targetUrl);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-8 max-w-md mx-auto text-text-primary">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors py-1 px-2 -ml-1 rounded-lg hover:bg-surface-hover"
        >
          <ArrowLeft size={16} />
          <span>Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5 shadow-md shadow-rose-900/30 flex-shrink-0">
            <div className="w-full h-full bg-[#141212] rounded-[5px] flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-[#F43F6E]" />
            </div>
          </div>
          <span className="font-extrabold text-sm text-text-primary tracking-tight inline-flex items-center gap-1.5 whitespace-nowrap leading-none">
            <span>Tinder for Freelancers</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 leading-none">
              Beta
            </span>
          </span>
        </div>

        <button
          onClick={() => setShowHowItWorks(true)}
          className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors flex items-center gap-1 py-1 px-2 rounded-full border border-border bg-surface hover:bg-surface-hover"
          aria-label="How It Works"
        >
          <HelpCircle size={13} />
          <span className="hidden sm:inline">Help</span>
        </button>
      </div>

      {/* Main Login Form Container */}
      <div className="my-auto py-6 space-y-6">
        {/* Active Session Notification (if already logged in) */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              <div className="truncate">
                <span className="text-text-muted">Signed in as </span>
                <strong className="text-text-primary">{user?.phone || 'Active User'}</strong>
              </div>
            </div>
            <button
              onClick={() => navigate(isProfileComplete ? '/jobs' : '/profile-setup')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[11px] whitespace-nowrap hover:bg-emerald-600 transition-colors flex items-center gap-1"
            >
              <span>Continue</span>
              <ArrowRight size={12} />
            </button>
          </motion.div>
        )}

        {/* Hero Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles size={13} />
            <span>Swipe. Match. Get Hired.</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>

          <p className="text-text-secondary text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
            {mode === 'signup'
              ? 'Start discovering high-paying freelance contracts matching your skills.'
              : 'Log in to continue finding your next opportunity and managing matches.'}
          </p>
        </div>

        {/* Auth Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface p-5 sm:p-6 rounded-2xl border border-border shadow-card space-y-4"
        >
          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            className="w-full h-12 bg-white hover:bg-neutral-100 text-[#141212] font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] border border-border shadow-sm focus:outline-none"
            aria-label="Continue with Google"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span className="truncate">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-surface px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              or continue with phone
            </span>
          </div>

          {/* Phone Form */}
          <form onSubmit={handleContinue} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-text-secondary font-bold uppercase tracking-wider">
                  Mobile Number
                </label>
                <span className="text-[11px] text-text-muted truncate max-w-[150px]">
                  {selectedCountry.name}
                </span>
              </div>

              <div className="flex gap-2 items-center">
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
                    <span className="text-base leading-none">{selectedCountry.flag}</span>
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
                        className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-elevated w-72 max-w-[calc(100vw-3rem)] max-h-64 flex flex-col overflow-hidden"
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
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text');
                    handlePhoneChange(pasted);
                  }}
                  className="flex-1 min-w-0 bg-surface-hover border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30 text-sm font-mono tracking-wide"
                  autoComplete="tel"
                  autoFocus
                />
              </div>

              {/* Dialing info */}
              <div className="flex justify-between items-center px-1 text-[11px] text-text-muted">
                <span className="truncate max-w-[200px]">
                  Dialing: <strong className="text-text-primary font-medium">{countryCode}</strong>
                </span>
              </div>

              {/* CAPTCHA Widget */}
              <CaptchaWidget
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setError('');
                }}
                onExpire={() => {
                  setCaptchaToken('');
                }}
                resetTrigger={captchaResetTrigger}
              />

              {/* Account Existence Notice with CTA */}
              {accountNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2.5 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-rose-400 mt-0.5 flex-shrink-0" />
                    <span className="text-text-primary font-medium">{accountNotice.message}</span>
                  </div>
                  {accountNotice.type === 'not_found' ? (
                    <button
                      type="button"
                      onClick={() => toggleMode('signup')}
                      className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Create Account</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleMode('login')}
                      className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Log In</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </motion.div>
              )}

              {/* Error */}
              {(error || authError) && !accountNotice && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{error || authError}</p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              disabled={!isPhoneValid || authLoading}
              loading={authLoading}
              className="mt-2"
              icon={<Phone size={16} />}
            >
              {authLoading 
                ? 'Sending code...' 
                : (mode === 'signup' ? 'Create Account' : 'Continue')}
            </Button>

            <p className="text-[11px] text-text-muted text-center pt-1">
              By continuing, you agree to our Terms of Service & Privacy Policy.
            </p>
          </form>

          {/* Bottom Switch between Login and Sign Up */}
          <div className="pt-3 text-center text-xs text-text-secondary border-t border-border/60">
            {mode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => toggleMode('login')}
                  className="font-bold text-primary hover:underline px-1 py-0.5 focus:outline-none"
                >
                  Log in
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => toggleMode('signup')}
                  className="font-bold text-primary hover:underline px-1 py-0.5 focus:outline-none"
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Footer / Tour Link */}
      <div className="space-y-3 pt-4 text-center">
        <div>
          <Link
            to="/welcome"
            className="text-xs font-semibold text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <span>Explore Feature Preview & Tour</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

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
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E11D48] to-[#F43F6E] p-0.5">
                    <div className="w-full h-full bg-[#141212] rounded-[5px] flex items-center justify-center">
                      <Briefcase className="w-3.5 h-3.5 text-[#F43F6E]" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-text-primary">How It Works</h3>
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
                {[
                  { step: '1', title: 'Swipe', desc: 'Browse live client opportunities from Reddit, YouTube, X, and custom sources.', badge: 'Swipe Right = Apply' },
                  { step: '2', title: 'Match', desc: 'Intelligent scoring pairs you with high-paying client contracts.', badge: 'Match Score' },
                  { step: '3', title: 'Apply', desc: 'Auto-personalized outreach sent directly via Email or WhatsApp.', badge: 'Direct Outreach' },
                  { step: '4', title: 'Get Hired', desc: 'Track replies, schedule calls, and close freelance clients in your CRM.', badge: 'CRM Pipeline' },
                ].map((item) => (
                  <div key={item.step} className="p-3.5 rounded-xl border border-border bg-surface-hover/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-text-primary flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                          {item.step}
                        </span>
                        {item.title}
                      </span>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-text-secondary text-[11px] pl-7">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-border bg-surface flex items-center justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowHowItWorks(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

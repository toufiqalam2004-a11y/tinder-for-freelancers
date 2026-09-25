import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

const OTP_LENGTH = 4;

const OTPVerification = () => {
  const navigate = useNavigate();
  const { phone, countryCode, localNumber, verifyOtp, sendOtp, authLoading, authError, DEMO_OTP, isDemo } = useAuth();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerifyingState, setIsVerifyingState] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const inputRefs = useRef([]);
  const prefersReducedMotion = useReducedMotion();

  // Redirect to Welcome if no phone is set
  useEffect(() => {
    if (!phone && !localNumber) {
      navigate('/', { replace: true });
    }
  }, [phone, localNumber, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    setCanResend(false);
    const interval = setInterval(() => {
      setResendTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Clear local error when user modifies OTP
  const handleOtpChange = (newOtp) => {
    setOtp(newOtp);
    if (localError) setLocalError('');
  };

  const handleVerify = useCallback(
    async (code) => {
      const otpCode = code || otp.join('');
      if (otpCode.length !== OTP_LENGTH || isVerifyingState || isSuccessState) return;

      setIsVerifyingState(true);
      setLocalError('');

      // Allow 600ms for transformation animation before triggering auth verification
      await new Promise((resolve) => setTimeout(resolve, 600));

      try {
        const result = await verifyOtp(otpCode);
        if (result && result.success) {
          setIsSuccessState(true);
          setIsVerifyingState(false);
          // Brief success hold before continuing login flow
          setTimeout(() => {
            const isNew = result.user?.isNewUser ?? result.isNewUser;
            if (isNew) {
              navigate('/profile-setup');
            } else {
              navigate('/jobs');
            }
          }, 800);
        } else {
          setIsVerifyingState(false);
          setIsShaking(true);
          setLocalError(result?.error || authError || 'Invalid OTP code. Please try again.');
          setTimeout(() => {
            setIsShaking(false);
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
          }, 600);
        }
      } catch (err) {
        setIsVerifyingState(false);
        setIsShaking(true);
        setLocalError(err?.message || 'Verification failed. Please try again.');
        setTimeout(() => {
          setIsShaking(false);
          setOtp(Array(OTP_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
        }, 600);
      }
    },
    [otp, verifyOtp, navigate, authError, isVerifyingState, isSuccessState]
  );

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    handleOtpChange(newOtp);

    // Auto-advance to next slot
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 4th digit
    if (digit && index === OTP_LENGTH - 1) {
      const code = newOtp.join('');
      if (code.length === OTP_LENGTH) {
        handleVerify(code);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      handleOtpChange(newOtp);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted) {
      const newOtp = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      handleOtpChange(newOtp);

      const nextEmpty = newOtp.findIndex((d) => !d);
      inputRefs.current[nextEmpty !== -1 ? nextEmpty : OTP_LENGTH - 1]?.focus();

      if (pasted.length === OTP_LENGTH) {
        handleVerify(pasted);
      }
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setOtp(Array(OTP_LENGTH).fill(''));
    setLocalError('');
    setIsSuccessState(false);
    setIsVerifyingState(false);
    const result = await sendOtp(phone, { countryCode, localNumber });
    if (result && !result.success && result.remainingSeconds) {
      setResendTimer(result.remainingSeconds);
    }
    inputRefs.current[0]?.focus();
  };

  // Mask phone number
  const maskedPhone = localNumber
    ? `${countryCode || '+91'} •••• ${localNumber.slice(-4)}`
    : phone
    ? phone.slice(0, 3) + '••••' + phone.slice(-4)
    : '';

  const isComplete = otp.join('').length === OTP_LENGTH;
  // Orbit layout triggers ONLY during verification request or upon success confirmation
  const isOrbitActive = isVerifyingState || isSuccessState;

  // Calculate orbital target positions around a 130px circle relative to container center
  // Index 0: Left (-55px, 0px)
  // Index 1: Top (0px, -55px)
  // Index 2: Right (55px, 0px)
  // Index 3: Bottom (0px, 55px)
  const getOrbitalOffset = (index) => {
    if (prefersReducedMotion) return { x: 0, y: 0 };
    switch (index) {
      case 0:
        return { x: -55, y: 0 };
      case 1:
        return { x: 0, y: -55 };
      case 2:
        return { x: 55, y: 0 };
      case 3:
        return { x: 0, y: 55 };
      default:
        return { x: 0, y: 0 };
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col px-6 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="self-start text-text-secondary hover:text-text-primary transition-colors mb-6"
        aria-label="Back to Login"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {/* Header Icon */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-4">
          <ShieldCheck size={32} className="text-primary-light" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl font-bold text-text-primary text-center">
          Verify your phone
        </h1>
        <p className="text-text-secondary text-sm mt-1 text-center">
          Enter the 4-digit OTP sent to{' '}
          <span className="text-text-primary font-medium">{maskedPhone}</span>
        </p>

        {/* ORBITAL / INPUT CONTAINER */}
        <div className="relative mt-8 mb-6 w-full max-w-full flex items-center justify-center min-h-[170px] overflow-visible box-border">
          {/* Circular Orbit Ring Background */}
          <AnimatePresence>
            {isOrbitActive && !prefersReducedMotion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`absolute w-36 h-36 rounded-full border border-dashed pointer-events-none transition-colors duration-500 ${
                  isSuccessState
                    ? 'border-emerald-500/60 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(236,72,153,0.15)]'
                }`}
              />
            )}
          </AnimatePresence>

          {/* Glowing Center Core Dot / Success Icon */}
          <AnimatePresence>
            {isOrbitActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="absolute z-20 flex items-center justify-center"
              >
                {isSuccessState ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                    className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                  >
                    <CheckCircle2 size={22} />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={
                      isVerifyingState
                        ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }
                        : { scale: [1, 1.1, 1] }
                    }
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_12px_rgba(236,72,153,0.8)]"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 4 OTP DIGIT SLOTS (Responsive, Centered, Zero Horizontal Overflow) */}
          <motion.div
            animate={isShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="relative flex items-center justify-center gap-2 sm:gap-3 max-w-full box-border"
          >
            {otp.map((digit, index) => {
              const orbitalOffset = getOrbitalOffset(index);

              return (
                <motion.div
                  key={index}
                  layout
                  animate={
                    isOrbitActive
                      ? {
                          x: orbitalOffset.x,
                          y: orbitalOffset.y,
                          scale: isSuccessState ? 0.95 : 0.9,
                        }
                      : {
                          x: 0,
                          y: 0,
                          scale: 1,
                        }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 22,
                  }}
                  className="relative z-10 flex-shrink-0"
                >
                  <input
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={isVerifyingState || isSuccessState}
                    style={{
                      width: 'clamp(44px, 11vw, 56px)',
                      height: 'clamp(52px, 13vw, 64px)',
                    }}
                    className={`
                      text-center text-xl sm:text-2xl font-bold rounded-2xl border outline-none
                      transition-all duration-300 select-none box-border
                      ${
                        isSuccessState
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                          : localError
                          ? 'bg-rose-500/10 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                          : digit
                          ? 'bg-primary/10 border-primary text-text-primary shadow-[0_0_12px_rgba(236,72,153,0.15)]'
                          : 'bg-surface-hover border-border text-text-primary'
                      }
                      focus:border-primary focus:ring-2 focus:ring-primary/25
                    `}
                    autoComplete="one-time-code"
                    aria-label={`OTP Digit ${index + 1}`}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Verification Status / Error Display */}
        <div className="min-h-[28px] text-center mb-2">
          {isVerifyingState && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold text-primary-light flex items-center justify-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              Verifying OTP code...
            </motion.p>
          )}

          {isSuccessState && (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1"
            >
              <CheckCircle2 size={14} />
              OTP Verified Successfully!
            </motion.p>
          )}

          {(localError || authError) && !isVerifyingState && !isSuccessState && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-medium text-rose-400 flex items-center justify-center gap-1"
            >
              <AlertCircle size={14} />
              {localError || authError}
            </motion.p>
          )}
        </div>

        {/* Verify Button */}
        <div className="w-full mt-4">
          <Button
            variant="primary"
            fullWidth
            loading={authLoading || isVerifyingState}
            onClick={() => handleVerify()}
            disabled={!isComplete || isVerifyingState || isSuccessState}
          >
            {isSuccessState ? 'Verified!' : 'Verify OTP'}
          </Button>
        </div>

        {/* Resend OTP */}
        <div className="mt-5 text-center">
          {canResend ? (
            <button
              onClick={handleResend}
              disabled={isVerifyingState || isSuccessState}
              className="text-primary-light text-sm font-medium hover:underline transition-colors disabled:opacity-50"
            >
              Resend OTP
            </button>
          ) : (
            <p className="text-text-muted text-sm">
              Didn't receive the code?{' '}
              <span className="text-text-secondary font-medium tabular-nums">
                Resend in {resendTimer}s
              </span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OTPVerification;

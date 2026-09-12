import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

const OTP_LENGTH = 6;

const OTPVerification = () => {
  const navigate = useNavigate();
  const { phone, verifyOtp, sendOtp, authLoading, authError, DEMO_OTP } = useAuth();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
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
      setOtp(newOtp);
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
      setOtp(newOtp);
      // Focus the next empty input or the last one
      const nextEmpty = newOtp.findIndex((d) => !d);
      inputRefs.current[nextEmpty !== -1 ? nextEmpty : OTP_LENGTH - 1]?.focus();

      if (pasted.length === OTP_LENGTH) {
        handleVerify(pasted);
      }
    }
  };

  const handleVerify = useCallback(
    async (code) => {
      const otpCode = code || otp.join('');
      if (otpCode.length !== OTP_LENGTH) return;

      const result = await verifyOtp(otpCode);
      if (result.success) {
        navigate('/profile-setup');
      }
    },
    [otp, verifyOtp, navigate]
  );

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(30);
    setOtp(Array(OTP_LENGTH).fill(''));
    await sendOtp(phone);
    inputRefs.current[0]?.focus();
  };

  // Mask phone number: +91****1234
  const maskedPhone = phone
    ? phone.slice(0, 3) + '••••' + phone.slice(-4)
    : '';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.button
        variants={itemVariants}
        onClick={() => navigate('/')}
        className="self-start text-text-secondary hover:text-text-primary transition-colors mb-8"
      >
        <ArrowLeft size={24} />
      </motion.button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {/* Icon */}
        <motion.div
          variants={itemVariants}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6"
        >
          <ShieldCheck size={32} className="text-primary-light" />
        </motion.div>

        {/* Title */}
        <motion.h1 variants={itemVariants} className="text-2xl font-bold text-text-primary text-center">
          Verify your phone
        </motion.h1>

        {/* Subtitle */}
        <motion.p variants={itemVariants} className="text-text-secondary text-sm mt-2 text-center">
          Enter the 6-digit OTP sent to{' '}
          <span className="text-text-primary font-medium">{maskedPhone}</span>
        </motion.p>

        {/* OTP Input boxes */}
        <motion.div variants={itemVariants} className="flex gap-2.5 mt-8 w-full justify-center">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`
                w-12 h-14 text-center text-xl font-bold rounded-input border outline-none
                transition-all duration-200
                ${digit
                  ? 'bg-primary/10 border-primary text-text-primary'
                  : 'bg-surface-hover border-border text-text-primary'
                }
                focus:border-primary focus:ring-2 focus:ring-primary/20
              `}
              autoComplete="one-time-code"
            />
          ))}
        </motion.div>

        {/* Error */}
        {authError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-error text-sm mt-3 text-center"
          >
            {authError}
          </motion.p>
        )}

        {/* Verify button */}
        <motion.div variants={itemVariants} className="w-full mt-6">
          <Button
            variant="primary"
            fullWidth
            loading={authLoading}
            onClick={() => handleVerify()}
            disabled={otp.join('').length !== OTP_LENGTH}
          >
            Verify OTP
          </Button>
        </motion.div>

        {/* Resend */}
        <motion.div variants={itemVariants} className="mt-5 text-center">
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-primary-light text-sm font-medium hover:underline transition-colors"
            >
              Resend OTP
            </button>
          ) : (
            <p className="text-text-muted text-sm">
              Resend OTP in{' '}
              <span className="text-text-secondary font-medium tabular-nums">
                {resendTimer}s
              </span>
            </p>
          )}
        </motion.div>

        {/* Demo hint */}
        <motion.div
          variants={itemVariants}
          className="mt-8 bg-surface border border-border rounded-card px-4 py-3 w-full"
        >
          <p className="text-xs text-text-muted text-center">
            Demo Mode — Enter OTP{' '}
            <span className="text-primary-light font-mono font-semibold tracking-widest">
              {DEMO_OTP}
            </span>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OTPVerification;

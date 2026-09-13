import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAuth, setAuth as persistAuth, getSessionPhoto, saveSessionPhoto, removeSessionPhoto, clearAllSessionPhotos } from '../data/storage.js';
import { apiClient } from '../services/apiClient.js';
import { validatePhoneNumber } from '../utils/validators.js';
import { subscriptionService } from '../services/subscriptionService.js';
import { normalizePlan, isProPlan } from '../utils/planUtils.js';
import toast from 'react-hot-toast';
import { rewardService } from '../services/rewardService.js';

const AuthContext = createContext(null);

const DEMO_OTP = '123456';

export function AuthProvider({ children }) {
  const initialAuth = getAuth() || {};
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!initialAuth.isAuthenticated;
  });
  const [phone, setPhone] = useState(() => {
    return initialAuth.phone || '';
  });
  const [countryCode, setCountryCode] = useState(() => {
    return initialAuth.countryCode || '+91';
  });
  const [localNumber, setLocalNumber] = useState(() => {
    return initialAuth.localNumber || '';
  });
  const [verificationId, setVerificationId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [demoCode, setDemoCode] = useState('123456');
  const [plan, setPlan] = useState(() => subscriptionService.getSubscription().plan);

  // Session-scoped profile photo
  const [profilePhoto, setProfilePhotoState] = useState(() => getSessionPhoto());

  useEffect(() => {
    const handlePhotoChanged = (e) => {
      setProfilePhotoState(e.detail?.photo || null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('tf_profile_photo_changed', handlePhotoChanged);
      return () => window.removeEventListener('tf_profile_photo_changed', handlePhotoChanged);
    }
  }, []);

  const setProfilePhoto = useCallback((photo) => {
    setProfilePhotoState(photo || null);
    const targetUser = phone || initialAuth.userId || 'current';
    if (photo) {
      saveSessionPhoto(targetUser, photo);
    } else {
      removeSessionPhoto(targetUser);
    }
  }, [phone, initialAuth.userId]);

  useEffect(() => {
    const handleSubChanged = (e) => {
      setPlan(normalizePlan(e.detail?.plan));
    };
    window.addEventListener('tf_subscription_changed', handleSubChanged);
    return () => window.removeEventListener('tf_subscription_changed', handleSubChanged);
  }, []);

  const sendOtp = useCallback(async (phoneNumber, details = {}) => {
    setAuthLoading(true);
    setAuthError('');

    const targetLocal = details.localNumber || phoneNumber;
    const targetCc = details.countryCode || countryCode || '+91';
    
    // Frontend validation guard: exact 10 digits
    const validation = validatePhoneNumber(targetCc, targetLocal);
    if (!validation.isValid) {
      setAuthError(validation.error);
      setAuthLoading(false);
      return { success: false, error: validation.error };
    }

    try {
      const result = await apiClient.sendOtp(validation.normalizedNumber, {
        countryCode: validation.countryCode,
        localNumber: validation.localNumber,
      });

      if (result.success) {
        const finalPhone = result.phone || validation.normalizedNumber;
        const finalCc = result.countryCode || validation.countryCode;
        const finalLocal = result.localNumber || validation.localNumber;

        setPhone(finalPhone);
        setCountryCode(finalCc);
        setLocalNumber(finalLocal);
        setIsDemo(result.isDemo !== false);
        setDemoCode(result.demoCode || (result.isDemo !== false ? '123456' : ''));
        setVerificationId(result.verificationId || 'otp-session');
        persistAuth({
          isAuthenticated: false,
          phone: finalPhone,
          countryCode: finalCc,
          localNumber: finalLocal,
        });
      } else {
        setAuthError(result.error || 'Failed to send OTP.');
      }
      return result;
    } catch (e) {
      const errMsg = e.message || 'Failed to send OTP. Please try again.';
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setAuthLoading(false);
    }
  }, [countryCode]);

  const verifyOtp = useCallback(async (code) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const pendingRef = rewardService.getPendingReferralCode();
      const result = await apiClient.verifyOtp(phone, code, {
        countryCode,
        localNumber,
        referralCode: pendingRef,
      });

      if (result.success) {
        setIsAuthenticated(true);
        // Every new login session starts with an empty profile-photo state
        setProfilePhotoState(null);
        clearAllSessionPhotos();
        persistAuth({
          isAuthenticated: true,
          phone,
          countryCode,
          localNumber,
          token: result.token,
          userId: result.user?.id || phone,
          referralCode: result.user?.referralCode || null,
        });

        // Sync subscription from server
        subscriptionService.fetchServerSubscription().then((s) => {
          if (s?.plan) setPlan(normalizePlan(s.plan));
        }).catch(() => {});

        // Referral bonus notification if granted
        if (result.referralReward?.granted) {
          toast.success('🎉 Referral Bonus\nYou received +5 application credits!', { duration: 5000 });
          rewardService.clearPendingReferralCode();
        } else if (pendingRef && result.user?.isNewUser) {
          rewardService.claimReferral(pendingRef).then((res) => {
            if (res.granted) {
              toast.success('🎉 Referral Bonus\nYou received +5 application credits!', { duration: 5000 });
            }
          }).catch(() => {});
        }

        // Daily Login Reward: +1 application credit once per calendar day
        rewardService.claimDailyLoginReward().then((dailyRes) => {
          if (dailyRes?.granted) {
            toast.success('🎁 Daily Login Reward\n+1 application credit added!', { duration: 4000 });
          }
        }).catch(() => {});
      } else {
        setAuthError(result.error || 'Invalid OTP. Please try again.');
      }
      return result;
    } catch (e) {
      const errMsg = e.message || 'Verification failed. Please try again.';
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setAuthLoading(false);
    }
  }, [phone, countryCode, localNumber]);

  const logout = useCallback(() => {
    const currentAuth = getAuth() || {};
    if (currentAuth.token) {
      apiClient.logout(currentAuth.token).catch(() => {});
    }
    setIsAuthenticated(false);
    setPhone('');
    setVerificationId(null);
    setProfilePhotoState(null);
    clearAllSessionPhotos();
    persistAuth({ isAuthenticated: false, phone: '', userId: '' });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        phone,
        countryCode,
        localNumber,
        verificationId,
        authLoading,
        authError,
        sendOtp,
        verifyOtp,
        logout,
        isDemo,
        demoCode,
        DEMO_OTP: isDemo ? (demoCode || '123456') : null,
        plan,
        isPro: isProPlan(plan),
        profilePhoto,
        setProfilePhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

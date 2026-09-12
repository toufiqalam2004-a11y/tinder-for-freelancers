import { createContext, useContext, useState, useCallback } from 'react';
import { getAuth, setAuth as persistAuth } from '../data/storage.js';
import { apiClient } from '../services/apiClient.js';
import { validatePhoneNumber } from '../utils/validators.js';

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
      const result = await apiClient.verifyOtp(phone, code, {
        countryCode,
        localNumber,
      });

      if (result.success) {
        setIsAuthenticated(true);
        persistAuth({
          isAuthenticated: true,
          phone,
          countryCode,
          localNumber,
          token: result.token,
        });
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
    setIsAuthenticated(false);
    setPhone('');
    setVerificationId(null);
    persistAuth({ isAuthenticated: false, phone: '' });
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

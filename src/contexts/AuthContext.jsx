import { createContext, useContext, useState, useCallback } from 'react';
import { getAuth, setAuth as persistAuth } from '../data/storage';

const AuthContext = createContext(null);

// --- Auth Service Abstraction ---
// Replace this with Firebase Phone Auth / Twilio / any real OTP provider.
// The rest of the app only calls sendOtp() and verifyOtp() — it never
// knows which provider is behind them.

const DEMO_OTP = '123456';

const authService = {
  /**
   * Send OTP to the given phone number.
   * In demo mode this is a no-op that always succeeds.
   * Replace with: firebase.auth().signInWithPhoneNumber(phone, appVerifier)
   */
  sendOtp: async (phone) => {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    // In production, return a verification ID / confirmation result
    return { success: true, verificationId: 'demo-verification' };
  },

  /**
   * Verify the OTP code.
   * In demo mode accepts '123456'.
   * Replace with: confirmationResult.confirm(code)
   */
  verifyOtp: async (verificationId, code) => {
    await new Promise((r) => setTimeout(r, 600));
    if (code === DEMO_OTP) {
      return { success: true, user: { phone: verificationId } };
    }
    return { success: false, error: 'Invalid OTP. Please try again.' };
  },
};

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return getAuth().isAuthenticated;
  });
  const [phone, setPhone] = useState(() => {
    return getAuth().phone || '';
  });
  const [verificationId, setVerificationId] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const sendOtp = useCallback(async (phoneNumber) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await authService.sendOtp(phoneNumber);
      if (result.success) {
        setPhone(phoneNumber);
        setVerificationId(result.verificationId);
      }
      return result;
    } catch (e) {
      setAuthError('Failed to send OTP. Please try again.');
      return { success: false, error: e.message };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (code) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await authService.verifyOtp(phone, code);
      if (result.success) {
        setIsAuthenticated(true);
        persistAuth({ isAuthenticated: true, phone });
      } else {
        setAuthError(result.error);
      }
      return result;
    } catch (e) {
      setAuthError('Verification failed. Please try again.');
      return { success: false, error: e.message };
    } finally {
      setAuthLoading(false);
    }
  }, [phone]);

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
        verificationId,
        authLoading,
        authError,
        sendOtp,
        verifyOtp,
        logout,
        DEMO_OTP,
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

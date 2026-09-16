import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAdminApiBaseUrl } from '../../config/apiConfig.js';

const AdminContext = createContext(null);

const ADMIN_TOKEN_KEY = 'tf_admin_session_token';

export function AdminProvider({ children }) {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [adminUser, setAdminUser] = useState(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState(null);

  // Authenticated fetch wrapper
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options.headers || {}),
    };

    const adminBase = getAdminApiBaseUrl();
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${adminBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, { ...options, headers });

    if (res.status === 403) {
      // If forbidden, admin session is invalid
      logout();
      throw new Error('Admin session expired or access denied.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Admin request failed.');
    }
    return data;
  };

  // Verify active admin session
  const verifySession = async () => {
    if (!adminToken) {
      setIsVerifying(false);
      return false;
    }
    try {
      const data = await apiFetch('/auth/me');
      if (data.success && data.admin) {
        setAdminUser(data.admin);
        setIsVerifying(false);
        return true;
      }
      logout();
      return false;
    } catch (e) {
      logout();
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, [adminToken]);

  // Admin login
  const login = async (passkey, phone = null) => {
    setError(null);
    try {
      const res = await fetch(`${getAdminApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey, phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed.');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
      setAdminUser(data.admin);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Admin logout
  const logout = async () => {
    if (adminToken) {
      try {
        await fetch(`${getAdminApiBaseUrl()}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
        });
      } catch (e) {
        // ignore logout network errors
      }
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setAdminUser(null);
    setIsVerifying(false);
  };

  return (
    <AdminContext.Provider
      value={{
        adminToken,
        adminUser,
        isAuthenticated: !!adminToken && !!adminUser,
        isVerifying,
        error,
        login,
        logout,
        apiFetch,
        verifySession,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return ctx;
}

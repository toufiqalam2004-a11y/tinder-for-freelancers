import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { getUser, saveUser as persistUser, getCurrentUserId } from '../data/storage.js';
import { createUser } from '../data/models.js';
import { getApiUrl } from '../config/apiConfig.js';

import { checkProfileCompletion } from '../utils/profileValidator.js';
export { checkProfileCompletion };

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    const uid = getCurrentUserId();
    return uid && uid !== 'user-default' ? getUser(uid) : null;
  });

  const loadProfile = useCallback(async () => {
    const currentUid = getCurrentUserId();
    if (!currentUid || currentUid === 'user-default') {
      setProfile(null);
      return;
    }
    const local = getUser(currentUid);
    setProfile(local || null);

    // Live sync with backend
    try {
      const headers = {};
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawAuth = window.localStorage.getItem('tf_auth');
        if (rawAuth) {
          const auth = JSON.parse(rawAuth);
          if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
          if (auth.userId) headers['x-user-id'] = auth.userId;
        }
      }
      if (currentUid) headers['x-user-id'] = currentUid;

      const res = await fetch(getApiUrl('/profile'), { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          persistUser(data.profile);
        } else if (!local) {
          setProfile(null);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadProfile();
    if (typeof window !== 'undefined') {
      window.addEventListener('tf_auth_changed', loadProfile);
      return () => window.removeEventListener('tf_auth_changed', loadProfile);
    }
  }, [loadProfile]);

  const saveProfile = useCallback((data) => {
    const currentUid = getCurrentUserId();
    const current = getUser(currentUid) || profile || {};
    const user = createUser({
      ...current,
      ...data,
      id: current.id || (currentUid !== 'user-default' ? currentUid : undefined),
      updatedAt: new Date().toISOString(),
    });
    setProfile(user);
    persistUser(user);

    // Sync profile live with backend database
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawAuth = window.localStorage.getItem('tf_auth');
        if (rawAuth) {
          const auth = JSON.parse(rawAuth);
          if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
          if (auth.userId) headers['x-user-id'] = auth.userId;
        }
      }
      const effectiveId = user.id || currentUid;
      if (effectiveId && effectiveId !== 'user-default') headers['x-user-id'] = effectiveId;

      return fetch(getApiUrl('/profile'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...user, userId: effectiveId }),
      })
        .then(async (res) => {
          const result = await res.json().catch(() => ({}));
          if (!res.ok) {
            const err = new Error(result.error || 'Failed to save profile');
            err.status = res.status;
            err.code = result.code;
            err.suggestions = result.suggestions;
            throw err;
          }
          if (result && result.profile) {
            setProfile(result.profile);
            persistUser(result.profile);
            return result.profile;
          }
          return user;
        });
    } catch (err) {
      return Promise.reject(err);
    }
  }, [profile]);

  const isProfileComplete = useMemo(() => {
    return checkProfileCompletion(profile);
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, isProfileComplete, reloadProfile: loadProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}

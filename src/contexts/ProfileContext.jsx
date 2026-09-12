import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getUser, saveUser as persistUser } from '../data/storage';
import { createUser } from '../data/models';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => getUser());

  const saveProfile = useCallback((data) => {
    const user = createUser({ ...profile, ...data, updatedAt: new Date().toISOString() });
    setProfile(user);
    persistUser(user);
  }, [profile]);

  const isProfileComplete = useMemo(() => {
    if (!profile) return false;
    return !!(profile.name && profile.profession && profile.category && profile.specialization);
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, isProfileComplete }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}

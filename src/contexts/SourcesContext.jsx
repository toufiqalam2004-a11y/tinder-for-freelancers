import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getSources,
  addSource as persistAdd,
  removeSource as persistRemove,
  updateSource as persistUpdate,
  toggleSourceEnabled as persistToggle,
  getAuth,
} from '../data/storage.js';
import { createJobSource } from '../data/models.js';
import { monitoringService } from '../services/monitoringService';
import { subscriptionService } from '../services/subscriptionService';
import { getApiUrl } from '../config/apiConfig.js';

const SourcesContext = createContext(null);

export function SourcesProvider({ children }) {
  const [sources, setSources] = useState(() => getSources());

  const syncFromServer = useCallback(async () => {
    const auth = getAuth();
    const token = auth?.token;
    const currentUserId = auth?.userId;
    if (!token && !currentUserId) return;
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUserId) headers['x-user-id'] = currentUserId;
      const res = await fetch(getApiUrl('/sources'), { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.customSources)) {
          const builtin = getBuiltinSources();
          const userCustom = data.customSources.filter(
            (s) => s.userId === currentUserId || s.ownerUserId === currentUserId
          );
          const merged = [...builtin, ...userCustom];
          saveSources(merged);
          setSources(merged);
        }
      }
    } catch {}
  }, []);

  const reloadSources = useCallback(() => {
    setSources(getSources());
    syncFromServer();
  }, [syncFromServer]);

  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  useEffect(() => {
    window.addEventListener('storage', reloadSources);
    window.addEventListener('tf_auth_changed', reloadSources);
    window.addEventListener('tf_subscription_changed', reloadSources);
    return () => {
      window.removeEventListener('storage', reloadSources);
      window.removeEventListener('tf_auth_changed', reloadSources);
      window.removeEventListener('tf_subscription_changed', reloadSources);
    };
  }, [reloadSources]);

  const builtinSources = useMemo(() => {
    return sources.filter((s) => s.type === 'builtin' || s.isBuiltin || s.isDemo);
  }, [sources]);

  const customSources = useMemo(() => {
    const auth = getAuth();
    const currentUserId = auth?.userId;
    return sources.filter((s) => {
      const isBuiltin = s.type === 'builtin' || s.isBuiltin || s.isDemo;
      if (isBuiltin) return false;
      if (currentUserId) {
        return s.userId === currentUserId || s.ownerUserId === currentUserId;
      }
      return true;
    });
  }, [sources]);

  const addSource = useCallback(
    async (data) => {
      const auth = getAuth();
      const currentUserId = auth?.userId || null;

      // Check client-side limit
      const check = subscriptionService.canAddSource(customSources.length);
      if (!check.allowed) {
        const err = new Error(check.reason);
        err.code = 'SOURCE_LIMIT_REACHED';
        err.limit = check.limit;
        err.current = check.current;
        throw err;
      }

      const source = createJobSource({
        ...data,
        type: 'custom',
        userId: currentUserId,
        ownerUserId: currentUserId,
      });

      // Try backend sync if available
      try {
        const token = auth?.token;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentUserId) headers['x-user-id'] = currentUserId;

        const res = await fetch(getApiUrl('/sources'), {
          method: 'POST',
          headers,
          body: JSON.stringify(source),
        });

        if (res.status === 403) {
          const json = await res.json();
          const err = new Error(json.message || json.error || 'Custom source limit reached.');
          err.code = json.code || 'SOURCE_LIMIT_REACHED';
          err.limit = json.limit;
          err.current = json.current;
          throw err;
        }
        if (res.status === 409) {
          const json = await res.json();
          const err = new Error(json.message || 'This source has already been added.');
          err.code = 'DUPLICATE_SOURCE';
          throw err;
        }
      } catch (e) {
        if (e.code === 'SOURCE_LIMIT_REACHED' || e.code === 'DUPLICATE_SOURCE') {
          throw e;
        }
        // If network error, continue with local storage
      }

      const updated = persistAdd(source);
      setSources([...updated]);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tf_sources_changed'));
      return source;
    },
    [customSources.length]
  );

  const removeSourceById = useCallback(
    async (id) => {
      const target = sources.find((s) => s.id === id);
      if (target?.type === 'builtin' || target?.isBuiltin || target?.isDemo) {
        return;
      }

      const auth = getAuth();
      try {
        const token = auth?.token;
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (auth?.userId) headers['x-user-id'] = auth.userId;

        await fetch(getApiUrl(`/sources/${id}`), {
          method: 'DELETE',
          headers,
        });
      } catch {
        // Local fallback
      }

      const updated = persistRemove(id, auth?.userId);
      setSources([...updated]);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tf_sources_changed'));
    },
    [sources]
  );

  const updateSourceById = useCallback(
    async (id, updates) => {
      const target = sources.find((s) => s.id === id);
      if (target?.type === 'builtin' || target?.isBuiltin || target?.isDemo) {
        return;
      }
      const auth = getAuth();
      try {
        const token = auth?.token;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (auth?.userId) headers['x-user-id'] = auth.userId;

        await fetch(getApiUrl(`/sources/${id}`), {
          method: 'PUT',
          headers,
          body: JSON.stringify(updates),
        });
      } catch {}

      const updated = persistUpdate(id, updates, auth?.userId);
      setSources([...updated]);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tf_sources_changed'));
    },
    [sources]
  );

  const toggleSourceEnabledById = useCallback(
    async (id) => {
      const target = sources.find((s) => s.id === id);
      if (target?.type === 'builtin' || target?.isBuiltin || target?.isDemo) {
        return;
      }
      const auth = getAuth();
      const newEnabled = !target?.enabled;
      try {
        const token = auth?.token;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (auth?.userId) headers['x-user-id'] = auth.userId;

        await fetch(getApiUrl(`/sources/${id}`), {
          method: 'PUT',
          headers,
          body: JSON.stringify({ enabled: newEnabled }),
        });
      } catch {}

      const updated = persistToggle(id, auth?.userId);
      setSources([...updated]);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tf_sources_changed'));
    },
    [sources]
  );

  const refreshSourceById = useCallback(
    async (id) => {
      const source = sources.find((s) => s.id === id);
      if (!source) return null;
      const result = await monitoringService.checkSource(source);
      const updated = persistUpdate(id, {
        lastFetchedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      });
      setSources([...updated]);
      return result;
    },
    [sources]
  );

  const getSourceById = useCallback(
    (id) => {
      return sources.find((s) => s.id === id) || null;
    },
    [sources]
  );

  return (
    <SourcesContext.Provider
      value={{
        sources,
        builtinSources,
        customSources,
        addSource,
        removeSource: removeSourceById,
        updateSource: updateSourceById,
        toggleSourceEnabled: toggleSourceEnabledById,
        refreshSource: refreshSourceById,
        getSourceById,
        reloadSources,
      }}
    >
      {children}
    </SourcesContext.Provider>
  );
}

export function useSources() {
  const context = useContext(SourcesContext);
  if (!context) throw new Error('useSources must be used within SourcesProvider');
  return context;
}

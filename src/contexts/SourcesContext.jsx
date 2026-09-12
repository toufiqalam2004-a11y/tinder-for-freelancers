import { createContext, useContext, useState, useCallback } from 'react';
import {
  getSources,
  addSource as persistAdd,
  removeSource as persistRemove,
  updateSource as persistUpdate,
  toggleSourceEnabled as persistToggle,
} from '../data/storage';
import { createJobSource } from '../data/models';
import { monitoringService } from '../services/monitoringService';

const SourcesContext = createContext(null);

export function SourcesProvider({ children }) {
  const [sources, setSources] = useState(() => getSources());

  const addSource = useCallback((data) => {
    const source = createJobSource(data);
    const updated = persistAdd(source);
    setSources([...updated]);
    return source;
  }, []);

  const removeSourceById = useCallback((id) => {
    const updated = persistRemove(id);
    setSources([...updated]);
  }, []);

  const updateSourceById = useCallback((id, updates) => {
    const updated = persistUpdate(id, updates);
    setSources([...updated]);
  }, []);

  const toggleSourceEnabledById = useCallback((id) => {
    const updated = persistToggle(id);
    setSources([...updated]);
  }, []);

  const refreshSourceById = useCallback(async (id) => {
    const source = sources.find((s) => s.id === id);
    if (!source) return null;
    const result = await monitoringService.checkSource(source);
    // Update local source record with timestamp
    const updated = persistUpdate(id, {
      lastFetchedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
    setSources([...updated]);
    return result;
  }, [sources]);

  const getSourceById = useCallback((id) => {
    return sources.find((s) => s.id === id) || null;
  }, [sources]);

  return (
    <SourcesContext.Provider
      value={{
        sources,
        addSource,
        removeSource: removeSourceById,
        updateSource: updateSourceById,
        toggleSourceEnabled: toggleSourceEnabledById,
        refreshSource: refreshSourceById,
        getSourceById,
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

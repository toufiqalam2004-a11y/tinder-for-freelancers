import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-2.5 text-xs font-semibold shadow-md pointer-events-none"
      >
        {!isOnline ? (
          <div className="bg-stone-900 text-amber-400 dark:bg-stone-800 dark:text-amber-300 px-4 py-1.5 rounded-full border border-amber-500/30 flex items-center gap-2 shadow-elevated">
            <WifiOff size={14} className="animate-pulse" />
            <span>You're offline. Previously loaded opportunities remain readable.</span>
          </div>
        ) : (
          <div className="bg-stone-900 text-emerald-400 dark:bg-stone-800 dark:text-emerald-300 px-4 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-2 shadow-elevated">
            <Wifi size={14} />
            <span>Back online. Live sync active.</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default OfflineBanner;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PageTransition = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen flex-1 ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PageTransition;

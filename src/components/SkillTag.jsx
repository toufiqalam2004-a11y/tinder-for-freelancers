import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const SkillTag = ({ label, onRemove }) => {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1.5 bg-primary/10 text-primary-dark dark:text-primary-light border border-primary/25 rounded-tag px-3 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
    >
      {label}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="focus:outline-none hover:text-text-primary transition-colors ml-0.5"
          aria-label={`Remove ${label}`}
        >
          <X size={12} />
        </button>
      )}
    </motion.span>
  );
};

export default SkillTag;

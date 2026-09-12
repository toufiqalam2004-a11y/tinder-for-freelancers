import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', onClick, ...props }) => {
  const baseStyles = 'bg-surface rounded-card border border-border p-4 shadow-card text-text-primary transition-colors';
  const interactiveStyles = onClick ? 'cursor-pointer hover:bg-surface-hover hover:border-primary/40 transition-all' : '';
  
  return (
    <motion.div
      className={`${baseStyles} ${interactiveStyles} ${className}`.trim()}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;

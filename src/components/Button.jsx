import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  loading,
  fullWidth,
  icon,
  className = '',
  type = 'button',
  ...props
}) => {
  const baseStyles = 'rounded-btn font-medium transition-all duration-200 flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary to-primary-dark text-white hover:shadow-glow',
    secondary: 'bg-surface border border-border text-text-primary hover:bg-surface-hover shadow-sm',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover/60',
  };
  
  const sizes = {
    sm: 'text-sm px-4 py-2',
    md: 'text-sm px-5 py-3',
    lg: 'text-base px-6 py-3.5',
  };
  
  const classes = `
    ${baseStyles}
    ${variants[variant] || variants.primary}
    ${sizes[size] || sizes.md}
    ${fullWidth ? 'w-full' : ''}
    ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <motion.button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={!(disabled || loading) ? { scale: 0.98 } : {}}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  );
};

export default Button;

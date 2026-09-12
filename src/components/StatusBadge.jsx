import React from 'react';

const StatusBadge = ({ status, variant = 'info' }) => {
  const styles = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
    info: 'bg-primary/15 text-primary-dark dark:text-primary-light border border-primary/30',
    muted: 'bg-surface-hover text-text-muted border border-border',
  };
  
  const dots = {
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    error: 'bg-rose-500 dark:bg-rose-400',
    info: 'bg-primary dark:bg-primary-light',
    muted: 'bg-text-muted',
  };

  const badgeStyle = styles[variant] || styles.info;
  const dotStyle = dots[variant] || dots.info;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStyle} transition-colors`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
      <span className="capitalize">{status}</span>
    </span>
  );
};

export default StatusBadge;

import React from 'react';
import Button from './Button';

const EmptyState = ({ icon: Icon, title, subtitle, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="rounded-full bg-surface-hover border border-border p-4 mb-4 shadow-sm">
          <Icon className="w-8 h-8 text-text-muted" size={32} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-text-primary mt-2">{title}</h3>
      {subtitle && (
        <p className="text-sm text-text-secondary mt-1 max-w-[280px] leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && (
        <div className="mt-6">
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;

import React from 'react';

const Input = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  type = 'text',
  className = '',
  name,
  ...props
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="text-sm text-text-secondary mb-1.5 font-medium" htmlFor={name}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`
          w-full bg-surface-hover border rounded-input px-4 py-3 text-text-primary 
          placeholder-text-muted outline-none transition-all
          ${error 
            ? 'border-error focus:ring-1 focus:ring-error/30' 
            : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/30'
          }
        `.trim()}
        {...props}
      />
      {error && (
        <p className="text-error text-xs mt-1.5">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-text-muted text-xs mt-1.5">{helperText}</p>
      )}
    </div>
  );
};

export default Input;

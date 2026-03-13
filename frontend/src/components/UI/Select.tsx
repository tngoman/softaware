import React, { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  required,
  fullWidth = true,
  children,
  className = '',
  ...props
}, ref) => {
  const baseClasses = `
    block w-full px-3 py-2.5 text-sm
    border border-gray-300 rounded-lg
    text-gray-900 bg-white
    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    transition-colors duration-200
    cursor-pointer
    dark:bg-dark-800 dark:border-dark-600 dark:text-gray-100
    dark:focus:ring-blue-400 dark:focus:border-blue-400
    dark:disabled:bg-dark-900 dark:disabled:text-gray-600
  `;

  const errorClasses = error 
    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
    : '';

  return (
    <div className={fullWidth ? 'w-full' : 'w-auto'}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
          {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <select
        ref={ref}
        className={`${baseClasses} ${errorClasses} ${className}`}
        {...props}
      >
        {children}
      </select>
      
      {(error || helperText) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
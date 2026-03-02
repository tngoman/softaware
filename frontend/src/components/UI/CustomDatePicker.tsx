import React from 'react';
import ReactDatePicker from 'react-datepicker';
import { CalendarIcon } from '@heroicons/react/24/outline';
import 'react-datepicker/dist/react-datepicker.css';

interface CustomDatePickerProps {
  label?: string;
  error?: string;
  required?: boolean;
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  dateFormat?: string;
  showTimeSelect?: boolean;
  disabled?: boolean;
  iconClassName?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  label,
  error,
  required = false,
  value,
  onChange,
  placeholder = 'Select date...',
  className = '',
  dateFormat = 'yyyy-MM-dd',
  showTimeSelect = false,
  disabled = false,
  iconClassName = 'text-gray-400',
}) => {
  const baseClassName = `
    block w-full px-4 py-2 pl-10 rounded-lg border shadow-sm
    focus:ring-2 focus:ring-picton-blue focus:border-transparent
    ${error ? 'border-red-500' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    ${className}
  `;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-scarlet ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <CalendarIcon className={`h-5 w-5 ${iconClassName}`} />
        </div>
        <ReactDatePicker
          selected={value}
          onChange={onChange}
          placeholderText={placeholder}
          className={baseClassName}
          dateFormat={dateFormat}
          autoComplete="off"
          isClearable
          showPopperArrow={false}
          popperClassName="react-datepicker-popper"
          popperPlacement="bottom-start"
          showTimeSelect={showTimeSelect}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="text-sm text-scarlet">{error}</p>
      )}
    </div>
  );
};

export default CustomDatePicker;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
}

const BackButton: React.FC<BackButtonProps> = ({
  to,
  label = 'Back to List',
  className = '',
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center px-4 py-2 border border-gray-300 
        rounded-md shadow-sm text-sm font-medium text-gray-700 
        bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 
        focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200
        ${className}
      `}
    >
      <ArrowLeftIcon className="h-4 w-4 mr-2" />
      {label}
    </button>
  );
};

export default BackButton;
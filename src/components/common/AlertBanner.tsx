// src/components/common/AlertBanner.tsx
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useState } from 'react';

interface AlertBannerProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function AlertBanner({ 
  type, 
  title, 
  message, 
  dismissible = true,
  action 
}: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) return null;
  
  const variants = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle className="text-green-500" size={20} />,
      text: 'text-green-800 dark:text-green-300',
      button: 'hover:bg-green-100 dark:hover:bg-green-800/30'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="text-yellow-500" size={20} />,
      text: 'text-yellow-800 dark:text-yellow-300',
      button: 'hover:bg-yellow-100 dark:hover:bg-yellow-800/30'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: <AlertCircle className="text-red-500" size={20} />,
      text: 'text-red-800 dark:text-red-300',
      button: 'hover:bg-red-100 dark:hover:bg-red-800/30'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: <Info className="text-blue-500" size={20} />,
      text: 'text-blue-800 dark:text-blue-300',
      button: 'hover:bg-blue-100 dark:hover:bg-blue-800/30'
    }
  };
  
  const v = variants[type];
  
  return (
    <div className={`${v.bg} ${v.border} border rounded-2xl p-4 mb-6 animate-slideDown`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {v.icon}
        </div>
        <div className="flex-1">
          <h4 className={`font-bold text-sm ${v.text} font-candara-bold`}>
            {title}
          </h4>
          {message && (
            <p className={`mt-1 text-sm ${v.text} opacity-90 font-candara`}>
              {message}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-3 text-sm font-bold ${v.text} underline underline-offset-2 ${v.button} transition-colors font-candara`}
            >
              {action.label}
            </button>
          )}
        </div>
        {dismissible && (
          <button
            onClick={() => setIsVisible(false)}
            className={`flex-shrink-0 p-1 rounded-lg ${v.text} ${v.button} transition-colors`}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
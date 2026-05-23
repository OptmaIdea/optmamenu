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
      bg: 'bg-brand-green/10 dark:bg-brand-green/20',
      border: 'border-brand-green/20 dark:border-brand-green/30',
      icon: <CheckCircle className="text-brand-green" size={20} />,
      text: 'text-brand-dark dark:text-brand-green',
      button: 'hover:bg-brand-green/20 dark:hover:bg-brand-green/40'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={20} />,
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
      bg: 'bg-brand-purple/10 dark:bg-brand-purple/20',
      border: 'border-brand-purple/20 dark:border-brand-purple/30',
      icon: <Info className="text-brand-purple" size={20} />,
      text: 'text-brand-purple dark:text-brand-purple-light',
      button: 'hover:bg-brand-purple/20 dark:hover:bg-brand-purple/40'
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
// src/components/common/StatsCard.tsx
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    positive?: boolean;
    label?: string;
  };
  color?: 'green' | 'orange' | 'blue' | 'purple';
  onClick?: () => void;
}

const colorVariants = {
  green: {
    bg: 'bg-[#21A896]/10 dark:bg-[#21A896]/20',
    text: 'text-[#21A896]',
    border: 'border-[#21A896]/20'
  },
  orange: {
    bg: 'bg-[#F26541]/10 dark:bg-[#F26541]/20',
    text: 'text-[#F26541]',
    border: 'border-[#F26541]/20'
  },
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500/20'
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-500',
    border: 'border-purple-500/20'
  }
};

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  color = 'green',
  onClick
}: StatsCardProps) {
  const colors = colorVariants[color];

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 
        shadow-sm hover:shadow-lg transition-all duration-300 
        ${onClick ? 'cursor-pointer hover:border-[#21A896]/30 hover:-translate-y-1' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${colors.bg} rounded-xl ${colors.text}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
            ${trend.positive
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {trend.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>

      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 font-candara">
        {title}
      </h3>
      <p className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white font-candara-bold">
        {value}
      </p>
      {trend?.label && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-candara">
          {trend.label}
        </p>
      )}
    </div>
  );
}
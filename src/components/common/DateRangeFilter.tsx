import React from 'react';
import { Calendar } from 'lucide-react';

export type DatePeriodOption =
  | 'today'
  | 'yesterday'
  | 'current_month'
  | 'last_month'
  | 'fortnight'
  | 'last_fortnight'
  | 'week'
  | 'last_week'
  | 'all'
  | 'custom'
  | string;

export function getDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodDates(period: string): { start: string; end: string } {
  const today = new Date();

  switch (period) {
    case 'today': {
      return {
        start: getDateInputValue(today),
        end: getDateInputValue(today),
      };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        start: getDateInputValue(yesterday),
        end: getDateInputValue(yesterday),
      };
    }
    case 'current_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: getDateInputValue(start),
        end: getDateInputValue(end),
      };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: getDateInputValue(start),
        end: getDateInputValue(end),
      };
    }
    case 'fortnight': {
      const day = today.getDate();
      if (day <= 15) {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 15);
        return {
          start: getDateInputValue(start),
          end: getDateInputValue(end),
        };
      } else {
        const start = new Date(today.getFullYear(), today.getMonth(), 16);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: getDateInputValue(start),
          end: getDateInputValue(end),
        };
      }
    }
    case 'last_fortnight': {
      const day = today.getDate();
      if (day <= 15) {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 16);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: getDateInputValue(start),
          end: getDateInputValue(end),
        };
      } else {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 15);
        return {
          start: getDateInputValue(start),
          end: getDateInputValue(end),
        };
      }
    }
    case 'week': {
      const dayOfWeek = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - dayOfWeek);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return {
        start: getDateInputValue(sunday),
        end: getDateInputValue(saturday),
      };
    }
    case 'last_week': {
      const dayOfWeek = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - dayOfWeek - 7);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      return {
        start: getDateInputValue(sunday),
        end: getDateInputValue(saturday),
      };
    }
    case 'all': {
      return { start: '', end: '' };
    }
    default:
      return { start: '', end: '' };
  }
}

interface DateRangeFilterProps {
  periodFilter: string;
  onPeriodChange: (period: string) => void;
  startDate: string;
  onStartDateChange: (startDate: string) => void;
  endDate: string;
  onEndDateChange: (endDate: string) => void;
  showAllOption?: boolean;
  className?: string;
}

export default function DateRangeFilter({
  periodFilter,
  onPeriodChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  showAllOption = true,
  className = '',
}: DateRangeFilterProps) {
  const handlePeriodSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = event.target.value;
    onPeriodChange(newPeriod);
    if (newPeriod !== 'custom') {
      const dates = getPeriodDates(newPeriod);
      onStartDateChange(dates.start);
      onEndDateChange(dates.end);
    }
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Período
        </span>
        <select
          value={periodFilter}
          onChange={handlePeriodSelect}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="current_month">Mês Atual</option>
          <option value="last_month">Mês Anterior</option>
          <option value="fortnight">Quinzena Atual</option>
          <option value="last_fortnight">Quinzena Anterior</option>
          <option value="week">Semana (Dom-Sáb)</option>
          <option value="last_week">Semana Anterior</option>
          {showAllOption && <option value="all">Todo o período</option>}
          <option value="custom">Personalizado</option>
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Data inicial
        </span>
        <div className="relative">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              onPeriodChange('custom');
            }}
            disabled={periodFilter === 'all'}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 disabled:opacity-50"
          />
        </div>
      </label>

      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Data final
        </span>
        <div className="relative">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              onEndDateChange(e.target.value);
              onPeriodChange('custom');
            }}
            disabled={periodFilter === 'all'}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-bold text-gray-700 outline-none transition focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 disabled:opacity-50"
          />
        </div>
      </label>
    </div>
  );
}
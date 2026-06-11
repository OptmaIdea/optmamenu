import { useState } from 'react';
import { createPortal } from 'react-dom';

interface DateRangeFilterProps {
  onChange: (start: string, end: string) => void;
}
export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  return createPortal(
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
        Início
        <input
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            onChange(e.target.value, end);
          }}
          className="mt-1 block rounded-xl border border-gray-250 dark:border-gray-700 px-3 py-1.5 text-xs font-bold dark:bg-gray-800 dark:text-white outline-none"
        />
      </label>

      <label className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
        Fim
        <input
          type="date"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            onChange(start, e.target.value);
          }}
          className="mt-1 block rounded-xl border border-gray-250 dark:border-gray-700 px-3 py-1.5 text-xs font-bold dark:bg-gray-800 dark:text-white outline-none"
        />
      </label>
    </div>,
    document.getElementById('quick-access-actions-portal')!
  );
}
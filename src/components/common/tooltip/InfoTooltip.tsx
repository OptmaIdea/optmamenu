import { Info } from 'lucide-react';
import { useState } from 'react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="group relative inline-flex items-center overflow-visible align-middle"
      tabIndex={0}
      title={text}
      aria-label={text}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }}
      onBlur={() => setOpen(false)}
      onMouseLeave={() => setOpen(false)}
    >
      <Info className="h-4 w-4 text-gray-400 cursor-help" />

      <span
        className={[
          'pointer-events-none absolute left-1/2 bottom-full z-[80] mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-5 text-white shadow-lg',
          open ? 'block' : 'hidden group-hover:block group-focus-within:block',
        ].join(' ')}
      >
        {text}
      </span>
    </span>
  );
}

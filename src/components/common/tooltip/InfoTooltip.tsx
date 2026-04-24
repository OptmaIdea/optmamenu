import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span
      className="group relative inline-flex items-center overflow-visible align-middle"
      tabIndex={0}
      title={text}
      aria-label={text}
    >
      <Info className="h-4 w-4 text-gray-400 cursor-help" />

      <span className="pointer-events-none absolute left-1/2 bottom-full z-[80] mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-5 text-white shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          {description}
        </p>
      )}

      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

import type { ReactNode } from 'react';

interface EmptyTableStateProps {
  title: string;
  description?: string;
  colSpan: number;
  action?: ReactNode;
}

export default function EmptyTableState({
  title,
  description,
  colSpan,
  action,
}: EmptyTableStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-10 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </p>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
          {action && <div className="mt-4 flex justify-center">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

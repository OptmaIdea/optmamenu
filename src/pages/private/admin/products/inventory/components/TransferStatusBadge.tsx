import clsx from 'clsx';
import type { TransferStatus } from '../types/multiStock.types';

type Props = {
  status: TransferStatus | string;
};

const statusMap: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  },
  pending: {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  approved: {
    label: 'Aprovada',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  shipped: {
    label: 'Enviada',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  received: {
    label: 'Recebida',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  divergent: {
    label: 'Divergente',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  },
};

export default function TransferStatusBadge({ status }: Props) {
  const config = statusMap[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

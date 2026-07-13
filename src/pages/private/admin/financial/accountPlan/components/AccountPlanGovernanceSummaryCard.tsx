import type { CashbookAccountPlanGovernanceSummaryResult } from '@/services/cashbookAccountPlanTreeService';

type AccountPlanGovernanceSummaryCardProps = {
  data: CashbookAccountPlanGovernanceSummaryResult | null;
  loading?: boolean;
};

function formatCount(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export default function AccountPlanGovernanceSummaryCard({ data, loading = false }: AccountPlanGovernanceSummaryCardProps) {
  const summary = data?.summary;
  const hasConsistencyErrors = Number(summary?.flag_consistency_errors || 0) > 0;

  const cards = [
    {
      label: 'Histórico protegido',
      value: summary?.identity_locked_accounts,
      helper: 'Contas com lançamentos e identidade travada.',
    },
    {
      label: 'Apagáveis com segurança',
      value: summary?.safe_delete_candidates,
      helper: 'Contas criadas pelo usuário, sem filhos e sem lançamentos.',
    },
    {
      label: 'Estrutura base',
      value: summary?.protected_accounts,
      helper: 'Grupos e contas protegidas do sistema.',
    },
    {
      label: 'Consistência',
      value: summary?.flag_consistency_errors,
      helper: hasConsistencyErrors ? 'Há flags conflitantes para revisar.' : 'Nenhuma inconsistência encontrada.',
      danger: hasConsistencyErrors,
    },
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-black uppercase tracking-widest text-gray-500">Governança do plano</p>
        <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Carregando resumo de segurança...</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className={`rounded-2xl border p-5 ${hasConsistencyErrors ? 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-[#19A999]">Governança do plano</p>
          <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">Segurança das contas</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Resumo das travas de histórico, proteção da estrutura base e exclusão segura.
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${hasConsistencyErrors ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
          {hasConsistencyErrors ? 'Revisar consistência' : 'Consistente'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
            <p className="text-xs font-black uppercase tracking-widest text-gray-500">{card.label}</p>
            <strong className={`mt-2 block text-2xl ${card.danger ? 'text-rose-700 dark:text-rose-200' : 'text-gray-900 dark:text-white'}`}>
              {formatCount(card.value)}
            </strong>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BarChart3, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  CashbookAccountPlanTrialBalanceService,
  type CashbookAccountPlanTrialBalanceItem,
  type CashbookAccountPlanTrialBalanceResult,
} from '@/services/cashbookAccountPlanTrialBalanceService';
import { getCashbookAccountPlanLabel, getCashbookKindLabel } from '@/utils/finance/ptBrFinancialLabels';
import { getActiveStoreId } from '@/utils/activeStore';

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthStart() {
  const now = new Date();
  return getDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getMonthEnd() {
  const now = new Date();
  return getDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function getFriendlyName(item: CashbookAccountPlanTrialBalanceItem) {
  const mappedLabel = getCashbookAccountPlanLabel(item.code, 'dash');
  if (mappedLabel !== '—') return mappedLabel;
  return item.name;
}

function getItemLabel(item: CashbookAccountPlanTrialBalanceItem) {
  const name = getFriendlyName(item);
  return item.display_code ? `${item.display_code} - ${name}` : name;
}

function compareDisplayCodes(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const partsA = a.split('.');
  const partsB = b.split('.');
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const partA = partsA[i];
    const partB = partsB[i];

    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) {
        return numA - numB;
      }
    } else {
      const cmp = partA.localeCompare(partB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return 0;
}

function getChildrenMap(items: CashbookAccountPlanTrialBalanceItem[]) {
  const map = new Map<string | null, CashbookAccountPlanTrialBalanceItem[]>();

  items.forEach((item) => {
    const parent = item.parent_code || null;
    const current = map.get(parent) || [];
    current.push(item);
    map.set(parent, current);
  });

  map.forEach((list) => {
    list.sort((a, b) => {
      const cmpCode = compareDisplayCodes(a.display_code, b.display_code);
      if (cmpCode !== 0) return cmpCode;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  });

  return map;
}

interface AccountPlanTrialBalancePanelProps {
  includeInactive?: boolean;
}

export default function AccountPlanTrialBalancePanel({ includeInactive = false }: AccountPlanTrialBalancePanelProps) {
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getMonthEnd);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CashbookAccountPlanTrialBalanceResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['grp_revenue', 'grp_expense']));
  const [hideEmpty, setHideEmpty] = useState(false);

  const childrenMap = useMemo(() => getChildrenMap(result?.items || []), [result?.items]);

  async function loadTrialBalance() {
    const storeId = getActiveStoreId();

    if (!storeId) {
      toast.error('Selecione uma loja para carregar o balancete.');
      return;
    }

    try {
      setLoading(true);
      const data = await CashbookAccountPlanTrialBalanceService.getTrialBalance({
        storeId,
        startDate,
        endDate,
        includeInactive,
      });
      setResult(data);
    } catch (error) {
      console.error('Erro ao carregar balancete do plano de contas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar balancete do plano de contas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrialBalance();
  }, [includeInactive]);

  function toggleExpanded(code: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function renderRows(parentCode: string | null = null, depth = 0): ReactElement[] {
    return (childrenMap.get(parentCode) || [])
      .filter((item) => includeInactive || item.active)
      .filter((item) => {
        if (!hideEmpty) return true;
        if (depth === 0) return true; // Nunca ocultar os grupos principais (primeiro nível)
        const hasMovement = Number(item.total_in || 0) !== 0 || Number(item.total_out || 0) !== 0 || Number(item.total_entries_count || 0) > 0;
        return hasMovement;
      })
      .flatMap((item) => {
        const children = childrenMap.get(item.code) || [];
        const hasChildren = children.length > 0;
        const isOpen = expanded.has(item.code);
        const hasMovement = Number(item.total_in || 0) !== 0 || Number(item.total_out || 0) !== 0 || Number(item.total_balance || 0) !== 0;

        const row = (
          <tr key={item.code} className={hasMovement ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/60 text-gray-500 dark:bg-gray-950/40'}>
            <td className="px-4 py-3 align-top">
              <div className="flex items-start gap-2" style={{ paddingLeft: `${Math.min(depth * 18, 72)}px` }}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.code)}
                    className="mt-0.5 rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label={isOpen ? 'Recolher' : 'Expandir'}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <div className="mt-0.5 p-1">
                    <span className="block h-4 w-4" />
                  </div>
                )}
                <div>
                  <p className="font-black text-gray-900 dark:text-white">{getItemLabel(item)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getCashbookKindLabel(item.kind)} · {item.is_group ? 'Grupo de resumo' : 'Conta lançável'}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(item.total_in)}</td>
            <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-300">{formatCurrency(item.total_out)}</td>
            <td className="px-4 py-3 text-right font-black text-gray-900 dark:text-white">{formatCurrency(item.total_balance)}</td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-500 dark:text-gray-400">{item.total_entries_count}</td>
          </tr>
        );

        return isOpen ? [row, ...renderRows(item.code, depth + 1)] : [row];
      });
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#19A999]">
            <BarChart3 size={20} />
            <span className="text-sm font-black uppercase tracking-widest">Balancete gerencial</span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Entradas, saídas e resultado por conta</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Acompanhe para onde o dinheiro está indo e quais contas concentram receitas e custos no período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(event) => setHideEmpty(event.target.checked)}
              className="rounded border-gray-300 text-[#19A999] focus:ring-[#19A999]"
            />
            <span>Ocultar sem movimento</span>
          </label>
          <button
            type="button"
            onClick={loadTrialBalance}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 font-black text-white hover:bg-[#14887B] disabled:opacity-60"
          >
            <RefreshCw size={18} /> Atualizar
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Entradas</p>
          <strong className="mt-1 block text-xl text-emerald-700 dark:text-emerald-200">{formatCurrency(result?.totals.total_in || 0)}</strong>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/30">
          <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Saídas</p>
          <strong className="mt-1 block text-xl text-rose-700 dark:text-rose-200">{formatCurrency(result?.totals.total_out || 0)}</strong>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/40">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Resultado</p>
          <strong className="mt-1 block text-xl text-gray-900 dark:text-white">{formatCurrency(result?.totals.balance || 0)}</strong>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/40">
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Lançamentos</p>
          <strong className="mt-1 block text-xl text-gray-900 dark:text-white">{result?.totals.entries_count || 0}</strong>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : result?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500 dark:bg-gray-950/60">
                <tr>
                  <th className="px-4 py-3 text-left">Conta</th>
                  <th className="px-4 py-3 text-right">Entradas</th>
                  <th className="px-4 py-3 text-right">Saídas</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                  <th className="px-4 py-3 text-right">Lanç.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {renderRows()}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhum lançamento classificado encontrado para o período selecionado.
          </div>
        )}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CashbookAccountPlanService,
  type CashbookAccountPlanItem,
} from '@/services/cashbookAccountPlanService';
import {
  FinancialAccountsService,
  type StoreFinancialAccount,
} from '@/services/financialAccountsService';
import type { CashbookDirection } from '@/services/cashbookService';
import {
  formatCashbookCategoryOptionLabel,
  formatFinancialAccountOptionLabel,
} from '@/utils/finance/ptBrFinancialLabels';

export interface CashbookCategoryOption {
  value: string;
  label: string;
  item: CashbookAccountPlanItem;
}

export interface CashbookFinancialAccountOption {
  value: string;
  code: string;
  label: string;
  item: StoreFinancialAccount;
}

export interface CashbookClassificationSuggestion {
  accountPlanCode: string | null;
  sourceFinancialAccountCode: string | null;
  destinationFinancialAccountCode: string | null;
  affectsCashDrawer: boolean | null;
  affectsFinancialResult: boolean | null;
  isTransfer: boolean;
}

interface UseCashbookClassificationOptionsResult {
  loading: boolean;
  error: string | null;
  categories: CashbookCategoryOption[];
  financialAccounts: CashbookFinancialAccountOption[];
  refresh: () => Promise<void>;
  getDefaultFinancialAccountCode: (paymentMethodCode?: string | null) => string | null;
  buildSuggestion: (input: {
    direction: CashbookDirection;
    paymentMethodCode?: string | null;
    accountPlanCode?: string | null;
    financialAccountCode?: string | null;
  }) => CashbookClassificationSuggestion;
}

function normalizeCode(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function getDefaultFinancialAccountCode(paymentMethodCode?: string | null): string | null {
  const method = normalizeCode(paymentMethodCode);

  if (method === 'cash' || method === 'dinheiro') return 'cash_drawer';
  if (method === 'pix') return 'pix_wallet';
  if (method === 'card' || method === 'debit_card' || method === 'credit_card') return 'card_receivable';

  return null;
}

function getDefaultAffectsCashDrawer(accountCode?: string | null): boolean | null {
  if (!accountCode) return null;
  return accountCode === 'cash_drawer';
}

export function useCashbookClassificationOptions(
  storeId: string | null,
  direction: CashbookDirection | 'transfer' | null
): UseCashbookClassificationOptionsResult {
  const [planItems, setPlanItems] = useState<CashbookAccountPlanItem[]>([]);
  const [accounts, setAccounts] = useState<StoreFinancialAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId || !direction) {
      setPlanItems([]);
      setAccounts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [loadedPlanItems, loadedAccounts] = await Promise.all([
        CashbookAccountPlanService.listForDirection(direction),
        FinancialAccountsService.list(storeId, false),
      ]);

      setPlanItems(loadedPlanItems);
      setAccounts(loadedAccounts.filter((account) => account.active));
    } catch (err) {
      console.error('Erro ao carregar opções de classificação do Livro Diário:', err);
      setError('Erro ao carregar categorias e contas financeiras.');
      setPlanItems([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [direction, storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const categories = useMemo<CashbookCategoryOption[]>(() => {
    return planItems.map((item) => ({
      value: item.code,
      label: formatCashbookCategoryOptionLabel(item),
      item,
    }));
  }, [planItems]);

  const financialAccounts = useMemo<CashbookFinancialAccountOption[]>(() => {
    return accounts.map((item) => ({
      value: item.code,
      code: item.code,
      label: formatFinancialAccountOptionLabel(item),
      item,
    }));
  }, [accounts]);

  const buildSuggestion = useCallback((input: {
    direction: CashbookDirection;
    paymentMethodCode?: string | null;
    accountPlanCode?: string | null;
    financialAccountCode?: string | null;
  }): CashbookClassificationSuggestion => {
    const financialAccountCode = input.financialAccountCode || getDefaultFinancialAccountCode(input.paymentMethodCode);
    const affectsCashDrawer = getDefaultAffectsCashDrawer(financialAccountCode);

    return {
      accountPlanCode: input.accountPlanCode || null,
      sourceFinancialAccountCode: input.direction === 'out' ? financialAccountCode : null,
      destinationFinancialAccountCode: input.direction === 'in' ? financialAccountCode : null,
      affectsCashDrawer,
      affectsFinancialResult: true,
      isTransfer: false,
    };
  }, []);

  return {
    loading,
    error,
    categories,
    financialAccounts,
    refresh,
    getDefaultFinancialAccountCode,
    buildSuggestion,
  };
}

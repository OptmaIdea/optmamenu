import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Edit2,
  FolderTree,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  CashbookAccountPlanTreeService,
  type CashbookAccountPlanTreeItem,
  type CashbookAccountPlanNature,
} from '@/services/cashbookAccountPlanTreeService';
import type { CashbookAccountPlanKind } from '@/services/cashbookAccountPlanService';
import { getCashbookAccountPlanLabel, getCashbookKindLabel } from '@/utils/finance/ptBrFinancialLabels';
import AccountPlanTrialBalancePanel from './components/AccountPlanTrialBalancePanel';

type SectionFilter = 'entries' | 'exits' | 'transfers' | 'all';
type FormMode = 'create' | 'edit';

interface FormState {
  mode: FormMode;
  originalCode: string | null;
  code: string;
  displayCode: string;
  parentCode: string;
  name: string;
  kind: CashbookAccountPlanKind;
  description: string;
  isGroup: boolean;
  isPostable: boolean;
  nature: CashbookAccountPlanNature;
  analysisEnabled: boolean;
  active: boolean;
  sortOrder: string;
}

const ROOT_BY_SECTION: Record<Exclude<SectionFilter, 'all'>, string> = {
  entries: 'grp_revenue',
  exits: 'grp_expense',
  transfers: 'grp_transfers',
};

function getNatureLabel(value?: string | null) {
  const labels: Record<string, string> = {
    debit: 'Devedora',
    credit: 'Credora',
    neutral: 'Neutra',
  };

  return value ? labels[value] || value : '—';
}

function getFriendlyName(item: CashbookAccountPlanTreeItem) {
  const mappedLabel = getCashbookAccountPlanLabel(item.code, 'dash');
  if (mappedLabel !== '—') return mappedLabel;
  return item.name;
}

function getItemLabel(item: CashbookAccountPlanTreeItem) {
  const name = getFriendlyName(item);
  return item.display_code ? `${item.display_code} - ${name}` : name;
}

function getItemSubtitle(item: CashbookAccountPlanTreeItem) {
  const parts = [getCashbookKindLabel(item.kind), getNatureLabel(item.nature)];

  if (item.is_group) parts.push('Grupo de resumo');
  else if (item.is_postable) parts.push('Aceita lançamentos');
  else parts.push('Não recebe lançamentos');

  return parts.filter(Boolean).join(' · ');
}

function compareDisplayCodes(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const partsA = a.split('.');
  const partsB = b.split('.');
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i += 1) {
    const partA = partsA[i];
    const partB = partsB[i];

    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = Number.parseInt(partA, 10);
    const numB = Number.parseInt(partB, 10);
    const isNumA = !Number.isNaN(numA);
    const isNumB = !Number.isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = partA.localeCompare(partB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return 0;
}

function getChildrenMap(items: CashbookAccountPlanTreeItem[], alphabeticalGroups?: Set<string>) {
  const map = new Map<string | null, CashbookAccountPlanTreeItem[]>();

  items.forEach((item) => {
    const parent = item.parent_code || null;
    const current = map.get(parent) || [];
    current.push(item);
    map.set(parent, current);
  });

  map.forEach((list, parentCode) => {
    const shouldSortAlphabetically = parentCode !== null && alphabeticalGroups?.has(parentCode);

    list.sort((a, b) => {
      if (shouldSortAlphabetically) {
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }

      const cmpCode = compareDisplayCodes(a.display_code, b.display_code);
      if (cmpCode !== 0) return cmpCode;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });
  });

  return map;
}

function getMetadataBoolean(item: CashbookAccountPlanTreeItem, key: string) {
  return item.metadata?.[key] === true || item.metadata?.[key] === 'true';
}

function isSystemProtectedItem(item: CashbookAccountPlanTreeItem) {
  return (
    ['grp_revenue', 'grp_expense', 'grp_transfers'].includes(item.code) ||
    getMetadataBoolean(item, 'system_group') ||
    getMetadataBoolean(item, 'protected_account') ||
    getMetadataBoolean(item, 'protected_base_structure')
  );
}

function isExpectedBusinessRuleError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('não pode ser inativada') ||
    message.includes('não pode ser apagada') ||
    message.includes('possui lançamentos') ||
    message.includes('possui contas filhas') ||
    message.includes('estrutura base') ||
    message.includes('permissão') ||
    message.includes('já existe uma conta ativa usando o código') ||
    message.includes('não pode ter nome, código, grupo, tipo ou natureza alterados')
  );
}

function normalizeInternalCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function createInternalCode(formState: FormState) {
  if (formState.mode === 'edit' && formState.originalCode) return formState.originalCode;
  if (formState.code.trim()) return formState.code.trim();

  const base = formState.displayCode.trim() || formState.name.trim();
  const normalized = normalizeInternalCode(base);

  return normalized || `conta_${Date.now()}`;
}

function createInitialForm(parent?: CashbookAccountPlanTreeItem | null): FormState {
  return {
    mode: 'create',
    originalCode: null,
    code: '',
    displayCode: '',
    parentCode: parent?.code || '',
    name: '',
    kind: parent?.kind || 'expense',
    description: '',
    isGroup: false,
    isPostable: true,
    nature: parent?.nature || (parent?.kind === 'income' ? 'credit' : parent?.kind === 'expense' ? 'debit' : 'neutral'),
    analysisEnabled: false,
    active: true,
    sortOrder: '0',
  };
}

function createEditForm(item: CashbookAccountPlanTreeItem): FormState {
  return {
    mode: 'edit',
    originalCode: item.code,
    code: item.code,
    displayCode: item.display_code || '',
    parentCode: item.parent_code || '',
    name: item.name,
    kind: item.kind,
    description: item.description || '',
    isGroup: item.is_group,
    isPostable: item.is_postable,
    nature: item.nature,
    analysisEnabled: item.analysis_enabled,
    active: item.active,
    sortOrder: String(item.sort_order || 0),
  };
}

function buildParentMap(items: CashbookAccountPlanTreeItem[]) {
  return new Map(items.map((item) => [item.code, item]));
}

function belongsToRoot(item: CashbookAccountPlanTreeItem, rootCode: string, parentMap: Map<string, CashbookAccountPlanTreeItem>) {
  if (item.code === rootCode) return true;

  let currentParentCode = item.parent_code || null;
  const visited = new Set<string>();

  while (currentParentCode) {
    if (currentParentCode === rootCode) return true;
    if (visited.has(currentParentCode)) return false;
    visited.add(currentParentCode);

    const parent = parentMap.get(currentParentCode);
    currentParentCode = parent?.parent_code || null;
  }

  return false;
}

export default function AccountPlanPage() {
  const [items, setItems] = useState<CashbookAccountPlanTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggestingCode, setSuggestingCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'trial_balance' | 'edit_accounts'>('trial_balance');
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('entries');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['grp_revenue', 'grp_expense']));
  const [alphabeticalGroups, setAlphabeticalGroups] = useState<Set<string>>(() => new Set());
  const [formState, setFormState] = useState<FormState | null>(null);

  const parentMap = useMemo(() => buildParentMap(items), [items]);

  function toggleAlphabeticalGroup(code: string) {
    setAlphabeticalGroups((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function loadData() {
    try {
      setLoading(true);
      const includeInactive = activeFilter !== 'active';
      const data = await CashbookAccountPlanTreeService.list(includeInactive);
      setItems(data);
    } catch (error) {
      console.error('Erro ao carregar plano de contas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar plano de contas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rootCode = sectionFilter === 'all' ? null : ROOT_BY_SECTION[sectionFilter];

    const baseFiltered = items.filter((item) => {
      if (activeFilter === 'active' && !item.active) return false;
      if (activeFilter === 'inactive' && item.active) return false;
      if (rootCode && !belongsToRoot(item, rootCode, parentMap)) return false;
      return true;
    });

    if (!term) return baseFiltered;

    const matchedCodes = new Set<string>();
    baseFiltered.forEach((item) => {
      const displayCodeMatch = item.display_code?.toLowerCase().includes(term);
      const nameMatch = item.name.toLowerCase().includes(term);
      const friendlyNameMatch = getFriendlyName(item).toLowerCase().includes(term);
      const descMatch = item.description?.toLowerCase().includes(term);

      if (displayCodeMatch || nameMatch || friendlyNameMatch || descMatch) {
        matchedCodes.add(item.code);
      }
    });

    const codesToKeep = new Set<string>();
    const baseCodes = new Set(baseFiltered.map((item) => item.code));

    const addNodeAndAncestors = (code: string) => {
      if (codesToKeep.has(code) || !baseCodes.has(code)) return;
      codesToKeep.add(code);

      const node = parentMap.get(code);
      if (node?.parent_code) addNodeAndAncestors(node.parent_code);
    };

    matchedCodes.forEach((code) => addNodeAndAncestors(code));
    return baseFiltered.filter((item) => codesToKeep.has(item.code));
  }, [items, parentMap, sectionFilter, searchTerm, activeFilter]);

  const childrenMap = useMemo(() => getChildrenMap(filteredItems, alphabeticalGroups), [filteredItems, alphabeticalGroups]);
  const groupsCount = items.filter((item) => item.is_group).length;
  const postableCount = items.filter((item) => item.is_postable && !item.is_group).length;
  const analysisCount = items.filter((item) => item.analysis_enabled).length;

  function toggleExpanded(code: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function changeSectionFilter(nextFilter: SectionFilter) {
    setSectionFilter(nextFilter);
    setExpanded(new Set());
  }

  async function applySuggestedChildCode(parentCode: string) {
    try {
      setSuggestingCode(true);
      const suggestion = await CashbookAccountPlanTreeService.getNextChildCode(parentCode);

      setFormState((current) => {
        if (!current || current.mode !== 'create' || current.parentCode !== parentCode) return current;

        return {
          ...current,
          displayCode: suggestion.suggested_display_code,
          sortOrder: String((suggestion.next_number || 0) * 10),
        };
      });
    } catch (error) {
      if (!isExpectedBusinessRuleError(error)) {
        console.error('Erro ao sugerir próximo código do plano de contas:', error);
      }
      toast.warning(error instanceof Error ? error.message : 'Não foi possível sugerir o próximo código automaticamente.');
    } finally {
      setSuggestingCode(false);
    }
  }

  async function openCreateForm(parent?: CashbookAccountPlanTreeItem | null) {
    const initialForm = createInitialForm(parent);
    setFormState(initialForm);

    if (parent?.code) await applySuggestedChildCode(parent.code);
  }

  async function handleParentChange(parentCode: string) {
    const shouldSuggest = formState?.mode === 'create' && Boolean(parentCode);

    setFormState((current) => {
      if (!current) return current;
      return {
        ...current,
        parentCode,
        displayCode: current.mode === 'create' ? '' : current.displayCode,
      };
    });

    if (shouldSuggest) await applySuggestedChildCode(parentCode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState) return;

    try {
      setSaving(true);
      await CashbookAccountPlanTreeService.save({
        code: createInternalCode(formState),
        displayCode: formState.displayCode.trim() || null,
        parentCode: formState.parentCode || null,
        name: formState.name.trim(),
        kind: formState.kind,
        description: formState.description.trim() || null,
        isGroup: formState.isGroup,
        isPostable: formState.isGroup ? false : formState.isPostable,
        nature: formState.nature,
        analysisEnabled: formState.analysisEnabled,
        active: formState.active,
        sortOrder: Number(formState.sortOrder || 0),
        affectsCashDrawer: false,
        affectsFinancialResult: true,
        isTransfer: formState.kind === 'transfer',
        metadata: {
          origin: 'account_plan_admin',
          edited_from_ui: true,
          user_created: formState.mode === 'create',
        },
      });

      toast.success(formState.mode === 'create' ? 'Conta criada com sucesso.' : 'Conta atualizada com sucesso.');
      setFormState(null);
      await loadData();
    } catch (error) {
      if (!isExpectedBusinessRuleError(error)) console.error('Erro ao salvar conta do plano de contas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar conta do plano de contas.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: CashbookAccountPlanTreeItem) {
    try {
      await CashbookAccountPlanTreeService.setActive(item.code, !item.active);
      toast.success(item.active ? 'Conta inativada.' : 'Conta ativada.');
      await loadData();
    } catch (error) {
      if (!isExpectedBusinessRuleError(error)) console.error('Erro ao alterar status da conta:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status da conta.');
    }
  }

  function renderTree(parentCode: string | null = null, depth = 0): ReactElement[] {
    return (childrenMap.get(parentCode) || []).flatMap((item) => {
      const children = childrenMap.get(item.code) || [];
      const hasChildren = children.length > 0;
      const isOpen = expanded.has(item.code) || searchTerm.trim().length > 0;
      const isTopGroup = item.is_group && depth === 0;
      const isProtected = isSystemProtectedItem(item);

      const row = (
        <div
          key={item.code}
          className={`rounded-2xl border p-4 transition ${item.active
              ? isTopGroup
                ? 'border-[#19A999]/30 bg-[#19A999]/5 hover:border-[#19A999]/60 dark:border-[#19A999]/40 dark:bg-[#19A999]/10'
                : 'border-gray-200 bg-white hover:border-[#19A999]/40 dark:border-gray-800 dark:bg-gray-900'
              : 'border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-950'
            }`}
          style={{ marginLeft: `${Math.min(depth * 18, 72)}px` }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-3">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.code)}
                  className="mt-1 rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label={isOpen ? 'Recolher' : 'Expandir'}
                >
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              ) : (
                <div className="mt-1 p-1">
                  <span className="block h-[18px] w-[18px]" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className={`${isTopGroup ? 'text-lg' : 'text-base'} text-gray-900 dark:text-white`}>{getItemLabel(item)}</strong>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {getCashbookKindLabel(item.kind)}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                    {item.is_group ? 'Grupo de resumo' : 'Aceita lançamentos'}
                  </span>
                  {isProtected && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      Estrutura base
                    </span>
                  )}
                  {item.analysis_enabled && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                      Análise gerencial
                    </span>
                  )}
                  {!item.active && (
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                      Inativa
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{getItemSubtitle(item)}</p>
                {item.path && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Caminho: {item.path.replaceAll('/', ' › ')}
                  </p>
                )}
                {item.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {item.is_group && (
                <button
                  type="button"
                  onClick={() => toggleAlphabeticalGroup(item.code)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    alphabeticalGroups.has(item.code)
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                  title={
                    alphabeticalGroups.has(item.code)
                      ? 'Ordenado por Nome (A-Z). Clique para ordenar por Número.'
                      : 'Ordenado por Número. Clique para ordenar por Nome (A-Z).'
                  }
                >
                  {alphabeticalGroups.has(item.code) ? 'Ordenado A-Z' : 'Ordenar A-Z'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void openCreateForm(item)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Plus size={16} /> Conta filha
              </button>
              {!isProtected && (
                <>
                  <button
                    type="button"
                    onClick={() => setFormState(createEditForm(item))}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {item.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {item.active ? 'Inativar' : 'Ativar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );

      return isOpen ? [row, ...renderTree(item.code, depth + 1)] : [row];
    });
  }

  const treeRows = renderTree();

  return (
    <PageContainer title="Plano de contas">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-[#19A999]">Financeiro</span>
            <h1 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">Plano de contas</h1>
            <p className="mt-1 max-w-3xl text-gray-600 dark:text-gray-300">
              Organize receitas, despesas, ajustes e transferências em uma árvore gerencial para balancete e tomada de decisão.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/*<button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RefreshCw size={18} /> Atualizar
            </button>
            <button
              type="button"
              onClick={() => void openCreateForm(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 font-bold text-white hover:bg-[#14887B]"
            >
              <Plus size={18} /> Nova conta
            </button>*/}
          </div>
        </div>

        <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('trial_balance')}
            className={`relative pb-3 text-lg font-black uppercase tracking-wider transition-all ${
              activeTab === 'trial_balance' ? 'text-[#19A999]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            Balancete
            {activeTab === 'trial_balance' && <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-[#19A999]" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edit_accounts')}
            className={`relative pb-3 text-lg font-black uppercase tracking-wider transition-all ${
              activeTab === 'edit_accounts' ? 'text-[#19A999]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            Editar contas
            {activeTab === 'edit_accounts' && <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-[#19A999]" />}
          </button>
        </div>

        {activeTab === 'trial_balance' ? (
          <AccountPlanTrialBalancePanel includeInactive={activeFilter !== 'active'} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <FolderTree className="mb-3 text-[#19A999]" />
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Grupos de resumo</p>
                <strong className="mt-1 block text-2xl text-gray-900 dark:text-white">{groupsCount}</strong>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <Plus className="mb-3 text-[#19A999]" />
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Contas que recebem lançamento</p>
                <strong className="mt-1 block text-2xl text-gray-900 dark:text-white">{postableCount}</strong>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <BarChart3 className="mb-3 text-[#19A999]" />
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Contas com análise</p>
                <strong className="mt-1 block text-2xl text-gray-900 dark:text-white">{analysisCount}</strong>
              </div>
            </div>

            <div className="flex w-fit flex-wrap gap-1 rounded-2xl border-b border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-950">
              {[
                ['entries', 'Entradas'],
                ['exits', 'Saídas'],
                ['transfers', 'Transferências'],
                ['all', 'Todos'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    changeSectionFilter(value as SectionFilter);
                    setExpanded(new Set());
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-extrabold uppercase tracking-wide transition-all ${
                    sectionFilter === value
                      ? 'bg-white text-gray-900 shadow-xs dark:bg-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por código, nome ou caminho"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <select
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as 'active' | 'inactive' | 'all')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  <option value="active">Contas Ativas</option>
                  <option value="inactive">Contas Inativas</option>
                  <option value="all">Todas as Contas</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : treeRows.length ? (
                treeRows
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
                  Nenhuma conta encontrada.
                </div>
              )}
            </div>
          </>
        )}

        {formState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#19A999]">{formState.mode === 'create' ? 'Nova conta' : 'Editar conta'}</p>
                  <h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white">Dados do plano de contas</h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Use o código na árvore para organizar a visualização gerencial.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormState(null)}
                  className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Fechar formulário"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <label className="block space-y-1">
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
                      Código na árvore
                      {suggestingCode && formState.mode === 'create' && <span className="normal-case tracking-normal text-[#19A999]">sugerindo...</span>}
                    </span>
                    <input
                      value={formState.displayCode}
                      onChange={(event) => setFormState({ ...formState, displayCode: event.target.value })}
                      placeholder="Ex.: 2.4.14"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1 md:col-span-3">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Nome exibido</span>
                    <input
                      value={formState.name}
                      onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1 md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Fica dentro de</span>
                    <select
                      value={formState.parentCode}
                      onChange={(event) => void handleParentChange(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Sem grupo pai</option>
                      {items
                        .filter((item) => item.code !== formState.originalCode)
                        .sort((a, b) => compareDisplayCodes(a.display_code, b.display_code) || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                        .map((item) => (
                          <option key={item.code} value={item.code}>
                            {getItemLabel(item)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Tipo</span>
                    <select
                      value={formState.kind}
                      onChange={(event) => setFormState({ ...formState, kind: event.target.value as CashbookAccountPlanKind })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="income">Entrada</option>
                      <option value="expense">Saída</option>
                      <option value="transfer">Transferência</option>
                      <option value="adjustment">Ajuste</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Natureza</span>
                    <select
                      value={formState.nature}
                      onChange={(event) => setFormState({ ...formState, nature: event.target.value as CashbookAccountPlanNature })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="credit">Credora</option>
                      <option value="debit">Devedora</option>
                      <option value="neutral">Neutra</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Ordem</span>
                    <input
                      value={formState.sortOrder}
                      onChange={(event) => setFormState({ ...formState, sortOrder: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1 md:col-span-4">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Descrição para a equipe</span>
                    <textarea
                      value={formState.description}
                      onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-4 pt-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.isGroup}
                      onChange={(event) => setFormState({ ...formState, isGroup: event.target.checked, isPostable: event.target.checked ? false : formState.isPostable })}
                    />
                    É grupo de resumo
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.isPostable}
                      disabled={formState.isGroup}
                      onChange={(event) => setFormState({ ...formState, isPostable: event.target.checked })}
                    />
                    Aceita lançamentos
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.analysisEnabled}
                      onChange={(event) => setFormState({ ...formState, analysisEnabled: event.target.checked })}
                    />
                    Habilitar análise gerencial
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.active}
                      onChange={(event) => setFormState({ ...formState, active: event.target.checked })}
                    />
                    Ativa
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
                <button
                  type="button"
                  onClick={() => setFormState(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#19A999] px-5 py-2 font-black text-white transition hover:bg-[#14887B] disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar conta'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

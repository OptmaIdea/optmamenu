import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Power,
  Package,
  Activity,
  Eye,
  Download,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

import { useSuppliers } from './hooks/useSuppliers';
import type { Supplier, SupplierInput } from './types/supplier.types';

import { useSuppliersInsights } from '@/pages/private/admin/suppliers/hooks/useSuppliersInsights';
import { buildCsv, downloadCsv, formatCsvNumberBR, formatCsvIntegerBR } from '@/utils/csv';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; supplier: Supplier };

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
    <div className="text-sm font-semibold text-gray-900">{title}</div>
    <div className="mt-1 text-sm text-gray-600">{description}</div>
  </div>
);

function getOperationalStatus(lastPurchaseAt?: string | null) {
  if (!lastPurchaseAt) {
    return {
      label: 'Sem compras',
      className: 'bg-gray-100 text-gray-700',
    };
  }

  const diffMs = Date.now() - new Date(lastPurchaseAt).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return {
      label: 'Ativo',
      className: 'bg-green-100 text-green-700',
    };
  }

  if (diffDays <= 90) {
    return {
      label: 'Morno',
      className: 'bg-yellow-100 text-yellow-700',
    };
  }

  return {
    label: 'Inativo',
    className: 'bg-rose-100 text-rose-700',
  };
}

function getRankingBadge(rank?: number | null) {
  if (!rank) return null;

  if (rank === 1) {
    return {
      label: '#1',
      className: 'bg-purple-100 text-purple-700',
    };
  }

  if (rank <= 3) {
    return {
      label: 'Top 3',
      className: 'bg-blue-100 text-blue-700',
    };
  }

  if (rank <= 10) {
    return {
      label: 'Top 10',
      className: 'bg-indigo-100 text-indigo-700',
    };
  }

  return null;
}

const SupplierModal = ({
  state,
  onClose,
  onSave,
  saving,
}: {
  state: ModalState;
  onClose: () => void;
  onSave: (input: SupplierInput, supplierId?: string) => Promise<void>;
  saving: boolean;
}) => {
  const isOpen = state.open;
  const supplier = state.open && state.mode === 'edit' ? state.supplier : null;

  const [name, setName] = useState(supplier?.name ?? '');
  const [document, setDocument] = useState(supplier?.document ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
  const [active, setActive] = useState(supplier?.active ?? true);

  useEffect(() => {
    if (!isOpen) return;
    setName(supplier?.name ?? '');
    setDocument(supplier?.document ?? '');
    setPhone(supplier?.phone ?? '');
    setEmail(supplier?.email ?? '');
    setNotes(supplier?.notes ?? '');
    setActive(supplier?.active ?? true);
  }, [isOpen, supplier?.id, state.open ? state.mode : undefined]);

  if (!isOpen) return null;

  const title = state.mode === 'create' ? 'Novo fornecedor' : 'Editar fornecedor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            <div className="mt-1 text-sm text-gray-600">
              Dados básicos para identificar a origem das entradas.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            type="button"
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-gray-700">Nome *</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="Ex: Distribuidora XPTO"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700">Documento</div>
            <input
              value={document}
              onChange={e => setDocument(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="CNPJ/CPF (opcional)"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700">Telefone</div>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="(xx) xxxxx-xxxx"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700">E-mail</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="financeiro@fornecedor.com"
            />
          </label>

          <label className="block md:col-span-2">
            <div className="text-xs font-medium text-gray-700">Observações</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="Prazo, condições, etc (opcional)"
            />
          </label>

          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">Fornecedor ativo</span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={saving}
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!name.trim()) return;
              await onSave(
                {
                  name,
                  document,
                  phone,
                  email,
                  notes,
                  active,
                },
                supplier?.id,
              );
              onClose();
            }}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            disabled={saving || !name.trim()}
            type="button"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const {
    suppliers,
    loading,
    saving,
    lastUpdated,
    fetchSuppliers,
    upsertSupplier,
    setSupplierActive,
  } = useSuppliers();

  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [sortBy, setSortBy] = useState<
    'name_asc' | 'name_desc' | 'ranking' | 'total_spent' | 'last_purchase'
  >('name_asc');

  const [operationalFilter, setOperationalFilter] = useState<
    'all' | 'recent' | 'stale' | 'top_3'
  >('all');

  const { insights } = useSuppliersInsights();

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = suppliers.filter((s) => {
      const insight = insights[s.id];

      const matchesQuery =
        !q ||
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.document ?? '').toLowerCase().includes(q) ||
        (s.phone ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (operationalFilter === 'recent') {
        if (!insight?.last_purchase_at) return false;

        const diffDays =
          (Date.now() - new Date(insight.last_purchase_at).getTime()) /
          (1000 * 60 * 60 * 24);

        return diffDays <= 30;
      }

      if (operationalFilter === 'stale') {
        if (!insight?.last_purchase_at) return true;

        const diffDays =
          (Date.now() - new Date(insight.last_purchase_at).getTime()) /
          (1000 * 60 * 60 * 24);

        return diffDays > 90;
      }

      if (operationalFilter === 'top_3') {
        return (insight?.rank_position ?? Number.MAX_SAFE_INTEGER) <= 3;
      }

      return true;
    });

    return [...base].sort((a, b) => {
      const aInsight = insights[a.id];
      const bInsight = insights[b.id];

      switch (sortBy) {
        case 'name_desc':
          return (b.name ?? '').localeCompare(a.name ?? '', 'pt-BR');

        case 'ranking':
          return (
            (aInsight?.rank_position ?? Number.MAX_SAFE_INTEGER) -
            (bInsight?.rank_position ?? Number.MAX_SAFE_INTEGER)
          );

        case 'total_spent':
          return (bInsight?.total_spent ?? 0) - (aInsight?.total_spent ?? 0);

        case 'last_purchase':
          return (
            (bInsight?.last_purchase_at
              ? new Date(bInsight.last_purchase_at).getTime()
              : 0) -
            (aInsight?.last_purchase_at
              ? new Date(aInsight.last_purchase_at).getTime()
              : 0)
          );

        case 'name_asc':
        default:
          return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR');
      }
    });
  }, [suppliers, query, sortBy, insights, operationalFilter]);

  const exportSuppliersListCsv = useCallback(() => {
    if (!filteredAndSorted.length) return;

    const rows = filteredAndSorted.map((s) => {
      const insight = insights[s.id];
      const operational = getOperationalStatus(insight?.last_purchase_at);

      return {
        fornecedor: s.name,
        documento: s.document ?? '',
        telefone: s.phone ?? '',
        email: s.email ?? '',
        ranking: insight?.rank_position ?? '',
        participacao_pct:
          insight?.share_pct == null ? '' : formatCsvNumberBR(insight.share_pct),
        total_comprado:
          insight?.total_spent == null ? '' : formatCsvNumberBR(insight.total_spent),
        produtos_distintos:
          insight?.distinct_products == null
            ? ''
            : formatCsvIntegerBR(insight.distinct_products),
        ultima_compra: insight?.last_purchase_at ?? '',
        status_operacional: operational.label,
        status_cadastral: s.active ? 'ativo' : 'inativo',
      };
    });

    const csv = buildCsv(rows, [
      'fornecedor',
      'documento',
      'telefone',
      'email',
      'ranking',
      'participacao_pct',
      'total_comprado',
      'produtos_distintos',
      'ultima_compra',
      'status_operacional',
      'status_cadastral',
    ]);

    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCsv(`fornecedores_lista_${dateSuffix}.csv`, csv);
  }, [filteredAndSorted, insights]);

  const activeCount = useMemo(() => suppliers.filter((s: Supplier) => s.active).length, [suppliers]);
  const inactiveCount = useMemo(() => suppliers.filter((s: Supplier) => !s.active).length, [suppliers]);

  const onSave = async (input: SupplierInput, supplierId?: string) => {
    await upsertSupplier(input, supplierId);
  };

  return (
    <PageContainer
      title="Fornecedores"
      subtitle="Cadastre a origem das entradas para facilitar compras e reposição."
      lastUpdated={lastUpdated}
      onRefresh={fetchSuppliers}
      action={
        <button
          onClick={() => setModal({ open: true, mode: 'create' })}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Novo fornecedor
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsCard title="Ativos" value={activeCount} icon={<Package size={20} />} color="purple" />
          <StatsCard title="Inativos" value={inactiveCount} icon={<Activity size={20} />} color="orange" />
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-purple-400"
              placeholder="Buscar fornecedor..."
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:w-auto">
            <select
              value={operationalFilter}
              onChange={(e) =>
                setOperationalFilter(e.target.value as typeof operationalFilter)
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
            >
              <option value="all">Todos</option>
              <option value="recent">Com compra recente</option>
              <option value="stale">Sem compra recente</option>
              <option value="top_3">Top 3</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
            >
              <option value="name_asc">Nome (A → Z)</option>
              <option value="name_desc">Nome (Z → A)</option>
              <option value="ranking">Ranking</option>
              <option value="total_spent">Maior gasto</option>
              <option value="last_purchase">Última compra</option>
            </select>

            <button
              type="button"
              onClick={exportSuppliersListCsv}
              disabled={!filteredAndSorted.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mt-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredAndSorted.length === 0 ? (
              <EmptyState
                title="Nenhum fornecedor encontrado"
                description={
                  suppliers.length === 0
                    ? 'Cadastre o primeiro fornecedor para começar.'
                    : 'Tente ajustar a busca, o filtro operacional ou a ordenação.'
                }
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Fornecedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Contato
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Ranking
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                        Total comprado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                        Última compra
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredAndSorted.map((s: Supplier) => {
                      const insight = insights[s.id];
                      const operational = getOperationalStatus(insight?.last_purchase_at);
                      const rankingBadge = getRankingBadge(insight?.rank_position);

                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{s.document || '—'}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{s.phone || '—'}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{s.email || '—'}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-semibold text-gray-900">
                                {insight?.rank_position ? `#${insight.rank_position}` : '—'}
                              </div>

                              {rankingBadge ? (
                                <span
                                  className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${rankingBadge.className}`}
                                >
                                  {rankingBadge.label}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">Sem ranking</span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {(insight?.total_spent ?? 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              {insight?.distinct_products ?? 0} produtos
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="text-sm text-gray-900">
                              {insight?.last_purchase_at
                                ? new Date(insight.last_purchase_at).toLocaleDateString('pt-BR')
                                : '—'}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${operational.className}`}
                              >
                                {operational.label}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ' +
                                (s.active
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-gray-100 text-gray-700')
                              }
                            >
                              {s.active ? 'ativo' : 'inativo'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => navigate(`/admin/suppliers/${s.id}`)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                title="Ver histórico"
                                type="button"
                              >
                                <Eye className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() =>
                                  navigate(`/admin/stock/purchase-documents?supplier_id=${s.id}`)
                                }
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                title="Ver documentos"
                                type="button"
                              >
                                <FileText className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => setModal({ open: true, mode: 'edit', supplier: s })}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                type="button"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar
                              </button>

                              <button
                                onClick={() => setSupplierActive(s.id, !s.active)}
                                className={
                                  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ' +
                                  (s.active
                                    ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
                                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                                }
                                type="button"
                              >
                                <Power className="h-4 w-4" />
                                {s.active ? 'Desativar' : 'Ativar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <SupplierModal
        state={modal}
        onClose={() => setModal({ open: false })}
        onSave={onSave}
        saving={saving}
      />
    </PageContainer>
  );
}

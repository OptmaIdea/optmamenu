import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, Pencil, /* Power, PowerOff, */ Package,
  Activity, BarChart3, Eye, Download, FileText,
  XCircle, ShoppingBag, Flame, Zap, Truck,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useSuppliers } from './hooks/useSuppliers';
import type { Supplier } from './types/supplier.types';

import { useSuppliersInsights } from '@/pages/private/admin/suppliers/hooks/useSuppliersInsights';
import { buildCsv, downloadCsv, formatCsvNumberBR, formatCsvIntegerBR } from '@/utils/csv';
import { getSupplierOperationalBadges } from '@/pages/private/admin/products/inventory/utils/supplierStatusUtils';
import { SupplierFormModal } from '@/pages/private/admin/products/inventory/components/SupplierFormModal';

// ─── helpers ────────────────────────────────────────────────────────────────
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
    <div className="text-sm font-semibold text-gray-900">{title}</div>
    <div className="mt-1 text-sm text-gray-600">{description}</div>
  </div>
);

function getOperationalStatus(lastPurchaseAt?: string | null) {
  if (!lastPurchaseAt) return { icon: XCircle, label: 'Sem compras', className: 'bg-gray-100 text-gray-700' };
  const days = Math.floor((Date.now() - new Date(lastPurchaseAt).getTime()) / 86_400_000);
  if (days <= 30) return { icon: ShoppingBag, label: 'Ativo', className: 'bg-green-100 text-green-700' };
  if (days <= 90) return { icon: Flame, label: 'Morno', className: 'bg-yellow-100 text-yellow-700' };
  return { icon: Zap, label: 'Inativo', className: 'bg-rose-100 text-rose-700' };
}

function getRankingBadge(rank?: number | null) {
  if (!rank) return null;
  if (rank === 1) return { label: '#1', className: 'bg-purple-100 text-purple-700' };
  if (rank <= 3) return { label: 'Top 3', className: 'bg-blue-100 text-blue-700' };
  if (rank <= 10) return { label: 'Top 10', className: 'bg-indigo-100 text-indigo-700' };
  return null;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers, loading, lastUpdated, fetchSuppliers, /* setSupplierActive */ } = useSuppliers();
  const { insights } = useSuppliersInsights();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'ranking' | 'total_spent' | 'last_purchase'>('name_asc');
  const [operationalFilter, setOperationalFilter] = useState<'all' | 'recent' | 'stale' | 'top_3'>('all');

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<'create' | 'edit'>('create');
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const activeStoreId = getActiveStoreId();
  const { hasPermission, loading: loadingPermissions } = usePermissions(activeStoreId);

  const canViewSuppliers =
    hasPermission('suppliers.view') ||
    hasPermission('suppliers.manage') ||
    hasPermission('purchases.view');

  const canManageSuppliers = hasPermission('suppliers.manage');

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

  useEffect(() => {
    const activeStoreId = getActiveStoreId();
    if (activeStoreId) {
      setStoreId(activeStoreId);
    } else {
      toast.error('Nenhuma loja ativa selecionada.');
    }
  }, []);

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
        return (Date.now() - new Date(insight.last_purchase_at).getTime()) / 86_400_000 <= 30;
      }
      if (operationalFilter === 'stale') {
        if (!insight?.last_purchase_at) return true;
        return (Date.now() - new Date(insight.last_purchase_at).getTime()) / 86_400_000 > 90;
      }
      if (operationalFilter === 'top_3') {
        return (insight?.rank_position ?? Number.MAX_SAFE_INTEGER) <= 3;
      }
      return true;
    });

    return [...base].sort((a, b) => {
      const ai = insights[a.id];
      const bi = insights[b.id];
      switch (sortBy) {
        case 'name_desc': return (b.name ?? '').localeCompare(a.name ?? '', 'pt-BR');
        case 'ranking': return (ai?.rank_position ?? Number.MAX_SAFE_INTEGER) - (bi?.rank_position ?? Number.MAX_SAFE_INTEGER);
        case 'total_spent': return (bi?.total_spent ?? 0) - (ai?.total_spent ?? 0);
        case 'last_purchase':
          return ((bi?.last_purchase_at ? new Date(bi.last_purchase_at).getTime() : 0) -
            (ai?.last_purchase_at ? new Date(ai.last_purchase_at).getTime() : 0));
        default: return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR');
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
        participacao_pct: insight?.share_pct == null ? '' : formatCsvNumberBR(insight.share_pct),
        total_comprado: insight?.total_spent == null ? '' : formatCsvNumberBR(insight.total_spent),
        produtos_distintos: insight?.distinct_products == null ? '' : formatCsvIntegerBR(insight.distinct_products),
        ultima_compra: insight?.last_purchase_at ?? '',
        status_operacional: operational.label,
        status_cadastral: s.active ? 'ativo' : 'inativo',
      };
    });

    const csv = buildCsv(rows, [
      'fornecedor', 'documento', 'telefone', 'email', 'ranking',
      'participacao_pct', 'total_comprado', 'produtos_distintos',
      'ultima_compra', 'status_operacional', 'status_cadastral',
    ]);
    downloadCsv(`fornecedores_lista_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filteredAndSorted, insights]);

  const activeCount = useMemo(() => suppliers.filter((s: Supplier) => s.active).length, [suppliers]);
  const inactiveCount = useMemo(() => suppliers.filter((s: Supplier) => !s.active).length, [suppliers]);

  if (!loadingPermissions && !canViewSuppliers) {
    return (
      <PageContainer title="Fornecedores" subtitle="Acesso restrito">
        <div className="flex h-[400px] items-center justify-center rounded-2xl border border-gray-200 bg-white p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">Acesso restrito</h3>
            <p className="mt-2 text-sm text-gray-500">
              Você não tem permissão para visualizar fornecedores.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      {portalContainer && createPortal(
        <div className="flex items-center gap-2">
          {canManageSuppliers && (
            <button
              onClick={() => { setSupplierModalMode('create'); setEditingSupplier(null); setSupplierModalOpen(true); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#21A896] hover:bg-[#1a867a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
              type="button"
            >
              <Plus size={13} />
              <span>Novo Fornecedor</span>
            </button>
          )}
        </div>,
        portalContainer
      )}

      <PageContainer
        title="Fornecedores"
        subtitle="Cadastre a origem das entradas para facilitar compras e reposição."
        category="Produtos"
        icon={<Truck size={28} className="text-[#21A896]" />}
        lastUpdated={lastUpdated}
        onRefresh={fetchSuppliers}
        flat
      >
      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsCard title="Ativos" value={activeCount} icon={<Package size={20} />} color="purple" />
          <StatsCard title="Inativos" value={inactiveCount} icon={<Activity size={20} />} color="orange" />
        </div>

        {/* Filters */}
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:w-auto">
            <select
              value={operationalFilter}
              onChange={(e) => setOperationalFilter(e.target.value as typeof operationalFilter)}
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

            <button
              type="button"
              onClick={() => navigate('/admin/stock/purchase-insights')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard de compras
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
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
            /* overflow-x-auto permite scroll horizontal em telas menores (tablet/mobile) */
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-[860px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Contato</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ranking</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total comprado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Última compra</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Indicadores</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredAndSorted.map((s: Supplier) => {
                    const insight = insights[s.id];
                    const operational = getOperationalStatus(insight?.last_purchase_at);
                    const rankingBadge = getRankingBadge(insight?.rank_position);
                    const OpIcon = operational.icon;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        {/* Fornecedor */}
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{s.document || '—'}</div>
                        </td>

                        {/* Contato */}
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{s.phone || '—'}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{s.email || '—'}</div>
                        </td>

                        {/* Ranking */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-gray-900">
                              {insight?.rank_position ? `#${insight.rank_position}` : '—'}
                            </div>
                            {rankingBadge ? (
                              <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${rankingBadge.className}`}>
                                {rankingBadge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Sem ranking</span>
                            )}
                          </div>
                        </td>

                        {/* Total comprado */}
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {(insight?.total_spent ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">{insight?.distinct_products ?? 0} produtos</div>
                        </td>

                        {/* Última compra */}
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm text-gray-900">
                            {insight?.last_purchase_at
                              ? new Date(insight.last_purchase_at).toLocaleDateString('pt-BR')
                              : '—'}
                          </div>
                        </td>

                        {/* Status operacional */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${operational.className}`}>
                            <OpIcon size={13} />
                            {operational.label}
                          </span>
                        </td>

                        {/* Indicadores via helper */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {getSupplierOperationalBadges(s).map((badge) => {
                              const Icon = badge.icon;
                              return (
                                <span
                                  key={badge.key}
                                  title={badge.title}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${badge.className}`}
                                >
                                  <Icon size={14} />
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Ações (icon-only) */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/admin/suppliers/${s.id}/lifecycle`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#21A896] hover:bg-[#21A896]/10"
                              title="Vida do fornecedor"
                            >
                              <Activity size={15} />
                            </Link>

                            <button
                              onClick={() => navigate(`/admin/suppliers/${s.id}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              title="Ver histórico"
                              type="button"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={() => navigate(`/admin/stock/purchase-documents?supplier_id=${s.id}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              title="Ver documentos de compra"
                              type="button"
                            >
                              <FileText size={15} />
                            </button>

                            {canManageSuppliers && (
                              <button
                                onClick={() => { setSupplierModalMode('edit'); setEditingSupplier(s); setSupplierModalOpen(true); }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                title="Editar fornecedor"
                                type="button"
                              >
                                <Pencil size={15} />
                              </button>
                            )}

                            {/*                             <button
                              onClick={() => setSupplierActive(s.id, !s.active)}
                              className={
                                'inline-flex h-8 w-8 items-center justify-center rounded-lg ' +
                                (s.active
                                  ? 'border border-red-200 bg-white text-red-500 hover:bg-red-50'
                                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50')
                              }
                              title={s.active ? 'Desativar fornecedor' : 'Ativar fornecedor'}
                              type="button"
                            >
                              {s.active ? <PowerOff size={15} /> : <Power size={15} />}
                            </button> */}
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

      <SupplierFormModal
        open={supplierModalOpen}
        mode={supplierModalMode}
        supplier={editingSupplier}
        onClose={() => { setSupplierModalOpen(false); setEditingSupplier(null); }}
        onSubmit={async (payload) => {
          if (!storeId) throw new Error('Loja não identificada.');

          if (supplierModalMode === 'create') {
            const { error } = await supabase.from('suppliers').insert({ ...payload, store_id: storeId });
            if (error) throw error;
            toast.success('Fornecedor criado com sucesso.');
          } else {
            if (!editingSupplier?.id) throw new Error('Fornecedor não identificado.');
            const { data: updated, error } = await supabase
              .from('suppliers')
              .update({ ...payload, updated_at: new Date().toISOString() })
              .eq('id', editingSupplier.id)
              .eq('store_id', storeId)
              .select('id')
              .maybeSingle();
            if (error) throw error;
            if (!updated) throw new Error('Alteração não aplicada. Verifique suas permissões.');
            toast.success('Fornecedor atualizado com sucesso.');
          }

          await fetchSuppliers();
        }}
      />
    </PageContainer>
    </>
  );
}

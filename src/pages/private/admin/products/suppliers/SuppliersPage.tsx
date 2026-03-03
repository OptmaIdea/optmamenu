import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Power } from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

import { useSuppliers } from './hooks/useSuppliers';
import type { Supplier, SupplierInput } from './types/supplier.types';

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
  }, [isOpen, supplier?.id, state.mode]);

  // Re-seed when opening/editing another supplier
  // (simple approach: modal is unmounted when closed)
  if (!isOpen) return null;

  const title = state.mode === 'create' ? 'Novo fornecedor' : 'Editar fornecedor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            <div className="mt-1 text-sm text-gray-600">Dados básicos para identificar a origem das entradas.</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
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
                supplier?.id
              );
              onClose();
            }}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            disabled={saving || !name.trim()}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SuppliersPage() {
  const { suppliers, loading, saving, lastUpdated, fetchSuppliers, upsertSupplier, setSupplierActive } = useSuppliers();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s => (s.name ?? '').toLowerCase().includes(q));
  }, [suppliers, query]);

  const activeCount = useMemo(() => suppliers.filter(s => s.active).length, [suppliers]);
  const inactiveCount = useMemo(() => suppliers.filter(s => !s.active).length, [suppliers]);

  const onSave = async (input: SupplierInput, supplierId?: string) => {
    await upsertSupplier(input, supplierId);
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
              <p className="mt-1 text-sm text-gray-600">Cadastre a origem das entradas para facilitar compras e reposição.</p>
              <p className="mt-2 text-xs text-gray-500">Atualizado em {lastUpdated.toLocaleString()}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchSuppliers}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Atualizar
              </button>

              <button
                onClick={() => setModal({ open: true, mode: 'create' })}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
                Novo fornecedor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Ativos" value={activeCount} icon="box" trend="stable" />
            <StatsCard title="Inativos" value={inactiveCount} icon="activity" trend="stable" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-purple-400"
                placeholder="Buscar fornecedor..."
              />
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="Nenhum fornecedor encontrado"
                description={suppliers.length === 0 ? 'Cadastre o primeiro fornecedor para começar.' : 'Tente ajustar o filtro de busca.'}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Fornecedor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Contato</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filtered.map(s => (
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
                          <span
                            className={
                              'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ' +
                              (s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700')
                            }
                          >
                            {s.active ? 'ativo' : 'inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setModal({ open: true, mode: 'edit', supplier: s })}
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
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
                            >
                              <Power className="h-4 w-4" />
                              {s.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

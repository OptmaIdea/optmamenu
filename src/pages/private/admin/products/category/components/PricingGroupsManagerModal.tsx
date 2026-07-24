import { useEffect, useMemo, useState } from 'react';
import { Calculator, Layers3, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PriceRule } from '@/types';
import {
  PricingGroupService,
  type PricingGroup,
} from '@/services/pricingGroupService';
import type { Category } from '../types/category.types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  categories: Category[];
  canManage: boolean;
  onChanged: () => void;
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  active: boolean;
  priceRules: PriceRule[];
  categoryIds: string[];
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  active: false,
  priceRules: [
    { min: 0, price: 0 },
    { min: 8, price: 0 },
  ],
  categoryIds: [],
};

function newForm(): FormState {
  return {
    ...EMPTY_FORM,
    priceRules: EMPTY_FORM.priceRules.map((rule) => ({ ...rule })),
    categoryIds: [],
  };
}

function toForm(group: PricingGroup): FormState {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    active: group.active,
    priceRules: group.price_rules.map((rule) => ({ ...rule })),
    categoryIds: [...group.category_ids],
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export default function PricingGroupsManagerModal({
  isOpen,
  onClose,
  storeId,
  categories,
  canManage,
  onChanged,
}: Props) {
  const [groups, setGroups] = useState<PricingGroup[]>([]);
  const [form, setForm] = useState<FormState>(newForm());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async (preferredId?: string | null) => {
    setLoading(true);
    try {
      const loaded = await PricingGroupService.list(storeId);
      setGroups(loaded);
      const selected =
        loaded.find((group) => group.id === preferredId) ||
        loaded.find((group) => group.id === form.id) ||
        loaded[0];
      setForm(selected ? toForm(selected) : newForm());
    } catch (error) {
      console.error('Erro ao carregar grupos de atacado:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os grupos de atacado.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storeId]);

  useEffect(() => {
    setQuantities((current) =>
      Object.fromEntries(
        form.categoryIds.map((categoryId) => [categoryId, current[categoryId] || 0])
      )
    );
  }, [form.categoryIds]);

  const selectedCategories = useMemo(
    () => categories.filter((category) => form.categoryIds.includes(category.id)),
    [categories, form.categoryIds]
  );
  const simulatedQuantity = selectedCategories.reduce(
    (total, category) => total + (quantities[category.id] || 0),
    0
  );
  const simulatedTier = [...form.priceRules]
    .filter(
      (rule) =>
        Number.isFinite(rule.min) &&
        Number.isFinite(rule.price) &&
        rule.min <= simulatedQuantity
    )
    .sort((a, b) => b.min - a.min)[0];
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const updateRule = (index: number, field: keyof PriceRule, value: number) => {
    setForm((current) => ({
      ...current,
      priceRules: current.priceRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      ),
    }));
  };

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const saved = await PricingGroupService.save({
        id: form.id,
        storeId,
        name: form.name,
        description: form.description,
        active: form.active,
        priceRules: form.priceRules,
        categoryIds: form.categoryIds,
      });
      toast.success(
        saved.active
          ? 'Grupo de atacado publicado com sucesso.'
          : 'Rascunho do grupo salvo com sucesso.'
      );
      onChanged();
      await load(saved.id);
    } catch (error) {
      console.error('Erro ao salvar grupo de atacado:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="text-[#19A999]" size={22} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Grupos de atacado
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Some quantidades de categorias diferentes usando uma única faixa de preço.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-gray-200 bg-gray-50 p-3 md:border-b-0 md:border-r dark:border-gray-800 dark:bg-gray-950">
            {canManage && (
              <button
                type="button"
                onClick={() => setForm(newForm())}
                className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-3 text-sm font-bold text-white hover:bg-[#14887B]"
              >
                <Plus size={17} />
                Novo grupo
              </button>
            )}

            <div className="flex gap-2 overflow-x-auto md:block md:max-h-[calc(94vh-180px)] md:space-y-2 md:overflow-y-auto">
              {loading ? (
                <p className="px-2 py-4 text-sm text-gray-500">Carregando...</p>
              ) : groups.length === 0 ? (
                <p className="px-2 py-4 text-sm text-gray-500">
                  Nenhum grupo criado.
                </p>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setForm(toForm(group))}
                    className={`min-w-52 rounded-xl border p-3 text-left transition md:min-w-0 md:w-full ${
                      form.id === group.id
                        ? 'border-[#19A999] bg-[#19A999]/10'
                        : 'border-gray-200 bg-white hover:border-[#19A999]/50 dark:border-gray-800 dark:bg-gray-900'
                    }`}
                  >
                    <span className="block truncate text-sm font-bold">{group.name}</span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {group.category_ids.length} categorias ·{' '}
                      {group.active ? 'Publicado' : 'Rascunho'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <fieldset disabled={!canManage || saving} className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-semibold">Nome do grupo</span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex.: Picolés cremosos"
                    className="h-11 w-full rounded-xl border border-gray-300 px-3 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950"
                  />
                </label>

                <label className="flex items-end">
                  <span className="flex min-h-11 w-full items-center justify-between rounded-xl border border-gray-200 px-3 dark:border-gray-800">
                    <span>
                      <span className="block text-sm font-semibold">Publicado</span>
                      <span className="block text-xs text-gray-500">
                        Rascunhos não alteram preços.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, active: event.target.checked }))
                      }
                      className="h-5 w-5 accent-[#19A999]"
                    />
                  </span>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Descrição</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={2}
                    placeholder="Explique quando este atacado deve ser usado."
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-950"
                  />
                </label>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Faixas compartilhadas</h3>
                    <p className="text-xs text-gray-500">
                      A quantidade é a soma das categorias marcadas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        priceRules: [...current.priceRules, { min: 0, price: 0 }],
                      }))
                    }
                    className="flex min-h-10 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-semibold dark:border-gray-700"
                  >
                    <Plus size={16} />
                    Faixa
                  </button>
                </div>

                <div className="space-y-2">
                  {form.priceRules.map((rule, index) => (
                    <div
                      key={`${index}-${rule.min}`}
                      className="grid grid-cols-[1fr_1fr_42px] gap-2"
                    >
                      <label>
                        <span className="mb-1 block text-xs text-gray-500">A partir de</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={rule.min}
                          onChange={(event) =>
                            updateRule(index, 'min', Number(event.target.value))
                          }
                          className="h-10 w-full rounded-lg border border-gray-300 px-3 dark:border-gray-700 dark:bg-gray-950"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs text-gray-500">Preço unitário</span>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={rule.price}
                          onChange={(event) =>
                            updateRule(index, 'price', Number(event.target.value))
                          }
                          className="h-10 w-full rounded-lg border border-gray-300 px-3 dark:border-gray-700 dark:bg-gray-950"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            priceRules: current.priceRules.filter(
                              (_, ruleIndex) => ruleIndex !== index
                            ),
                          }))
                        }
                        disabled={form.priceRules.length <= 1}
                        className="mt-5 flex h-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/30"
                        aria-label="Remover faixa"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-bold">Categorias participantes</h3>
                <p className="mb-3 text-xs text-gray-500">
                  Ao publicar, use ao menos duas categorias. Uma categoria só pode usar um grupo.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => {
                    const checked = form.categoryIds.includes(category.id);
                    const otherGroup =
                      category.pricing_group_id && category.pricing_group_id !== form.id
                        ? groupNameById.get(category.pricing_group_id)
                        : null;
                    return (
                      <label
                        key={category.id}
                        className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 ${
                          checked
                            ? 'border-[#19A999] bg-[#19A999]/5'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              categoryIds: event.target.checked
                                ? [...current.categoryIds, category.id]
                                : current.categoryIds.filter((id) => id !== category.id),
                            }))
                          }
                          className="h-5 w-5 accent-[#19A999]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {category.name}
                          </span>
                          {otherGroup && (
                            <span className="block truncate text-xs text-amber-600">
                              Atualmente em {otherGroup}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[#7B2D8E]/20 bg-[#7B2D8E]/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Calculator size={18} className="text-[#7B2D8E]" />
                  <div>
                    <h3 className="font-bold">Simulador antes de salvar</h3>
                    <p className="text-xs text-gray-500">
                      Informe quantidades hipotéticas por categoria.
                    </p>
                  </div>
                </div>

                {selectedCategories.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Selecione categorias para simular a soma.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedCategories.map((category) => (
                        <label key={category.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {category.name}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={quantities[category.id] || 0}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [category.id]: Math.max(0, Number(event.target.value) || 0),
                              }))
                            }
                            className="h-10 w-24 rounded-lg border border-gray-300 px-3 dark:border-gray-700 dark:bg-gray-950"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 rounded-xl bg-white p-3 text-sm sm:grid-cols-3 dark:bg-gray-900">
                      <div>
                        <span className="block text-xs text-gray-500">Quantidade combinada</span>
                        <strong>{simulatedQuantity}</strong>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">Faixa alcançada</span>
                        <strong>
                          {simulatedTier ? `A partir de ${simulatedTier.min}` : 'Nenhuma'}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">Preço unitário</span>
                        <strong>
                          {simulatedTier ? formatCurrency(simulatedTier.price) : '—'}
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </fieldset>
          </main>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          {!canManage ? (
            <p className="text-sm text-gray-500">
              Modo leitura: sua função não permite alterar categorias.
            </p>
          ) : (
            <p className="hidden text-xs text-gray-500 sm:block">
              Rascunhos podem ser simulados sem afetar slug, PDV ou pedidos.
            </p>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold dark:border-gray-700"
            >
              Fechar
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || loading}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-[#19A999] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <Save size={17} />
                {saving ? 'Salvando...' : form.active ? 'Salvar e publicar' : 'Salvar rascunho'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

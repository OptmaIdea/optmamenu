import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { InventoryQuickNav } from '@/pages/private/admin/products/inventory/components/InventoryQuickNav';

type SupplierLite = { id: string; name: string };

type Row = {
  id: string;
  created_at: string;
  product: { name: string } | null;
  quantity: number;
  supplier: SupplierLite | null;
  metadata: any;
};

const formatCurrencyBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDateTimeBR = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
};

const safeNumber = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function PurchasesLedger() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, created_at, quantity, metadata, product:products(name), supplier:suppliers(id,name)')
        .eq('type', 'entry')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Erro ao carregar livro de caixa:', error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data as any) ?? []);
      setLoading(false);
    };

    run();
  }, []);

  const totals = useMemo(() => {
    let totalCost = 0;
    let withCost = 0;

    for (const r of rows) {
      const tc = safeNumber(r?.metadata?.total_cost);
      if (tc !== null) {
        totalCost += tc;
        withCost += 1;
      }
    }

    return { totalCost, withCost, totalRows: rows.length };
  }, [rows]);

  return (
    <PageContainer
      title="Compras"
      subtitle="Entradas de estoque com custo (quando informado)."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <InventoryQuickNav />
        </div>
      }
    >

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total em compras (200 últimas)</p>
          <p className="text-2xl font-bold mt-1">{formatCurrencyBRL(totals.totalCost)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-500">Movimentos com custo</p>
          <p className="text-2xl font-bold mt-1">{totals.withCost}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-sm text-gray-500">Movimentos (200 últimas)</p>
          <p className="text-2xl font-bold mt-1">{totals.totalRows}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="text-left font-semibold p-3">Data</th>
                  <th className="text-left font-semibold p-3">Produto</th>
                  <th className="text-left font-semibold p-3">Fornecedor</th>
                  <th className="text-right font-semibold p-3">Qtd</th>
                  <th className="text-right font-semibold p-3">Custo unit.</th>
                  <th className="text-right font-semibold p-3">Total</th>
                  <th className="text-left font-semibold p-3">NF/Ref.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const unit = safeNumber(r?.metadata?.unit_cost);
                  const total = safeNumber(r?.metadata?.total_cost);
                  const invoice = (r?.metadata?.invoice_number ?? '') as string;

                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="p-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                        {formatDateTimeBR(r.created_at)}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-gray-200">
                        {r.product?.name ?? '—'}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-gray-200">
                        {r.supplier?.name ?? '—'}
                      </td>
                      <td className="p-3 text-right text-gray-700 dark:text-gray-200">
                        {r.quantity}
                      </td>
                      <td className="p-3 text-right text-gray-700 dark:text-gray-200">
                        {unit !== null ? formatCurrencyBRL(unit) : '—'}
                      </td>
                      <td className="p-3 text-right text-gray-700 dark:text-gray-200">
                        {total !== null ? formatCurrencyBRL(total) : '—'}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-gray-200">
                        {invoice || '—'}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      Nenhuma entrada encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

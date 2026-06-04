import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  Package,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  MessageCircle,
  CheckCircle,
  LayoutDashboard,
} from 'lucide-react';

// Componentes
import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import DataCard from '@/components/common/DataCard';
import AlertBanner from '@/components/common/AlertBanner';
import RecentActivity from '@/components/common/RecentActivity';
import ProgressCard from '@/components/common/ProgressCard';
import { useStockAlerts, type StockAlertProduct } from '@/hooks/stock/useStockAlerts';

/* type StoreRow = {
  id: string;
  slug?: string | null;
  config?: any;
}; */

type DashboardOrdersSummary = {
  orders_count?: number | string;
  total_sales?: number | string;
  completed_count?: number | string;
  reserved_count?: number | string;
  cancelled_count?: number | string;
};

type DashboardRecentOrder = {
  id: string;
  order_code?: string | null;
  total: number | string;
  created_at: string;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    ordersToday: 0,
    salesToday: 0,
    activeProducts: 0,

    // Estoque
    criticalStockCount: 0,
    lowStockCount: 0,
    zeroStockCount: 0,
    excessStockCount: 0,

    // Outros
    newCustomers: 0,
    pendingMessages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [storeId, setStoreId] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const stockAlerts = useStockAlerts(storeId || undefined, { autoRefreshMs: 5 * 60 * 1000 });

  const zeroStockProducts: StockAlertProduct[] = stockAlerts.lists.zero;
  const lowStockProducts: StockAlertProduct[] = stockAlerts.lists.low;

  useEffect(() => {
    if (stockAlerts.loading) return;

    setStats((prev) => ({
      ...prev,
      activeProducts: stockAlerts.summary.activeCount,
      criticalStockCount: stockAlerts.summary.criticalCount,
      lowStockCount: stockAlerts.summary.lowCount,
      zeroStockCount: stockAlerts.summary.zeroCount,
      excessStockCount: stockAlerts.summary.excessCount,
    }));
  }, [
    stockAlerts.loading,
    stockAlerts.summary.activeCount,
    stockAlerts.summary.criticalCount,
    stockAlerts.summary.lowCount,
    stockAlerts.summary.zeroCount,
    stockAlerts.summary.excessCount,
  ]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setFatalError(null);
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('Erro ao obter usuário:', userError);
        setFatalError('Erro ao obter usuário autenticado.');
        return;
      }

      if (!user) {
        setFatalError('Usuário não autenticado.');
        return;
      }

      // Buscar store via RPC evita recursion/stack depth por RLS em stores.
      const activeStoreId = getActiveStoreId();

      if (!activeStoreId) {
        setFatalError('Nenhuma loja ativa selecionada. Faça login novamente e escolha uma loja.');
        return;
      }

      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, slug, config')
        .eq('id', activeStoreId)
        .maybeSingle();

      if (storeError) {
        console.error('Erro ao buscar loja ativa:', storeError);
        setFatalError(storeError.message || 'Erro ao buscar loja ativa.');
        return;
      }

      if (!store?.id) {
        setFatalError('Loja ativa não encontrada ou sem permissão.');
        return;
      }

      setStoreId(store.id);

      // Janela do dia em horário local do navegador.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayISO = today.toISOString();
      const tomorrowISO = tomorrow.toISOString();

      let ordersToday = 0;
      let salesToday = 0;

      // Pedidos de hoje via RPC SECURITY DEFINER, evitando REST direto em orders.
      const { data: ordersSummaryResult, error: ordersError } = await supabase.rpc(
        'get_dashboard_orders_summary',
        {
          p_store_id: store.id,
          p_start_at: todayISO,
          p_end_at: tomorrowISO,
        }
      );

      if (ordersError) {
        console.error('Error fetching orders summary:', ordersError);
      } else if (ordersSummaryResult?.ok) {
        const summary = ordersSummaryResult.summary as DashboardOrdersSummary;
        ordersToday = toNumber(summary.orders_count, 0);
        salesToday = toNumber(summary.total_sales, 0);
      }

      // Pedidos recentes também via RPC para evitar stack depth/RLS recursion no REST direto.
      const { data: recentOrdersResult, error: recentError } = await supabase.rpc(
        'get_dashboard_recent_orders',
        {
          p_store_id: store.id,
          p_limit: 5,
        }
      );

      if (recentError) {
        console.error('Error fetching recent orders:', recentError);
        setRecentActivities([]);
      } else if (recentOrdersResult?.ok) {
        const recentOrders = (recentOrdersResult.orders || []) as DashboardRecentOrder[];

        const activities = recentOrders.map((order) => ({
          id: order.id,
          type: 'order' as const,
          user: {
            name: order.customer_name || 'Cliente',
          },
          action: order.order_code
            ? `fez o pedido ${order.order_code} de`
            : 'fez um pedido de',
          target: toNumber(order.total, 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }),
          timestamp: new Date(order.created_at),
          status: order.status || 'reserved',
        }));

        setRecentActivities(activities);
      }

      // Mensagens ainda ficam mockadas até a central real entrar nessa etapa.
      const mockMessages = 2;

      setStats((prev) => ({
        ...prev,
        ordersToday,
        salesToday,
        newCustomers: 3,
        pendingMessages: mockMessages,
      }));

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setFatalError('Erro inesperado ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;
      await fetchDashboardData();
    }

    run();

    const interval = window.setInterval(() => {
      if (!cancelled) {
        fetchDashboardData();
      }
    }, 300000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      fetchDashboardData();
    };

    window.addEventListener('optmamenu.refresh', handleRefreshEvent);
    window.addEventListener('optmamenu:active-store-changed', handleRefreshEvent);

    return () => {
      window.removeEventListener('optmamenu.refresh', handleRefreshEvent);
      window.removeEventListener('optmamenu:active-store-changed', handleRefreshEvent);
    };
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-candara">
            Carregando dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <h2 className="text-lg font-black text-gray-800 dark:text-white mb-2">
            Não foi possível carregar o dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {fatalError}
          </p>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="px-4 py-2 rounded-xl font-bold bg-[#21A896] text-white hover:brightness-110"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Visão completa da sua operação em tempo real"
      category="Dashboard"
      icon={<LayoutDashboard size={28} className="text-[#21A896]" />}
      flat
    >
      {(stats.zeroStockCount > 0 || stats.lowStockCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {stats.zeroStockCount > 0 && (
            <AlertBanner
              type="error"
              title={`${stats.zeroStockCount} produto(s) com estoque zerado`}
              message="Estes produtos não aparecem mais no cardápio."
              action={{
                label: 'Ver produtos',
                onClick: () => (window.location.href = '/admin/products?filter=zero'),
              }}
            />
          )}

          {stats.lowStockCount > 0 && (
            <AlertBanner
              type="warning"
              title={`${stats.lowStockCount} produto(s) com estoque baixo`}
              message="Estes produtos estão abaixo do mínimo recomendado."
              action={{
                label: 'Reabastecer',
                onClick: () => (window.location.href = '/admin/inventory'),
              }}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard
          title="Estoque Crítico"
          value={stats.criticalStockCount}
          icon={<Package size={24} />}
          color="purple"
          onClick={() => (window.location.href = '/admin/products?filter=critical')}
        />

        <StatsCard
          title="Pedidos Hoje"
          value={stats.ordersToday}
          icon={<ShoppingBag size={24} />}
          trend={{ value: 15, positive: true, label: 'vs ontem' }}
          color="green"
          onClick={() => (window.location.href = '/admin/orders')}
        />

        <StatsCard
          title="Faturamento"
          value={stats.salesToday.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icon={<DollarSign size={24} />}
          trend={{ value: 23, positive: true, label: 'vs ontem' }}
          color="orange"
        />

        <StatsCard
          title="Produtos Ativos"
          value={stats.activeProducts}
          icon={<Package size={24} />}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataCard
              title="Estoque Zerado"
              badge={
                stats.zeroStockCount > 0
                  ? { text: `${stats.zeroStockCount} itens`, color: 'red' }
                  : undefined
              }
            >
              {stats.zeroStockCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4 dark:bg-green-900/30">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 font-candara">
                    Nenhum produto zerado
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {zeroStockProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-red-400 rounded-full"></div>
                        <span className="font-medium text-gray-700 dark:text-gray-300 font-candara">
                          {p.name}
                        </span>
                      </div>
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        Reabastecer
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </DataCard>

            <DataCard
              title="Estoque Baixo"
              badge={
                stats.lowStockCount > 0
                  ? { text: `${stats.lowStockCount} itens`, color: 'yellow' }
                  : undefined
              }
            >
              {stats.lowStockCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-green-100 text-green-600 p-4 rounded-full mb-4 dark:bg-green-900/30">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 font-candara">
                    Níveis saudáveis
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-yellow-500 rounded-full"></div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-candara">
                            {p.name}
                          </span>
                          <span className="text-xs text-gray-400 block">
                            {p.stock_quantity} / {p.min_stock ?? 5}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="text-xs text-gray-400 hover:text-[#21A896]"
                      >
                        Repor
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </DataCard>
          </div>

          <ProgressCard
            title="Meta de Vendas"
            value={stats.salesToday}
            max={2000}
            color="green"
            icon={<TrendingUp size={20} />}
            subtitle={`Faltam R$ ${Math.max(0, 2000 - stats.salesToday).toFixed(2)} para a meta`}
          />
        </div>

        <div className="space-y-6">
          <RecentActivity activities={recentActivities} viewAllLink="/admin/activity" />

          <DataCard title="Mensagens">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <MessageCircle size={24} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-candara">
                  Central de mensagens
                </p>
                <Link
                  to="/admin/messages-admin"
                  className="text-xs font-bold text-[#21A896] hover:underline"
                >
                  Acessar →
                </Link>
              </div>
            </div>
          </DataCard>
        </div>
      </div>
    </PageContainer>
  );
}

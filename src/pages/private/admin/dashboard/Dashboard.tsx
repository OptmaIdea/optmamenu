// src/pages/private/admin/dashboard/Dashboard.tsx
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  Package,
  ShoppingBag,
  TrendingUp,
  //AlertCircle,
  DollarSign,
  Users,
  MessageCircle,
  CheckCircle
} from 'lucide-react';

// Componentes
import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import DataCard from '@/components/common/DataCard';
import AlertBanner from '@/components/common/AlertBanner';
import RecentActivity from '@/components/common/RecentActivity';
import ProgressCard from '@/components/common/ProgressCard';

export default function Dashboard() {
  const [stats, setStats] = useState({
    ordersToday: 0,
    salesToday: 0,
    activeProducts: 0,
    lowStockCount: 0,
    zeroStockCount: 0,
    newCustomers: 0,
    pendingMessages: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [zeroStockProducts, setZeroStockProducts] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar store_id
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (storeError || !store) {
        console.error('Store not found:', storeError);
        return;
      }

      // Data de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayISO = today.toISOString();
      const tomorrowISO = tomorrow.toISOString();

      // 1. PEDIDOS DE HOJE - SEM JOIN
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total')
        .eq('store_id', store.id)
        .gte('created_at', todayISO)
        .lt('created_at', tomorrowISO);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }

      const ordersToday = orders?.length || 0;
      const salesToday = orders?.reduce((acc, curr) => acc + (curr.total || 0), 0) || 0;

      // 2. PRODUTOS ATIVOS
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock, active')
        .eq('store_id', store.id)
        .eq('active', true);

      if (productsError) {
        console.error('Error fetching products:', productsError);
      }

      // 3. PEDIDOS RECENTES - SEM JOIN (buscar dados do cliente separadamente se necessário)
      const { data: recentOrders, error: recentError } = await supabase
        .from('orders')
        .select('id, total, created_at, status, customer_name, customer_phone')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('Error fetching recent orders:', recentError);
      }

      // 4. MENSAGENS - REMOVIDO TEMPORARIAMENTE (coluna read não existe)
      // Vamos criar dados mock para não quebrar a UI
      const mockMessages = 2;

      // Processar produtos
      if (products) {
        const zero = products.filter(p => p.stock_quantity === 0);
        const low = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock || 5));

        setStats({
          ordersToday,
          salesToday,
          activeProducts: products.length,
          lowStockCount: low.length,
          zeroStockCount: zero.length,
          newCustomers: 3, // Mock
          pendingMessages: mockMessages
        });

        setLowStockProducts(low.slice(0, 5));
        setZeroStockProducts(zero.slice(0, 5));
      }

      // Processar atividades recentes
      if (recentOrders) {
        const activities = recentOrders.map(order => ({
          id: order.id,
          type: 'order' as const,
          user: {
            name: order.customer_name || 'Cliente'
          },
          action: 'fez um pedido de',
          target: order.total.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }),
          timestamp: new Date(order.created_at),
          status: order.status
        }));
        setRecentActivities(activities);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 300000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-candara">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Visão completa da sua operação em tempo real"
      lastUpdated={lastUpdated}
      onRefresh={fetchDashboardData}
    >
      {/* Alertas de Estoque */}
      {(stats.zeroStockCount > 0 || stats.lowStockCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {stats.zeroStockCount > 0 && (
            <AlertBanner
              type="error"
              title={`${stats.zeroStockCount} produto(s) com estoque zerado`}
              message="Estes produtos não aparecem mais no cardápio."
              action={{
                label: "Ver produtos",
                onClick: () => window.location.href = '/admin/products?filter=zero'
              }}
            />
          )}
          {stats.lowStockCount > 0 && (
            <AlertBanner
              type="warning"
              title={`${stats.lowStockCount} produto(s) com estoque baixo`}
              message="Estes produtos estão abaixo do mínimo recomendado."
              action={{
                label: "Reabastecer",
                onClick: () => window.location.href = '/admin/inventory'
              }}
            />
          )}
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard
          title="Pedidos Hoje"
          value={stats.ordersToday}
          icon={<ShoppingBag size={24} />}
          trend={{ value: 15, positive: true, label: 'vs ontem' }}
          color="green"
          onClick={() => window.location.href = '/admin/orders'}
        />

        <StatsCard
          title="Faturamento"
          value={stats.salesToday.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
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

        <StatsCard
          title="Clientes Hoje"
          value={stats.newCustomers}
          icon={<Users size={24} />}
          trend={{ value: 8, positive: true }}
          color="purple"
        />
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Coluna Esquerda */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Estoque Zerado */}
            <DataCard
              title="Estoque Zerado"
              badge={stats.zeroStockCount > 0 ? {
                text: `${stats.zeroStockCount} itens`,
                color: 'red'
              } : undefined}
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
                  {zeroStockProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
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

            {/* Estoque Baixo */}
            <DataCard
              title="Estoque Baixo"
              badge={stats.lowStockCount > 0 ? {
                text: `${stats.lowStockCount} itens`,
                color: 'orange'
              } : undefined}
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
                  {lowStockProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-yellow-400 rounded-full"></div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-candara">
                            {p.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {p.stock_quantity} / {p.min_stock || 5}
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
            subtitle={`Faltam R$ ${(2000 - stats.salesToday).toFixed(2)} para a meta`}
          />
        </div>

        {/* Coluna Direita */}
        <div className="space-y-6">
          <RecentActivity
            activities={recentActivities}
            viewAllLink="/admin/activity"
          />

          {/* Mensagens - Mock por enquanto */}
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
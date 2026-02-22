// src/pages/private/admin/dashboard/Activity.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Package,
  Users,
  CreditCard,
  Heart,
  MessageCircle,
  TrendingUp,
  Clock,
  Filter,
  Search,
  Download,
  ArrowLeft,
  DollarSign,
  Star,
  Award,
  RefreshCw
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

// Tipos de atividades
type ActivityType =
  | 'order'
  | 'product'
  | 'customer'
  | 'payment'
  | 'loyalty'
  | 'inventory'
  | 'message'
  | 'settings'
  | 'auth'; // Login/Logout

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
    role?: string;
  };
  timestamp: Date;
  amount?: number;
  status?: 'success' | 'pending' | 'cancelled' | 'warning';
  metadata?: Record<string, any>;
  link?: string;
}

export default function Activity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Dados de fallback - Simulam um dia de operação
  const mockActivities: Activity[] = [
    // VENDAS / PEDIDOS
    {
      id: '1',
      type: 'order',
      title: 'Novo pedido recebido',
      description: 'Pedido #1234 - Pizza Margherita + Coca-Cola',
      user: { name: 'João Silva' },
      timestamp: new Date(Date.now() - 5 * 60000),
      amount: 89.90,
      status: 'pending',
      link: '/admin/orders/1234'
    },
    {
      id: '2',
      type: 'order',
      title: 'Pedido entregue',
      description: 'Pedido #1230 - Hamburguer Artesanal',
      user: { name: 'Maria Santos' },
      timestamp: new Date(Date.now() - 25 * 60000),
      amount: 45.50,
      status: 'success',
      link: '/admin/orders/1230'
    },
    {
      id: '3',
      type: 'order',
      title: 'Pedido cancelado',
      description: 'Pedido #1228 - Salada Caesar',
      user: { name: 'Carlos Lima' },
      timestamp: new Date(Date.now() - 45 * 60000),
      amount: 32.90,
      status: 'cancelled',
      link: '/admin/orders/1228'
    },

    // ESTOQUE / PRODUTOS
    {
      id: '4',
      type: 'inventory',
      title: 'Estoque reabastecido',
      description: 'Líquido 13 - 50 unidades adicionadas',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 55 * 60000),
      status: 'success',
      link: '/admin/products/456'
    },
    {
      id: '5',
      type: 'product',
      title: 'Produto atualizado',
      description: 'Preço do Mapa Verde alterado de R$ 15,90 para R$ 17,90',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 75 * 60000),
      link: '/admin/products/789'
    },
    {
      id: '6',
      type: 'product',
      title: 'Novo produto cadastrado',
      description: 'Suco Detox Limão - R$ 12,90',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 120 * 60000),
      status: 'success',
      link: '/admin/products/new'
    },

    // CLIENTES
    {
      id: '7',
      type: 'customer',
      title: 'Novo cliente cadastrado',
      description: 'Ana Paula Rodrigues - anap@email.com',
      user: { name: 'Sistema' },
      timestamp: new Date(Date.now() - 130 * 60000),
      link: '/admin/customers/7890'
    },
    {
      id: '8',
      type: 'customer',
      title: 'Cliente completou 10 pedidos',
      description: 'Pedro Augusto - Cliente VIP',
      user: { name: 'Sistema' },
      timestamp: new Date(Date.now() - 150 * 60000),
      metadata: { orders: 10, total: 1250.00 },
      link: '/admin/customers/4567'
    },

    // PAGAMENTOS
    {
      id: '9',
      type: 'payment',
      title: 'Pagamento confirmado',
      description: 'Pedido #1234 - Cartão de crédito',
      user: { name: 'Sistema' },
      timestamp: new Date(Date.now() - 160 * 60000),
      amount: 89.90,
      status: 'success',
      link: '/admin/payments/987'
    },
    {
      id: '10',
      type: 'payment',
      title: 'Reembolso processado',
      description: 'Pedido #1228 - Estorno via PIX',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 180 * 60000),
      amount: 32.90,
      status: 'success',
      link: '/admin/payments/986'
    },

    // FIDELIDADE / PONTUAÇÃO
    {
      id: '11',
      type: 'loyalty',
      title: 'Pontos creditados',
      description: 'João Silva ganhou 89 pontos',
      user: { name: 'Sistema' },
      timestamp: new Date(Date.now() - 200 * 60000),
      metadata: { points: 89, program: 'Clube Optma' },
      link: '/admin/loyalty'
    },
    {
      id: '12',
      type: 'loyalty',
      title: 'Prêmio resgatado',
      description: 'Maria Santos resgatou "Café Grátis" (150 pontos)',
      user: { name: 'Maria Santos' },
      timestamp: new Date(Date.now() - 220 * 60000),
      status: 'success',
      link: '/admin/loyalty/rewards'
    },
    {
      id: '13',
      type: 'loyalty',
      title: 'Meta de fidelidade atingida',
      description: '10 clientes atingiram o nível Ouro este mês',
      user: { name: 'Sistema' },
      timestamp: new Date(Date.now() - 240 * 60000),
      status: 'success',
    },

    // MENSAGENS
    {
      id: '14',
      type: 'message',
      title: 'Nova mensagem de cliente',
      description: 'Carlos: "O pedido chegou rápido, parabéns!"',
      user: { name: 'Carlos Lima' },
      timestamp: new Date(Date.now() - 260 * 60000),
      status: 'pending',
      link: '/admin/messages-admin'
    },

    // CONFIGURAÇÕES
    {
      id: '15',
      type: 'settings',
      title: 'Horário de funcionamento alterado',
      description: 'Abertura aos domingos: 18h às 23h',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 300 * 60000),
      link: '/admin/hours'
    },
    {
      id: '16',
      type: 'settings',
      title: 'Método de pagamento adicionado',
      description: 'PIX agora disponível',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 350 * 60000),
      status: 'success',
      link: '/admin/payments'
    },

    // ACESSOS / AUTH
    {
      id: '17',
      type: 'auth',
      title: 'Login realizado',
      description: 'Usuário acessou o sistema',
      user: { name: 'Você', role: 'Admin' },
      timestamp: new Date(Date.now() - 60 * 60000),
      status: 'success'
    },
    {
      id: '18',
      type: 'auth',
      title: 'Login de usuário',
      description: 'Funcionário acessou o painel',
      user: { name: 'Funcionário', role: 'Staff' },
      timestamp: new Date(Date.now() - 120 * 60000),
      status: 'success'
    }
  ];

  useEffect(() => {
    // Simula carregamento de dados
    const loadActivities = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setActivities(mockActivities);
      setLastUpdated(new Date());
      setLoading(false);
    };
    loadActivities();
  }, []);

  // Filtros
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Filtro por tipo
      if (selectedTypes.length > 0 && !selectedTypes.includes(activity.type)) {
        return false;
      }

      // Filtro por data
      const now = new Date();
      const activityDate = new Date(activity.timestamp);

      switch (dateRange) {
        case 'today':
          if (activityDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          if (activityDate.toDateString() !== yesterday.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (activityDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          if (activityDate < monthAgo) return false;
          break;
      }

      // Filtro por busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          activity.title.toLowerCase().includes(search) ||
          activity.description.toLowerCase().includes(search) ||
          activity.user.name.toLowerCase().includes(search)
        );
      }

      return true;
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [activities, selectedTypes, dateRange, searchTerm]);

  // Agrupar por data
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: Activity[] } = {};

    filteredActivities.forEach(activity => {
      const date = activity.timestamp.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return groups;
  }, [filteredActivities]);

  const getActivityIcon = (type: ActivityType) => {
    const iconClass = "w-5 h-5";

    switch (type) {
      case 'order':
        return <ShoppingBag className={`${iconClass} text-[#21A896]`} />;
      case 'product':
        return <Package className={`${iconClass} text-[#F26541]`} />;
      case 'customer':
        return <Users className={`${iconClass} text-purple-500`} />;
      case 'payment':
        return <CreditCard className={`${iconClass} text-green-500`} />;
      case 'loyalty':
        return <Heart className={`${iconClass} text-pink-500`} />;
      case 'inventory':
        return <Package className={`${iconClass} text-blue-500`} />;
      case 'message':
        return <MessageCircle className={`${iconClass} text-indigo-500`} />;
      case 'settings':
        return <Clock className={`${iconClass} text-gray-500`} />;
      case 'auth':
        return <Users className={`${iconClass} text-orange-500`} />;
      default:
        return <Clock className={`${iconClass} text-gray-400`} />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">Concluído</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-bold">Pendente</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold">Cancelado</span>;
      case 'warning':
        return <span className="px-2 py-1 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-bold">Atenção</span>;
      default:
        return null;
    }
  };

  const toggleType = (type: ActivityType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setActivities(mockActivities);
      setLastUpdated(new Date());
      setLoading(false);
    }, 500);
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setDateRange('today');
    setSearchTerm('');
  };

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: filteredActivities.length,
      orders: filteredActivities.filter(a => a.type === 'order').length,
      sales: filteredActivities
        .filter(a => a.type === 'order' && a.amount)
        .reduce((acc, curr) => acc + (curr.amount || 0), 0),
      points: filteredActivities
        .filter(a => a.type === 'loyalty')
        .reduce((acc, curr) => acc + (curr.metadata?.points || 0), 0)
    };
  }, [filteredActivities]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-candara">Carregando atividades...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Central de Atividades"
      subtitle="Acompanhe tudo o que acontece no seu negócio em tempo real"
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      action={
        <Link
          to="/admin"
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-candara"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Voltar ao Dashboard</span>
        </Link>
      }
    >
      {/* Stats Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#21A896]/10 rounded-lg">
              <ShoppingBag size={20} className="text-[#21A896]" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Atividades</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.total}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F26541]/10 rounded-lg">
              <TrendingUp size={20} className="text-[#F26541]" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Vendas</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.orders}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign size={20} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Faturamento</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.sales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <Award size={20} className="text-pink-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Pontos</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.points}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar atividades, clientes, pedidos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#21A896] font-candara"
              />
            </div>

            {/* Filtro de Data */}
            <div className="flex gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#21A896] font-candara"
              >
                <option value="today">Hoje</option>
                <option value="yesterday">Ontem</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Últimos 30 dias</option>
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl border transition-colors flex items-center gap-2 font-candara ${showFilters || selectedTypes.length > 0
                  ? 'bg-[#21A896] text-white border-[#21A896]'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
              >
                <Filter size={18} />
                <span className="hidden sm:inline">Filtros</span>
                {selectedTypes.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white text-[#21A896] rounded-full text-xs font-bold">
                    {selectedTypes.length}
                  </span>
                )}
              </button>

              <button
                onClick={clearFilters}
                className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-candara"
                title="Limpar filtros"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Filtros por Tipo */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 animate-slideDown">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 font-candara">
                Filtrar por tipo de atividade:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: 'order', label: 'Pedidos', icon: ShoppingBag, color: 'text-[#21A896]' },
                  { type: 'product', label: 'Produtos', icon: Package, color: 'text-[#F26541]' },
                  { type: 'inventory', label: 'Estoque', icon: Package, color: 'text-blue-500' },
                  { type: 'customer', label: 'Clientes', icon: Users, color: 'text-purple-500' },
                  { type: 'payment', label: 'Pagamentos', icon: CreditCard, color: 'text-green-500' },
                  { type: 'loyalty', label: 'Fidelidade', icon: Heart, color: 'text-pink-500' },
                  { type: 'message', label: 'Mensagens', icon: MessageCircle, color: 'text-indigo-500' },
                  { type: 'settings', label: 'Configurações', icon: Clock, color: 'text-gray-500' },
                  { type: 'auth', label: 'Acessos', icon: Users, color: 'text-orange-500' }
                ].map(({ type, label, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type as ActivityType)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all
                      ${selectedTypes.includes(type as ActivityType)
                        ? 'bg-[#21A896] text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    <Icon size={16} className={selectedTypes.includes(type as ActivityType) ? 'text-white' : color} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline de Atividades */}
      <div className="space-y-8">
        {Object.entries(groupedActivities).map(([date, activities]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-4">
              <div className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 font-candara">
                  {date === new Date().toLocaleDateString('pt-BR')
                    ? 'Hoje'
                    : date === new Date(Date.now() - 86400000).toLocaleDateString('pt-BR')
                      ? 'Ontem'
                      : date
                  }
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent dark:from-gray-700"></div>
            </div>

            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    {/* Ícone */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center border border-gray-100 dark:border-gray-600 group-hover:border-[#21A896]/30 transition-colors">
                        {getActivityIcon(activity.type)}
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-gray-800 dark:text-white font-candara-bold">
                            {activity.title}
                          </h4>
                          {getStatusBadge(activity.status)}
                        </div>
                        <span className="text-xs text-gray-400 font-candara flex items-center whitespace-nowrap">
                          <Clock size={12} className="mr-1" />
                          {activity.timestamp.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 font-candara mb-2">
                        {activity.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-500">
                            {activity.user.name}
                          </span>
                          {activity.user.role && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              {activity.user.role}
                            </span>
                          )}
                          {activity.amount && (
                            <span className="text-xs font-bold text-[#21A896] bg-[#21A896]/10 px-2 py-0.5 rounded-full">
                              {activity.amount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              })}
                            </span>
                          )}
                          {activity.metadata?.points && (
                            <span className="text-xs font-bold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star size={10} />
                              {activity.metadata.points} pts
                            </span>
                          )}
                        </div>

                        {activity.link && (
                          <Link
                            to={activity.link}
                            className="text-xs font-bold text-[#21A896] hover:text-[#1a867a] transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Ver detalhes →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredActivities.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Clock size={40} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white font-candara-bold mb-2">
                Nenhuma atividade encontrada
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-candara mb-6 max-w-md">
                Tente ajustar seus filtros ou buscar por outros termos.
              </p>
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-xl font-bold transition-colors font-candara"
              >
                Limpar todos os filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com ações */}
      {filteredActivities.length > 0 && (
        <div className="mt-8 flex justify-end">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-candara">
            <Download size={18} />
            Exportar relatório
          </button>
        </div>
      )}
    </PageContainer>
  );
}
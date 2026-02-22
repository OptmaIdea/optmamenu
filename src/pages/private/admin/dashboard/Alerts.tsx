// src/pages/private/admin/dashboard/Alerts.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  ShoppingBag,
  Package,
  Truck,
  Users,
  CreditCard,
  Bell,
  BellRing,
  ArrowLeft,
  CheckCheck,
  Plus,
  Filter,
  RefreshCw,
  Trash2,
  Award,
  XCircle
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

// Tipos de alertas
type AlertPriority = 'high' | 'medium' | 'low';
type AlertCategory =
  | 'inventory'
  | 'order'
  | 'delivery'
  | 'payment'
  | 'customer'
  | 'schedule'
  | 'task'
  | 'system';

interface Alert {
  id: string;
  title: string;
  description: string;
  priority: AlertPriority;
  category: AlertCategory;
  timestamp: Date;
  deadline?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  action?: {
    label: string;
    link: string;
  };
  metadata?: Record<string, any>;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: AlertPriority;
  category: string;
  dueDate?: Date;
  createdAt: Date;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<AlertPriority>('medium');
  const [filterPriority, setFilterPriority] = useState<AlertPriority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<AlertCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'completed' | 'all'>('pending');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Dados de fallback - Alertas simulados
  const mockAlerts: Alert[] = [
    // ALERTAS CRÍTICOS (HIGH)
    {
      id: 'a1',
      title: 'Estoque zerado: Líquido 13',
      description: 'Produto sem estoque há 2 dias. Reabastecimento urgente necessário.',
      priority: 'high',
      category: 'inventory',
      timestamp: new Date(Date.now() - 15 * 60000),
      deadline: new Date(Date.now() + 2 * 3600000),
      status: 'pending',
      action: {
        label: 'Reabastecer agora',
        link: '/admin/products/456'
      }
    },
    {
      id: 'a2',
      title: 'Pedido atrasado #1245',
      description: 'Pedido do cliente João Silva está há 45 minutos aguardando confirmação.',
      priority: 'high',
      category: 'order',
      timestamp: new Date(Date.now() - 45 * 60000),
      status: 'pending',
      action: {
        label: 'Ver pedido',
        link: '/admin/orders/1245'
      }
    },
    {
      id: 'a3',
      title: 'Pagamento pendente',
      description: '3 pedidos aguardando confirmação de pagamento via PIX.',
      priority: 'high',
      category: 'payment',
      timestamp: new Date(Date.now() - 10 * 60000),
      status: 'pending',
      action: {
        label: 'Verificar pagamentos',
        link: '/admin/payments'
      },
      metadata: { count: 3, amount: 189.70 }
    },

    // ALERTAS MÉDIOS (MEDIUM)
    {
      id: 'a4',
      title: 'Estoque baixo: Mapa Verde',
      description: 'Apenas 9 unidades restantes. Mínimo recomendado: 15.',
      priority: 'medium',
      category: 'inventory',
      timestamp: new Date(Date.now() - 35 * 60000),
      deadline: new Date(Date.now() + 24 * 3600000),
      status: 'pending',
      action: {
        label: 'Repor estoque',
        link: '/admin/products/789'
      }
    },
    {
      id: 'a5',
      title: 'Entregas para hoje',
      description: '12 entregas programadas para hoje. 4 ainda não foram atribuídas.',
      priority: 'medium',
      category: 'delivery',
      timestamp: new Date(Date.now() - 120 * 60000),
      deadline: new Date(new Date().setHours(23, 59, 59, 999)),
      status: 'pending',
      action: {
        label: 'Gerenciar entregas',
        link: '/admin/orders?filter=delivery'
      },
      metadata: { total: 12, pending: 4 }
    },
    {
      id: 'a6',
      title: 'Cliente VIP: Aniversário hoje',
      description: 'Maria Santos completa 35 anos. Enviar cupom de desconto?',
      priority: 'medium',
      category: 'customer',
      timestamp: new Date(Date.now() - 180 * 60000),
      deadline: new Date(new Date().setHours(23, 59, 59, 999)),
      status: 'pending',
      action: {
        label: 'Enviar mensagem',
        link: '/admin/customers/123'
      }
    },
    {
      id: 'a7',
      title: 'Meta de vendas semanal',
      description: 'Atingimos 65% da meta semanal. Faltam R$ 1.250,00 para bater a meta.',
      priority: 'medium',
      category: 'system',
      timestamp: new Date(Date.now() - 240 * 60000),
      status: 'pending',
      metadata: { percentage: 65, remaining: 1250 }
    },

    // ALERTAS BAIXOS (LOW)
    {
      id: 'a8',
      title: 'Mensagens não lidas',
      description: '2 clientes enviaram mensagens há mais de 1 hora.',
      priority: 'low',
      category: 'customer',
      timestamp: new Date(Date.now() - 70 * 60000),
      status: 'pending',
      action: {
        label: 'Ver mensagens',
        link: '/admin/messages-admin'
      },
      metadata: { count: 2 }
    },
    {
      id: 'a9',
      title: 'Agendamento: Manutenção',
      description: 'Manutenção preventiva do sistema agendada para amanhã às 14h.',
      priority: 'low',
      category: 'schedule',
      timestamp: new Date(Date.now() - 300 * 60000),
      deadline: new Date(Date.now() + 24 * 3600000),
      status: 'pending',
      action: {
        label: 'Ver detalhes',
        link: '/admin/settings'
      }
    },
    {
      id: 'a10',
      title: 'Relatório mensal disponível',
      description: 'Relatório de vendas de Janeiro está pronto para download.',
      priority: 'low',
      category: 'system',
      timestamp: new Date(Date.now() - 480 * 60000),
      status: 'pending',
      action: {
        label: 'Baixar relatório',
        link: '/admin/reports'
      }
    }
  ];

  // Tarefas ToDo de fallback
  const mockTodos: TodoItem[] = [
    {
      id: 't1',
      text: 'Revisar pedidos pendentes do final de semana',
      completed: false,
      priority: 'high',
      category: 'order',
      dueDate: new Date(Date.now() + 2 * 3600000),
      createdAt: new Date(Date.now() - 86400000)
    },
    {
      id: 't2',
      text: 'Atualizar cardápio com novos preços',
      completed: false,
      priority: 'medium',
      category: 'product',
      dueDate: new Date(Date.now() + 24 * 3600000),
      createdAt: new Date(Date.now() - 172800000)
    },
    {
      id: 't3',
      text: 'Verificar relatório de fidelidade do mês',
      completed: true,
      priority: 'medium',
      category: 'loyalty',
      dueDate: new Date(Date.now() - 86400000),
      createdAt: new Date(Date.now() - 259200000)
    },
    {
      id: 't4',
      text: 'Agendar reunião com equipe de entregadores',
      completed: false,
      priority: 'high',
      category: 'delivery',
      dueDate: new Date(Date.now() + 48 * 3600000),
      createdAt: new Date(Date.now() - 86400000)
    },
    {
      id: 't5',
      text: 'Testar nova integração com gateway de pagamento',
      completed: false,
      priority: 'low',
      category: 'payment',
      dueDate: new Date(Date.now() + 72 * 3600000),
      createdAt: new Date(Date.now() - 43200000)
    },
    {
      id: 't6',
      text: 'Enviar newsletter promocional',
      completed: false,
      priority: 'medium',
      category: 'marketing',
      dueDate: new Date(Date.now() + 5 * 3600000),
      createdAt: new Date(Date.now() - 3600000)
    }
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setAlerts(mockAlerts);
      setTodos(mockTodos);
      setLastUpdated(new Date());
      setLoading(false);
    };
    loadData();
  }, []);

  // Filtros de alertas
  const filteredAlerts = useMemo(() => {
    return alerts
      .filter(alert => {
        if (filterPriority !== 'all' && alert.priority !== filterPriority) return false;
        if (filterCategory !== 'all' && alert.category !== filterCategory) return false;
        if (filterStatus !== 'all' && alert.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
  }, [alerts, filterPriority, filterCategory, filterStatus]);

  // Filtros de ToDos
  const filteredTodos = useMemo(() => {
    return todos
      .filter(todo => {
        if (filterStatus === 'completed' && !todo.completed) return false;
        if (filterStatus === 'pending' && todo.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });
  }, [todos, filterStatus]);

  // Estatísticas
  const stats = useMemo(() => {
    return {
      critical: alerts.filter(a => a.priority === 'high' && a.status === 'pending').length,
      pendingTodos: todos.filter(t => !t.completed).length,
      deliveries: alerts.filter(a => a.category === 'delivery' && a.status === 'pending').length,
      totalAlerts: filteredAlerts.length
    };
  }, [alerts, filteredAlerts, todos]);

  const getPriorityColor = (priority: AlertPriority) => {
    switch (priority) {
      case 'high': return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-600 dark:text-red-400',
        icon: 'text-red-500',
        badge: 'bg-red-500'
      };
      case 'medium': return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-600 dark:text-yellow-400',
        icon: 'text-yellow-500',
        badge: 'bg-yellow-500'
      };
      case 'low': return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-600 dark:text-blue-400',
        icon: 'text-blue-500',
        badge: 'bg-blue-500'
      };
    }
  };

  const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
      case 'inventory': return <Package size={18} />;
      case 'order': return <ShoppingBag size={18} />;
      case 'delivery': return <Truck size={18} />;
      case 'payment': return <CreditCard size={18} />;
      case 'customer': return <Users size={18} />;
      case 'schedule': return <Calendar size={18} />;
      case 'task': return <CheckCircle size={18} />;
      case 'system': return <Bell size={18} />;
      default: return <AlertCircle size={18} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-yellow-500" />;
      case 'in_progress': return <RefreshCw size={14} className="text-blue-500" />;
      case 'completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'cancelled': return <XCircle size={14} className="text-gray-500" />;
      default: return <Clock size={14} />;
    }
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;

    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      text: newTodoText,
      completed: false,
      priority: selectedPriority,
      category: 'task',
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 24 * 3600000)
    };

    setTodos([newTodo, ...todos]);
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setAlerts(mockAlerts);
      setTodos(mockTodos);
      setLastUpdated(new Date());
      setLoading(false);
    }, 500);
  };

  const clearFilters = () => {
    setFilterPriority('all');
    setFilterCategory('all');
    setFilterStatus('pending');
  };

  const markAllAsRead = () => {
    // Simula marcar todos alertas como lidos
    console.log('Todos alertas marcados como lidos');
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-candara">Carregando alertas e pendências...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Alertas e Pendências"
      subtitle="Central de notificações, tarefas e acompanhamento do seu negócio"
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-candara"
          >
            <CheckCheck size={18} />
            <span className="hidden sm:inline">Marcar todos como lidos</span>
          </button>
          <Link
            to="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-candara"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
        </div>
      }
    >
      {/* Stats Cards - Resumo do dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-5 rounded-2xl border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Críticos
              </p>
              <p className="text-3xl font-black text-red-700 dark:text-red-300 mt-1">
                {stats.critical}
              </p>
            </div>
            <div className="p-3 bg-red-200 dark:bg-red-700 rounded-full">
              <AlertTriangle size={28} className="text-red-700 dark:text-red-200" />
            </div>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
            <Clock size={12} />
            Requer atenção imediata
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-5 rounded-2xl border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                Pendências
              </p>
              <p className="text-3xl font-black text-yellow-700 dark:text-yellow-300 mt-1">
                {stats.pendingTodos}
              </p>
            </div>
            <div className="p-3 bg-yellow-200 dark:bg-yellow-700 rounded-full">
              <Clock size={28} className="text-yellow-700 dark:text-yellow-200" />
            </div>
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            Tarefas não concluídas
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-5 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Entregas
              </p>
              <p className="text-3xl font-black text-blue-700 dark:text-blue-300 mt-1">
                {stats.deliveries}
              </p>
            </div>
            <div className="p-3 bg-blue-200 dark:bg-blue-700 rounded-full">
              <Truck size={28} className="text-blue-700 dark:text-blue-200" />
            </div>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Pendentes de atribuição
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-5 rounded-2xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Total Alertas
              </p>
              <p className="text-3xl font-black text-purple-700 dark:text-purple-300 mt-1">
                {stats.totalAlerts}
              </p>
            </div>
            <div className="p-3 bg-purple-200 dark:bg-purple-700 rounded-full">
              <BellRing size={28} className="text-purple-700 dark:text-purple-200" />
            </div>
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
            Últimas 24 horas
          </p>
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 font-candara">
            <Filter size={16} className="inline mr-1" />
            Filtros:
          </span>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as AlertPriority | 'all')}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-[#21A896] font-candara"
          >
            <option value="all">Todas prioridades</option>
            <option value="high">Alta prioridade</option>
            <option value="medium">Média prioridade</option>
            <option value="low">Baixa prioridade</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as AlertCategory | 'all')}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-[#21A896] font-candara"
          >
            <option value="all">Todas categorias</option>
            <option value="inventory">Estoque</option>
            <option value="order">Pedidos</option>
            <option value="delivery">Entregas</option>
            <option value="payment">Pagamentos</option>
            <option value="customer">Clientes</option>
            <option value="schedule">Agendamentos</option>
            <option value="system">Sistema</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'pending' | 'completed' | 'all')}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-[#21A896] font-candara"
          >
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídos</option>
            <option value="all">Todos</option>
          </select>

          {(filterPriority !== 'all' || filterCategory !== 'all' || filterStatus !== 'pending') && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold font-candara"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal: Alertas + ToDo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna de Alertas - Ocupa 2 colunas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alertas Críticos - Sempre visíveis */}
          {filteredAlerts.filter(a => a.priority === 'high' && a.status === 'pending').length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold">
                  Atenção Imediata
                </h3>
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {filteredAlerts.filter(a => a.priority === 'high').length}
                </span>
              </div>
              <div className="space-y-3">
                {filteredAlerts
                  .filter(a => a.priority === 'high' && a.status === 'pending')
                  .map(alert => {
                    const colors = getPriorityColor(alert.priority);
                    return (
                      <div
                        key={alert.id}
                        className={`${colors.bg} ${colors.border} border rounded-2xl p-5 hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 ${colors.bg} rounded-lg ${colors.icon}`}>
                            {getCategoryIcon(alert.category)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-bold text-gray-800 dark:text-white font-candara-bold">
                                {alert.title}
                              </h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${colors.badge}`}>
                                {alert.priority === 'high' ? 'Crítico' : alert.priority === 'medium' ? 'Médio' : 'Baixo'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {alert.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-gray-500">
                                  {getStatusIcon(alert.status)}
                                  {alert.status === 'pending' ? 'Pendente' : alert.status === 'in_progress' ? 'Em andamento' : alert.status}
                                </span>
                                <span className="flex items-center gap-1 text-gray-500">
                                  <Clock size={12} />
                                  {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                                </span>
                                {alert.deadline && (
                                  <span className="flex items-center gap-1 text-orange-500">
                                    <Calendar size={12} />
                                    Prazo: {new Date(alert.deadline).toLocaleTimeString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              {alert.action && (
                                <Link
                                  to={alert.action.link}
                                  className="text-xs font-bold text-[#21A896] hover:text-[#1a867a] transition-colors"
                                >
                                  {alert.action.label} →
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Outros Alertas (Médios e Baixos) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Bell size={18} className="text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold">
                Outras Notificações
              </h3>
            </div>
            <div className="space-y-3">
              {filteredAlerts
                .filter(a => a.priority !== 'high' || a.status === 'completed')
                .map(alert => {
                  const colors = getPriorityColor(alert.priority);
                  return (
                    <div
                      key={alert.id}
                      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${colors.bg} ${colors.icon}`}>
                          {getCategoryIcon(alert.category)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800 dark:text-white font-candara-bold text-sm">
                              {alert.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.text} ${colors.bg}`}>
                              {alert.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {alert.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                            </span>
                            {alert.action && (
                              <Link
                                to={alert.action.link}
                                className="text-xs font-bold text-[#21A896] hover:text-[#1a867a] transition-colors"
                              >
                                Ver detalhes →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Coluna Direita - ToDo List e Agendamentos */}
        <div className="space-y-6">
          {/* ToDo List - Adicionar nova tarefa */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2">
                <CheckCircle size={18} className="text-[#21A896]" />
                Minhas Tarefas
              </h3>
            </div>

            {/* Adicionar nova tarefa */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                  placeholder="Adicionar nova tarefa..."
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#21A896] font-candara"
                />
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as AlertPriority)}
                  className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-[#21A896]"
                >
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
                <button
                  onClick={addTodo}
                  className="px-4 py-2.5 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-xl transition-colors flex items-center gap-1"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Lista de tarefas */}
            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                {filteredTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${todo.completed
                      ? 'bg-gray-50 dark:bg-gray-700/30 opacity-75'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                  >
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${todo.completed
                        ? 'bg-[#21A896] border-[#21A896] text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-[#21A896]'
                        }`}
                    >
                      {todo.completed && <CheckCheck size={12} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm font-medium font-candara ${todo.completed
                          ? 'text-gray-400 line-through'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          {todo.text}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${todo.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                          {todo.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {todo.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(todo.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {filteredTodos.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-candara">
                      Nenhuma tarefa pendente
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agendamentos do Dia */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-[#F26541]" />
              Agendamentos do Dia
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Clock size={16} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white">14:00 - Manutenção</p>
                  <p className="text-xs text-gray-500">Sistema de pedidos</p>
                </div>
                <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">Hoje</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white">16:30 - Reunião</p>
                  <p className="text-xs text-gray-500">Equipe de entregadores</p>
                </div>
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Hoje</span>
              </div>
              <Link
                to="/admin/hours"
                className="block text-center text-xs font-bold text-[#21A896] hover:underline mt-2"
              >
                Ver agenda completa →
              </Link>
            </div>
          </div>

          {/* Programa de Fidelidade - Alertas */}
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 p-5 rounded-2xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-pink-200 dark:bg-pink-700 rounded-lg">
                <Award size={20} className="text-pink-700 dark:text-pink-200" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-pink-800 dark:text-pink-200 text-sm mb-1">
                  Clube de Fidelidade
                </h4>
                <p className="text-xs text-pink-700 dark:text-pink-300 mb-2">
                  3 clientes estão a 1 compra de atingir o nível Ouro! 🎉
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-white dark:bg-pink-900 text-pink-600 dark:text-pink-200 px-2 py-1 rounded-full font-bold">
                    150 pontos em jogo
                  </span>
                  <Link
                    to="/admin/loyalty"
                    className="text-xs font-bold text-pink-700 dark:text-pink-200 hover:underline"
                  >
                    Visualizar →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
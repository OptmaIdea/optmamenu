// src/pages/private/admin/dashboard/PushNotifications.tsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Smartphone,
  Send,
  MessageCircle,
  Clock,
  UserPlus,
  Plus,
  Trash2,
  Edit,
  QrCode,
  Copy,
  CheckCheck,
  Wifi,
  ArrowLeft,
  Download
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';

// Tipos
type DeviceType = 'android' | 'ios' | 'web';
type NotificationStatus = 'sent' | 'delivered' | 'read' | 'failed';
type MessageChannel = 'push' | 'whatsapp' | 'both';

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  platform: string;
  token: string;
  lastActive: Date;
  isActive: boolean;
  userId: string;
  userName: string;
  userRole: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  channel: MessageChannel;
  recipients: string[];
  sentAt: Date;
  status: NotificationStatus;
  readBy?: string[];
  deliveredTo?: string[];
  metadata?: {
    whatsapp?: boolean;
    push?: boolean;
    link?: string;
    image?: string;
  };
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  content: string;
  variables: string[];
  status: 'active' | 'inactive';
}

interface Subscriber {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'manager' | 'delivery' | 'kitchen';
  isActive: boolean;
  devices: Device[];
  notificationPreferences: {
    push: boolean;
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
  };
}

export default function PushNotifications() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'send' | 'devices' | 'history' | 'templates'>('send');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Estados para nova notificação
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    channel: 'both' as MessageChannel,
    recipients: 'all' as 'all' | 'admins' | 'managers' | 'delivery' | 'kitchen' | 'custom',
    customRecipients: [] as string[],
    link: '',
    image: '',
    schedule: null as Date | null
  });

  const [copied, setCopied] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Dados de fallback - Dispositivos
  const mockDevices: Device[] = [
    {
      id: 'd1',
      name: 'iPhone de João',
      type: 'ios',
      platform: 'iOS 16.5',
      token: 'fcm_token_12345',
      lastActive: new Date(Date.now() - 5 * 60000),
      isActive: true,
      userId: 'u1',
      userName: 'João Silva',
      userRole: 'admin'
    },
    {
      id: 'd2',
      name: 'Android da Cozinha',
      type: 'android',
      platform: 'Android 13',
      token: 'fcm_token_67890',
      lastActive: new Date(Date.now() - 2 * 60000),
      isActive: true,
      userId: 'u2',
      userName: 'Maria Santos',
      userRole: 'kitchen'
    },
    {
      id: 'd3',
      name: 'Tablet Entregas',
      type: 'android',
      platform: 'Android 12',
      token: 'fcm_token_11111',
      lastActive: new Date(Date.now() - 15 * 60000),
      isActive: true,
      userId: 'u3',
      userName: 'Carlos Lima',
      userRole: 'delivery'
    },
    {
      id: 'd4',
      name: 'Web Admin',
      type: 'web',
      platform: 'Chrome 120',
      token: 'web_token_22222',
      lastActive: new Date(Date.now() - 45 * 60000),
      isActive: true,
      userId: 'u1',
      userName: 'João Silva',
      userRole: 'admin'
    }
  ];

  // Assinantes
  const mockSubscribers: Subscriber[] = [
    {
      id: 'u1',
      name: 'João Silva',
      phone: '5511999999999',
      role: 'admin',
      isActive: true,
      devices: mockDevices.filter(d => d.userId === 'u1'),
      notificationPreferences: {
        push: true,
        whatsapp: true,
        email: true,
        sms: false
      }
    },
    {
      id: 'u2',
      name: 'Maria Santos',
      phone: '5511888888888',
      role: 'kitchen',
      isActive: true,
      devices: mockDevices.filter(d => d.userId === 'u2'),
      notificationPreferences: {
        push: true,
        whatsapp: true,
        email: false,
        sms: false
      }
    },
    {
      id: 'u3',
      name: 'Carlos Lima',
      phone: '5511777777777',
      role: 'delivery',
      isActive: true,
      devices: mockDevices.filter(d => d.userId === 'u3'),
      notificationPreferences: {
        push: true,
        whatsapp: false,
        email: false,
        sms: true
      }
    }
  ];

  // Histórico de notificações
  const mockNotifications: Notification[] = [
    {
      id: 'n1',
      title: 'Novo pedido #1245',
      message: 'Cliente: João Silva - Total: R$ 89,90',
      channel: 'both',
      recipients: ['kitchen', 'delivery'],
      sentAt: new Date(Date.now() - 10 * 60000),
      status: 'delivered',
      deliveredTo: ['u2', 'u3'],
      metadata: {
        whatsapp: true,
        push: true,
        link: '/admin/orders/1245'
      }
    },
    {
      id: 'n2',
      title: 'Estoque crítico',
      message: 'Líquido 13 está com estoque zerado',
      channel: 'push',
      recipients: ['admins'],
      sentAt: new Date(Date.now() - 25 * 60000),
      status: 'read',
      readBy: ['u1'],
      deliveredTo: ['u1']
    },
    {
      id: 'n3',
      title: 'Entrega atrasada',
      message: 'Pedido #1230 - 15min de atraso',
      channel: 'whatsapp',
      recipients: ['delivery'],
      sentAt: new Date(Date.now() - 45 * 60000),
      status: 'delivered',
      deliveredTo: ['u3'],
      metadata: {
        whatsapp: true
      }
    }
  ];

  // Templates de WhatsApp
  const mockTemplates: WhatsAppTemplate[] = [
    {
      id: 't1',
      name: 'novo_pedido',
      category: 'utility',
      content: 'Olá {nome}, você tem um novo pedido #{numero} no valor de {valor}. Acesse o app para mais detalhes.',
      variables: ['nome', 'numero', 'valor'],
      status: 'active'
    },
    {
      id: 't2',
      name: 'estoque_baixo',
      category: 'utility',
      content: 'Alerta: O produto {produto} está com apenas {quantidade} unidades em estoque. Mínimo recomendado: {minimo}.',
      variables: ['produto', 'quantidade', 'minimo'],
      status: 'active'
    },
    {
      id: 't3',
      name: 'entrega_concluida',
      category: 'marketing',
      content: 'Pedido #{numero} foi entregue com sucesso! Obrigado por escolher nosso serviço. 🚀',
      variables: ['numero'],
      status: 'active'
    }
  ];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setDevices(mockDevices);
      setSubscribers(mockSubscribers);
      setNotifications(mockNotifications);
      setTemplates(mockTemplates);
      setWhatsappConnected(true);
      setPushEnabled(true);
      setLastUpdated(new Date());
      setLoading(false);
    };
    loadData();
  }, []);

  // Estatísticas
  const stats = useMemo(() => {
    return {
      activeDevices: devices.filter(d => d.isActive).length,
      totalDevices: devices.length,
      activeSubscribers: subscribers.filter(s => s.isActive).length,
      notificationsToday: notifications.filter(n =>
        n.sentAt.toDateString() === new Date().toDateString()
      ).length,
      whatsappConnected,
      pushEnabled
    };
  }, [devices, subscribers, notifications, whatsappConnected, pushEnabled]);

  const sendNotification = () => {
    if (!newNotification.title || !newNotification.message) return;

    const notification: Notification = {
      id: `notif-${Date.now()}`,
      title: newNotification.title,
      message: newNotification.message,
      channel: newNotification.channel,
      recipients: newNotification.recipients === 'custom'
        ? newNotification.customRecipients
        : [newNotification.recipients],
      sentAt: new Date(),
      status: 'sent',
      metadata: {
        push: newNotification.channel === 'push' || newNotification.channel === 'both',
        whatsapp: newNotification.channel === 'whatsapp' || newNotification.channel === 'both',
        link: newNotification.link,
        image: newNotification.image
      }
    };

    setNotifications([notification, ...notifications]);

    // Reset form
    setNewNotification({
      title: '',
      message: '',
      channel: 'both',
      recipients: 'all',
      customRecipients: [],
      link: '',
      image: '',
      schedule: null
    });

    // Simular envio
    console.log('📱 Enviando notificação:', notification);
  };

  const revokeDevice = (deviceId: string) => {
    setDevices(devices.map(d =>
      d.id === deviceId ? { ...d, isActive: false } : d
    ));
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText('https://app.optmamenu.com/connect/device/ABC123');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android': return <Smartphone className="text-green-500" size={18} />;
      case 'ios': return <Smartphone className="text-gray-500" size={18} />;
      case 'web': return <Wifi className="text-blue-500" size={18} />;
      default: return <Smartphone size={18} />;
    }
  };

  const getStatusColor = (status: NotificationStatus) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'delivered': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'read': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'failed': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#21A896] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 font-candara">Carregando sistema de notificações...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Push Notifications & WhatsApp"
      subtitle="Gerencie dispositivos, envie mensagens e acompanhe entregas"
      lastUpdated={lastUpdated}
      onRefresh={() => setLastUpdated(new Date())}
      action={
        <Link
          to="/admin"
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-candara"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Voltar</span>
        </Link>
      }
    >
      {/* Status do Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <BellRing size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Push Notifications</p>
              <p className={`text-lg font-bold font-candara-bold ${pushEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {pushEnabled ? 'Ativo' : 'Inativo'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <MessageCircle size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">WhatsApp API</p>
              <p className={`text-lg font-bold font-candara-bold ${whatsappConnected ? 'text-green-600' : 'text-red-600'}`}>
                {whatsappConnected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Smartphone size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Dispositivos</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.activeDevices}/{stats.totalDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Send size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-candara">Notificações</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white font-candara-bold">
                {stats.notificationsToday} hoje
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('send')}
            className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'send'
              ? 'text-[#21A896] border-b-2 border-[#21A896]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <Send size={16} className="inline mr-2" />
            Enviar Notificação
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'devices'
              ? 'text-[#21A896] border-b-2 border-[#21A896]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <Smartphone size={16} className="inline mr-2" />
            Dispositivos Conectados
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'history'
              ? 'text-[#21A896] border-b-2 border-[#21A896]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <Clock size={16} className="inline mr-2" />
            Histórico
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'templates'
              ? 'text-[#21A896] border-b-2 border-[#21A896]'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
          >
            <MessageCircle size={16} className="inline mr-2" />
            Templates WhatsApp
          </button>
        </div>

        {/* Conteúdo das Tabs */}
        <div className="p-6">
          {/* TAB 1: Enviar Notificação */}
          {activeTab === 'send' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Formulário de Envio */}
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2">
                    <Send size={18} className="text-[#21A896]" />
                    Nova Mensagem
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={newNotification.title}
                      onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                      placeholder="Ex: Novo pedido, Alerta de estoque..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] font-candara"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mensagem
                    </label>
                    <textarea
                      value={newNotification.message}
                      onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                      placeholder="Digite sua mensagem..."
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] font-candara resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Canal
                      </label>
                      <select
                        value={newNotification.channel}
                        onChange={(e) => setNewNotification({ ...newNotification, channel: e.target.value as MessageChannel })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896]"
                      >
                        <option value="both">Push + WhatsApp</option>
                        <option value="push">Apenas Push</option>
                        <option value="whatsapp">Apenas WhatsApp</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Destinatários
                      </label>
                      <select
                        value={newNotification.recipients}
                        onChange={(e) => setNewNotification({ ...newNotification, recipients: e.target.value as any })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896]"
                      >
                        <option value="all">Todos</option>
                        <option value="admins">Administradores</option>
                        <option value="managers">Gerentes</option>
                        <option value="delivery">Entregadores</option>
                        <option value="kitchen">Cozinha</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Link (opcional)
                    </label>
                    <input
                      type="text"
                      value={newNotification.link}
                      onChange={(e) => setNewNotification({ ...newNotification, link: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-[#21A896] font-candara"
                    />
                  </div>

                  <button
                    onClick={sendNotification}
                    disabled={!newNotification.title || !newNotification.message}
                    className="w-full py-4 bg-[#21A896] hover:bg-[#1a867a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Enviar Notificação
                  </button>
                </div>

                {/* QR Code para conexão */}
                <div className="bg-gradient-to-br from-[#21A896]/10 to-[#1a867a]/10 dark:from-[#21A896]/5 dark:to-[#1a867a]/5 rounded-2xl p-6 border border-[#21A896]/20">
                  <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2 mb-4">
                    <QrCode size={18} className="text-[#21A896]" />
                    Conectar Novo Dispositivo
                  </h3>

                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl mb-4 border-2 border-[#21A896]">
                      <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                        <QrCode size={120} className="text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 font-candara">
                      Escaneie o QR Code com o celular para conectar e receber notificações em tempo real.
                    </p>

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={copyInviteLink}
                        className="flex-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        {copied ? <CheckCheck size={18} /> : <Copy size={18} />}
                        {copied ? 'Copiado!' : 'Copiar link'}
                      </button>
                      <button className="flex-1 py-3 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-xl transition-colors flex items-center justify-center gap-2">
                        <Download size={18} />
                        Baixar App
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prévia da Mensagem */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">PRÉVIA DA MENSAGEM</p>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 max-w-md mx-auto shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#21A896]/10 rounded-lg">
                      <Bell size={20} className="text-[#21A896]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-white text-sm mb-1">
                        {newNotification.title || 'Título da notificação'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {newNotification.message || 'Sua mensagem aparecerá aqui...'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Agora mesmo • {newNotification.channel === 'both' ? 'Push + WhatsApp' : newNotification.channel === 'push' ? 'Push' : 'WhatsApp'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Dispositivos Conectados */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2">
                  <Smartphone size={18} className="text-[#21A896]" />
                  Dispositivos Ativos ({stats.activeDevices}/{stats.totalDevices})
                </h3>
                <button className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-xl text-sm font-bold flex items-center gap-2">
                  <UserPlus size={16} />
                  Convidar Usuário
                </button>
              </div>

              <div className="space-y-3">
                {devices.map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${device.type === 'ios' ? 'bg-gray-100 dark:bg-gray-700' :
                        device.type === 'android' ? 'bg-green-100 dark:bg-green-900/30' :
                          'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                        {getDeviceIcon(device.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-800 dark:text-white font-candara-bold">
                            {device.name}
                          </p>
                          {device.isActive ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">
                              Online
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full text-xs font-bold">
                              Offline
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {device.userName} • {device.userRole} • {device.platform}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Último acesso: {new Date(device.lastActive).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-[#21A896] transition-colors">
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => revokeDevice(device.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Histórico de Notificações */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2">
                <Clock size={18} className="text-[#21A896]" />
                Últimas Notificações
              </h3>

              <div className="space-y-3">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {notification.channel === 'both' ? (
                          <div className="flex -space-x-1">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <Bell size={14} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <MessageCircle size={14} className="text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                        ) : notification.channel === 'push' ? (
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Bell size={14} className="text-blue-600 dark:text-blue-400" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <MessageCircle size={14} className="text-green-600 dark:text-green-400" />
                          </div>
                        )}
                        <p className="font-bold text-gray-800 dark:text-white text-sm">
                          {notification.title}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(notification.status)}`}>
                          {notification.status === 'sent' && 'Enviada'}
                          {notification.status === 'delivered' && 'Entregue'}
                          {notification.status === 'read' && 'Visualizada'}
                          {notification.status === 'failed' && 'Falha'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(notification.sentAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">
                          Para: {notification.recipients.join(', ')}
                        </span>
                        {notification.deliveredTo && (
                          <span className="text-green-500 flex items-center gap-1">
                            <CheckCheck size={12} />
                            {notification.deliveredTo.length} entregues
                          </span>
                        )}
                      </div>
                      {notification.metadata?.link && (
                        <Link
                          to={notification.metadata.link}
                          className="text-xs font-bold text-[#21A896] hover:underline"
                        >
                          Ver detalhes →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Templates WhatsApp */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold flex items-center gap-2">
                  <MessageCircle size={18} className="text-[#21A896]" />
                  Templates WhatsApp
                </h3>
                <button className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-xl text-sm font-bold flex items-center gap-2">
                  <Plus size={16} />
                  Novo Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 dark:text-white font-candara-bold">
                            {template.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${template.status === 'active'
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                            {template.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {template.category === 'utility' && 'Utilitário'}
                          {template.category === 'marketing' && 'Marketing'}
                          {template.category === 'authentication' && 'Autenticação'}
                        </span>
                      </div>
                      <button className="p-1.5 text-gray-400 hover:text-[#21A896] transition-colors">
                        <Edit size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                      {template.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {template.variables.length} variáveis
                      </span>
                      <button className="text-xs font-bold text-[#21A896] hover:underline flex items-center gap-1">
                        <Send size={12} />
                        Usar template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
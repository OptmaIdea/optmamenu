import { User, Clock, Package, ShoppingBag, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Activity {
  id: string;
  type: 'order' | 'product' | 'message' | 'customer';
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target: string;
  timestamp: Date;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface RecentActivityProps {
  activities: Activity[];
  title?: string;
  viewAllLink?: string;
}

export default function RecentActivity({
  activities,
  title = 'Atividades Recentes',
  viewAllLink = '/admin/activity'
}: RecentActivityProps) {

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={16} className="text-[#19A999]" />;
      case 'product': return <Package size={16} className="text-[#F1613A]" />;
      case 'message': return <MessageCircle size={16} className="text-blue-500" />;
      case 'customer': return <User size={16} className="text-purple-500" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'completed': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 dark:text-white font-candara-bold">
          {title}
        </h3>
        {activities.length > 0 && (
          <span className="px-2.5 py-0.5 bg-[#19A999]/10 text-[#19A999] rounded-full text-xs font-bold">
            {activities.length}
          </span>
        )}
      </div>

      <div className="p-6">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
              <Clock size={32} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 font-candara">
              Nenhuma atividade recente
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {activity.user.avatar ? (
                    <img
                      src={activity.user.avatar}
                      alt={activity.user.name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <User size={18} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-gray-800 dark:text-white font-candara-bold truncate">
                      {activity.user.name}
                    </span>
                    <span className="text-xs text-gray-400 font-candara flex items-center whitespace-nowrap">
                      • <Clock size={12} className="inline mx-1" />
                      {new Date(activity.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300 font-candara mb-1">
                    {activity.action}{' '}
                    <span className="font-bold text-[#19A999]">
                      {activity.target}
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      {getIcon(activity.type)}
                    </div>
                    {activity.status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(activity.status)}`}>
                        {activity.status === 'pending' && 'Pendente'}
                        {activity.status === 'completed' && 'Concluído'}
                        {activity.status === 'cancelled' && 'Cancelado'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewAllLink && activities.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 text-center">
          <Link
            to={viewAllLink}
            className="text-sm font-bold text-[#19A999] hover:text-[#14887B] transition-colors font-candara"
          >
            Ver todas as atividades →
          </Link>
        </div>
      )}
    </div>
  );
}
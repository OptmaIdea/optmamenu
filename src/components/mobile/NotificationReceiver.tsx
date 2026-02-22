import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell } from 'lucide-react';
import { notificationService } from '@/services/notifications/notificationService';

export default function NotificationReceiver() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Verificar suporte a notificações
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration);

      // Subscrever para Push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || '')
      });


      // Salvar no backend
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await notificationService.subscribeWebPush(sub, user.id);
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
    }
  };

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      registerServiceWorker();
    }
  };

  // Função auxiliar para converter VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (permission !== 'granted') {
    return (
      <div className="fixed bottom-24 right-6 z-50 max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-[#21A896]/20 p-4 animate-slideUp">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#21A896]/10 rounded-lg">
              <Bell size={20} className="text-[#21A896]" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 dark:text-white text-sm mb-1">
                Receba notificações
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Ative para receber alertas de pedidos, entregas e estoque em tempo real.
              </p>
              <button
                onClick={requestPermission}
                className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white text-xs font-bold rounded-lg transition-colors"
              >
                Ativar Notificações
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
// src/services/notificationService.ts
import { supabase } from '@/lib/supabase';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  tokens: string[];
}

export interface WhatsAppMessage {
  to: string;
  template?: string;
  body?: string;
  variables?: Record<string, string>;
}

class NotificationService {

  // Registrar dispositivo para Push
  async registerDevice(userId: string, deviceInfo: any) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({
          user_id: userId,
          device_token: deviceInfo.token,
          device_type: deviceInfo.type,
          platform: deviceInfo.platform,
          device_name: deviceInfo.name,
          last_active: new Date()
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error);
      throw error;
    }
  }

  // Enviar Push Notification via FCM/APNS
  async sendPushNotification(notification: PushNotification) {
    try {
      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar push:', error);
      throw error;
    }
  }

  // Enviar WhatsApp via API
  async sendWhatsAppMessage(message: WhatsAppMessage) {
    try {
      // Exemplo com Evolution API ou similar
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: message.to,
          text: message.body,
          template: message.template,
          variables: message.variables
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      throw error;
    }
  }

  // Web Push para navegadores
  async subscribeWebPush(subscription: PushSubscription, userId: string) {
    try {
      const { data, error } = await supabase
        .from('web_push_subscriptions')
        .insert({
          user_id: userId,
          subscription: JSON.stringify(subscription),
          created_at: new Date()
        });

      return { data, error };
    } catch (error) {
      console.error('Erro ao subscrever Web Push:', error);
      throw error;
    }
  }

  // Gerar QR Code para conexão
  generateConnectionQR(userId: string, deviceName: string) {
    const connectionData = {
      userId,
      deviceName,
      timestamp: Date.now(),
      action: 'connect_device'
    };

    return JSON.stringify(connectionData);
  }
}

export const notificationService = new NotificationService();
import { supabase } from '@/lib/supabase';
import { buildWhatsappUrl, normalizeBrazilWhatsapp } from '@/utils/whatsapp';

export type OrderMessageEventCode =
  | 'order_accepted'
  | 'order_ready'
  | 'order_expiring'
  | 'order_expired'
  | 'order_cancelled';

export interface OrderMessageData {
  orderId: string;
  orderCode: string;
  customerName?: string | null;
  customerPhone?: string | null;
  trackingUrl: string;
  catalogUrl: string;
  expiresAt?: string | null;
  fulfillmentType?: string | null;
}

export interface PreparedOrderMessage {
  eventCode: OrderMessageEventCode;
  message: string;
  whatsappUrl: string;
  recipient: string;
}

const DEFAULT_TEMPLATES: Record<OrderMessageEventCode, string> = {
  order_accepted: [
    'Olá *{customerName}*! Bom ter você conosco 😊',
    '',
    'Seu pedido nº *{orderCode}* foi aceito e já estamos cuidando dele.',
    '',
    'Acompanhe o andamento:',
    '{trackingUrl}',
  ].join('\n'),
  order_ready: [
    'Ótimas notícias, *{customerName}*! 🥳',
    '',
    '{readyText}',
    '',
    'Acompanhe aqui:',
    '{trackingUrl}',
  ].join('\n'),
  order_expiring: [
    'Olá *{customerName}*.',
    '',
    'A reserva do pedido nº *{orderCode}* termina às *{expiresAt}*.',
    '',
    'Caso precise de mais tempo, fale conosco por aqui.',
    '',
    'Acompanhar pedido:',
    '{trackingUrl}',
  ].join('\n'),
  order_expired: [
    'Que pena 🙁',
    '',
    'A reserva do pedido nº *{orderCode}* expirou e ele foi cancelado.',
    '',
    'Quando quiser, estaremos aqui:',
    '{catalogUrl}',
  ].join('\n'),
  order_cancelled: [
    'Olá *{customerName}*.',
    '',
    'Não foi possível atender o pedido nº *{orderCode}* neste momento.',
    '',
    'Veja nosso catálogo:',
    '{catalogUrl}',
  ].join('\n'),
};

function compactOrderCode(value: string): string {
  const suffix = String(value || '').split('-').pop();
  return suffix ? `#${suffix}` : value;
}

function firstName(value?: string | null): string {
  return String(value || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
}

function formatTime(value?: string | null): string {
  if (!value) return 'horário informado pela loja';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'horário informado pela loja';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function readyText(fulfillmentType?: string | null): string {
  if (fulfillmentType === 'delivery') return 'Seu pedido está pronto e seguirá para entrega.';
  if (fulfillmentType === 'qr_table' || fulfillmentType === 'dine_in') {
    return 'Seu pedido está pronto e será encaminhado para sua mesa.';
  }
  return 'Seu pedido está pronto para retirada. Aguardamos você!';
}

function renderTemplate(template: string, data: OrderMessageData): string {
  const variables: Record<string, string> = {
    '{customerName}': firstName(data.customerName),
    '{orderCode}': compactOrderCode(data.orderCode),
    '{trackingUrl}': data.trackingUrl,
    '{catalogUrl}': data.catalogUrl,
    '{expiresAt}': formatTime(data.expiresAt),
    '{readyText}': readyText(data.fulfillmentType),
  };

  return Object.entries(variables).reduce(
    (message, [key, value]) => message.replaceAll(key, value),
    template,
  );
}

export const OrderCommunicationService = {
  prepare(eventCode: OrderMessageEventCode, data: OrderMessageData): PreparedOrderMessage {
    const message = renderTemplate(DEFAULT_TEMPLATES[eventCode], data);
    const recipient = normalizeBrazilWhatsapp(data.customerPhone);

    return {
      eventCode,
      message,
      recipient,
      whatsappUrl: buildWhatsappUrl(recipient, message),
    };
  },

  async logOpened(data: OrderMessageData, prepared: PreparedOrderMessage): Promise<void> {
    const { data: result, error } = await supabase.rpc('log_order_message_event', {
      p_order_id: data.orderId,
      p_event_code: prepared.eventCode,
      p_rendered_message: prepared.message,
      p_recipient: prepared.recipient,
      p_status: 'opened',
      p_direction: 'store_to_customer',
      p_channel: 'whatsapp',
      p_send_mode: 'assisted',
      p_metadata: {
        tracking_url: data.trackingUrl,
        catalog_url: data.catalogUrl,
        fulfillment_type: data.fulfillmentType ?? null,
      },
    });

    if (error || result?.ok === false) {
      console.error('Erro ao registrar abertura do WhatsApp:', error || result);
    }
  },

  async open(eventCode: OrderMessageEventCode, data: OrderMessageData): Promise<boolean> {
    const prepared = this.prepare(eventCode, data);
    if (!prepared.recipient || prepared.recipient.length < 12) return false;

    await this.logOpened(data, prepared);
    window.open(prepared.whatsappUrl, '_blank', 'noopener,noreferrer');
    return true;
  },
};

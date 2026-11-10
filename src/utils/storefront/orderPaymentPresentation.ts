/**
 * A escolha do método (Pix, cartão etc.) não comprova a liquidação.
 * Apenas o estado financeiro do servidor pode confirmar o pagamento.
 */
export function getOrderPaymentPresentation(paymentStatus: string | null | undefined) {
  switch (paymentStatus) {
    case 'paid':
      return { confirmed: true, title: 'Pagamento confirmado', shortLabel: 'Pago', description: 'O pagamento foi confirmado pelo sistema.' };
    case 'refunded':
      return { confirmed: false, title: 'Pagamento estornado', shortLabel: 'Estornado', description: 'O valor foi registrado como estornado.' };
    case 'partially_refunded':
      return { confirmed: false, title: 'Estorno parcial registrado', shortLabel: 'Estorno parcial', description: 'Uma parte do pagamento foi estornada. Consulte a loja para os detalhes.' };
    case 'refund_pending':
      return { confirmed: false, title: 'Estorno em processamento', shortLabel: 'Estorno pendente', description: 'A solicitação financeira ainda está sendo processada.' };
    case 'failed':
      return { confirmed: false, title: 'Pagamento não aprovado', shortLabel: 'Falhou', description: 'O pagamento não foi confirmado. Verifique a forma escolhida.' };
    default:
      return { confirmed: false, title: 'Pagamento ainda não confirmado', shortLabel: 'Aguardando pagamento', description: 'A forma escolhida não significa que a cobrança foi realizada. O pedido foi registrado, mas continua aguardando confirmação financeira.' };
  }
}

import type { PublicCheckoutPayNowMethod } from '@/services/publicOrderService';

export function getVisiblePayNowMethods(methods: PublicCheckoutPayNowMethod[], isTestStore: boolean) {
  if (!isTestStore) return methods;
  return methods.filter((method) => method.sandbox_only === true
    && method.integration_enabled === true
    && method.confirmation_mode === 'api'
    && !method.requires_proof);
}

const CUSTOMER_TOKEN_KEY = 'auth_token';

export function setCustomerToken(token: string) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}

export function clearCustomerToken() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Customer JWT issuance is deliberately disabled until the server-side flow can
 * prove password + OTP ownership before signing a token.
 *
 * Never restore the former contract that accepted caller-supplied customer_id
 * and store_id as sufficient proof of identity.
 */
export async function issueCustomerJwt(_params: {
  customer_id: string;
  store_id: string;
  expires_in_seconds?: number;
}): Promise<{ token: string; exp: number }> {
  throw new Error(
    'Sessão do cliente ainda não está habilitada: é necessário concluir a validação segura por senha e OTP.',
  );
}

// src/lib/jwt.ts

export const CUSTOMER_TOKEN_KEY = 'auth_token';

export function getCustomerToken(): string | null {
    try {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setCustomerToken(token: string): void {
    try {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    } catch {
        // ignore
    }
}

export function clearCustomerToken(): void {
    try {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    } catch {
        // ignore
    }
}
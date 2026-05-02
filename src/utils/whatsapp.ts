export function onlyDigits(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
}

export function normalizeBrazilWhatsapp(value?: string | null): string {
    const digits = onlyDigits(value);

    if (!digits) return '';

    // Já veio com DDI: 55 + DDD + número
    if (digits.startsWith('55') && digits.length >= 12) {
        return digits;
    }

    // DDD + número
    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    return digits;
}

export function buildWhatsappUrl(phone: string, message: string): string {
    const normalizedPhone = normalizeBrazilWhatsapp(phone);
    const encodedMessage = encodeURIComponent(message);

    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

export function canOpenWhatsapp(phone?: string | null): boolean {
    const normalizedPhone = normalizeBrazilWhatsapp(phone);
    return normalizedPhone.length >= 12;
}
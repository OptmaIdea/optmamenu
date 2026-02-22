export interface StoreData {
    id?: string;
    // Basic
    name: string;
    slug: string;
    description: string;
    logo_url: string | null;
    sms_gateway_token: string;
    stock_password_hash?: string;

    // Legal
    doc_type: 'PF' | 'PJ';
    document: string;
    legal_name: string;
    fantasy_name: string;
    establishment_type: string;

    // Address
    address: {
        zip_code: string;
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        city: string;
        state: string;
    };

    // Contacts
    contacts: {
        main_email: string;
        secondary_emails: string;
        phone_responsible: string;
        name_responsible: string;
        whatsapp_business: string;
        whatsapp_contact: string;
        social_media: string;
        website: string;
    };

    // Consents
    consents: {
        terms_accepted: boolean;
        lgpd_accepted: boolean;
        responsibility_accepted: boolean;
        no_illicit_accepted: boolean;
        channels: {
            whatsapp: boolean;
            sms: boolean;
            email: boolean;
        }
    };

    // Configuration
    config?: {
        opening_time?: string;
        closing_time?: string;
        custom_consent_text?: string;
        tolerance_minutes?: number;
        pre_order_minutes?: number;
        pin_failed_attempts?: number;
        pin_blocked?: boolean;
        pin_blocked_at?: string;
    };

    // Legal Texts & DPO
    privacy_policy_text?: string;
    terms_of_use_text?: string;
    cookie_policy_text?: string;
    dpo_email?: string;
    dpo_contact?: string;
}

export interface IBGEState {
    id: number;
    sigla: string;
    nome: string;
}

export interface IBGECity {
    id: number;
    nome: string;
}

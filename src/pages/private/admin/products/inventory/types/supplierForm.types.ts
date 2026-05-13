export type SupplierPersonType = '' | 'PF' | 'PJ' | 'OUTRO';

export type SupplierHomologationStatus =
    | 'not_evaluated'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'blocked';

export type SupplierFormValues = {
    id?: string;
    store_id?: string;

    // Identificação
    name: string;
    legal_name: string;
    trade_name: string;
    document: string;
    person_type: SupplierPersonType;
    phone: string;
    secondary_phone: string;
    email: string;
    website: string;
    notes: string;
    active: boolean;

    // Fiscal / legal
    state_registration: string;
    municipal_registration: string;
    tax_regime: string;
    cnae_code: string;
    icms_taxpayer_indicator: string;
    fiscal_notes: string;

    // Contatos principais
    commercial_contact_name: string;
    commercial_contact_role: string;
    commercial_phone: string;
    commercial_whatsapp: string;
    commercial_email: string;

    financial_contact_name: string;
    financial_phone: string;
    financial_email: string;

    fiscal_contact_name: string;
    fiscal_phone: string;
    fiscal_email: string;

    // Comercial / logística
    payment_terms: string;
    average_payment_days: number | '';
    minimum_order_value: number | '';
    freight_policy: string;
    delivery_days: number | '';
    lead_time_days: number | '';
    purchase_frequency: string;
    commercial_terms: string;

    // Financeiro
    credit_limit: number | '';
    beneficiary_name: string;
    pix_key_type: string;
    pix_key: string;
    bank_name: string;
    bank_agency: string;
    bank_account: string;
    bank_account_type: string;

    // Status / relacionamento
    homologation_status: SupplierHomologationStatus;
    preferred_supplier: boolean;
    blocked: boolean;
    blocked_reason: string;
    relationship_notes: string;
    tags_text: string;
};
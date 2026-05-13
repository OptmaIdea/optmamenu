import type { SupplierFormValues } from '../types/supplierForm.types';

type AnySupplier = Record<string, any>;

export const emptySupplierFormValues: SupplierFormValues = {
    name: '',
    legal_name: '',
    trade_name: '',
    document: '',
    person_type: '',
    phone: '',
    secondary_phone: '',
    email: '',
    website: '',
    notes: '',
    active: true,

    state_registration: '',
    municipal_registration: '',
    tax_regime: '',
    cnae_code: '',
    icms_taxpayer_indicator: '',
    fiscal_notes: '',

    commercial_contact_name: '',
    commercial_contact_role: '',
    commercial_phone: '',
    commercial_whatsapp: '',
    commercial_email: '',

    financial_contact_name: '',
    financial_phone: '',
    financial_email: '',

    fiscal_contact_name: '',
    fiscal_phone: '',
    fiscal_email: '',

    payment_terms: '',
    average_payment_days: '',
    minimum_order_value: '',
    freight_policy: '',
    delivery_days: '',
    lead_time_days: '',
    purchase_frequency: '',
    commercial_terms: '',

    credit_limit: '',
    beneficiary_name: '',
    pix_key_type: '',
    pix_key: '',
    bank_name: '',
    bank_agency: '',
    bank_account: '',
    bank_account_type: '',

    homologation_status: 'not_evaluated',
    preferred_supplier: false,
    blocked: false,
    blocked_reason: '',
    relationship_notes: '',
    tags_text: '',
};

function asText(value: unknown): string {
    return value == null ? '' : String(value);
}

function asNumberOrEmpty(value: unknown): number | '' {
    if (value == null || value === '') return '';
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : '';
}

export function supplierToFormValues(supplier?: AnySupplier | null): SupplierFormValues {
    if (!supplier) return emptySupplierFormValues;

    const bankInfo = supplier.bank_info && typeof supplier.bank_info === 'object'
        ? supplier.bank_info
        : {};

    return {
        ...emptySupplierFormValues,

        id: supplier.id,
        store_id: supplier.store_id,

        name: asText(supplier.name),
        legal_name: asText(supplier.legal_name),
        trade_name: asText(supplier.trade_name),
        document: asText(supplier.document),
        person_type: supplier.person_type ?? '',
        phone: asText(supplier.phone),
        secondary_phone: asText(supplier.secondary_phone),
        email: asText(supplier.email),
        website: asText(supplier.website),
        notes: asText(supplier.notes),
        active: supplier.active ?? true,

        state_registration: asText(supplier.state_registration),
        municipal_registration: asText(supplier.municipal_registration),
        tax_regime: asText(supplier.tax_regime),
        cnae_code: asText(supplier.cnae_code),
        icms_taxpayer_indicator: asText(supplier.icms_taxpayer_indicator),
        fiscal_notes: asText(supplier.fiscal_notes),

        commercial_contact_name: asText(supplier.commercial_contact_name),
        commercial_contact_role: asText(supplier.commercial_contact_role),
        commercial_phone: asText(supplier.commercial_phone),
        commercial_whatsapp: asText(supplier.commercial_whatsapp),
        commercial_email: asText(supplier.commercial_email),

        financial_contact_name: asText(supplier.financial_contact_name),
        financial_phone: asText(supplier.financial_phone),
        financial_email: asText(supplier.financial_email),

        fiscal_contact_name: asText(supplier.fiscal_contact_name),
        fiscal_phone: asText(supplier.fiscal_phone),
        fiscal_email: asText(supplier.fiscal_email),

        payment_terms: asText(supplier.payment_terms),
        average_payment_days: asNumberOrEmpty(supplier.average_payment_days),
        minimum_order_value: asNumberOrEmpty(supplier.minimum_order_value),
        freight_policy: asText(supplier.freight_policy),
        delivery_days: asNumberOrEmpty(supplier.delivery_days),
        lead_time_days: asNumberOrEmpty(supplier.lead_time_days),
        purchase_frequency: asText(supplier.purchase_frequency),
        commercial_terms: asText(supplier.commercial_terms),

        credit_limit: asNumberOrEmpty(supplier.credit_limit),
        beneficiary_name: asText(supplier.beneficiary_name),
        pix_key_type: asText(supplier.pix_key_type),
        pix_key: asText(supplier.pix_key),
        bank_name: asText(bankInfo.bank_name),
        bank_agency: asText(bankInfo.agency),
        bank_account: asText(bankInfo.account),
        bank_account_type: asText(bankInfo.account_type),

        homologation_status: supplier.homologation_status ?? 'not_evaluated',
        preferred_supplier: supplier.preferred_supplier ?? false,
        blocked: supplier.blocked ?? false,
        blocked_reason: asText(supplier.blocked_reason),
        relationship_notes: asText(supplier.relationship_notes),
        tags_text: Array.isArray(supplier.tags) ? supplier.tags.join(', ') : '',
    };
}

function nullIfBlank(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function numberOrZero(value: number | '') {
    return value === '' ? 0 : Number(value);
}

export function supplierFormValuesToPayload(values: SupplierFormValues) {
    return {
        name: values.name.trim(),
        legal_name: nullIfBlank(values.legal_name),
        trade_name: nullIfBlank(values.trade_name),
        document: nullIfBlank(values.document),
        person_type: values.person_type || null,
        phone: nullIfBlank(values.phone),
        secondary_phone: nullIfBlank(values.secondary_phone),
        email: nullIfBlank(values.email),
        website: nullIfBlank(values.website),
        notes: nullIfBlank(values.notes),
        active: values.active,

        state_registration: nullIfBlank(values.state_registration),
        municipal_registration: nullIfBlank(values.municipal_registration),
        tax_regime: nullIfBlank(values.tax_regime),
        cnae_code: nullIfBlank(values.cnae_code),
        icms_taxpayer_indicator: nullIfBlank(values.icms_taxpayer_indicator),
        fiscal_notes: nullIfBlank(values.fiscal_notes),

        commercial_contact_name: nullIfBlank(values.commercial_contact_name),
        commercial_contact_role: nullIfBlank(values.commercial_contact_role),
        commercial_phone: nullIfBlank(values.commercial_phone),
        commercial_whatsapp: nullIfBlank(values.commercial_whatsapp),
        commercial_email: nullIfBlank(values.commercial_email),

        financial_contact_name: nullIfBlank(values.financial_contact_name),
        financial_phone: nullIfBlank(values.financial_phone),
        financial_email: nullIfBlank(values.financial_email),

        fiscal_contact_name: nullIfBlank(values.fiscal_contact_name),
        fiscal_phone: nullIfBlank(values.fiscal_phone),
        fiscal_email: nullIfBlank(values.fiscal_email),

        payment_terms: nullIfBlank(values.payment_terms),
        average_payment_days: numberOrZero(values.average_payment_days),
        minimum_order_value: numberOrZero(values.minimum_order_value),
        freight_policy: nullIfBlank(values.freight_policy),
        delivery_days: numberOrZero(values.delivery_days),
        lead_time_days: numberOrZero(values.lead_time_days),
        purchase_frequency: nullIfBlank(values.purchase_frequency),
        commercial_terms: nullIfBlank(values.commercial_terms),

        credit_limit: numberOrZero(values.credit_limit),
        beneficiary_name: nullIfBlank(values.beneficiary_name),
        pix_key_type: nullIfBlank(values.pix_key_type),
        pix_key: nullIfBlank(values.pix_key),

        bank_info: {
            bank_name: nullIfBlank(values.bank_name),
            agency: nullIfBlank(values.bank_agency),
            account: nullIfBlank(values.bank_account),
            account_type: nullIfBlank(values.bank_account_type),
        },

        homologation_status: values.blocked ? 'blocked' : values.homologation_status,
        preferred_supplier: values.preferred_supplier,
        blocked: values.blocked,
        blocked_reason: values.blocked ? nullIfBlank(values.blocked_reason) : null,
        ...(values.blocked
            ? {}
            : { blocked_at: null }),
        relationship_notes: nullIfBlank(values.relationship_notes), tags: values.tags_text
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
    };
}
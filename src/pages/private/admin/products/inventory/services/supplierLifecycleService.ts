import { supabase } from '@/lib/supabase';

export type CreateSupplierContactInput = {
    supplierId: string;
    name: string;
    department?: string;
    role?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    notes?: string | null;
    isPrimary?: boolean;
};

export type CreateSupplierRelationshipEventInput = {
    supplierId: string;
    eventType: string;
    title: string;
    description?: string | null;
    severity?: string;
    status?: string;
    relatedPurchaseDocumentId?: string | null;
    relatedProductId?: string | null;
    metadata?: Record<string, unknown>;
};

export type UpdateSupplierOperationalStatusInput = {
    supplierId: string;
    homologationStatus?: string | null;
    preferredSupplier?: boolean | null;
    blocked?: boolean | null;
    blockedReason?: string | null;
};

function firstRow<T>(data: unknown): T {
    if (Array.isArray(data) && data[0]) return data[0] as T;
    throw new Error('A operação não retornou dados.');
}

export const supplierLifecycleService = {
    async createContact(input: CreateSupplierContactInput) {
        const { data, error } = await supabase.rpc('create_supplier_contact', {
            p_supplier_id: input.supplierId,
            p_name: input.name,
            p_department: input.department ?? 'commercial',
            p_role: input.role ?? null,
            p_phone: input.phone ?? null,
            p_whatsapp: input.whatsapp ?? null,
            p_email: input.email ?? null,
            p_notes: input.notes ?? null,
            p_is_primary: input.isPrimary ?? false,
        });

        if (error) throw error;
        return firstRow(data);
    },

    async createRelationshipEvent(input: CreateSupplierRelationshipEventInput) {
        const { data, error } = await supabase.rpc('create_supplier_relationship_event', {
            p_supplier_id: input.supplierId,
            p_event_type: input.eventType,
            p_title: input.title,
            p_description: input.description ?? null,
            p_severity: input.severity ?? 'info',
            p_status: input.status ?? 'open',
            p_related_purchase_document_id: input.relatedPurchaseDocumentId ?? null,
            p_related_product_id: input.relatedProductId ?? null,
            p_metadata: input.metadata ?? {},
        });

        if (error) throw error;
        return firstRow(data);
    },

    async updateOperationalStatus(input: UpdateSupplierOperationalStatusInput) {
        const { data, error } = await supabase.rpc('update_supplier_operational_status', {
            p_supplier_id: input.supplierId,
            p_homologation_status: input.homologationStatus ?? null,
            p_preferred_supplier: input.preferredSupplier ?? null,
            p_blocked: input.blocked ?? null,
            p_blocked_reason: input.blockedReason ?? null,
        });

        if (error) throw error;
        return firstRow(data);
    },
};
import { supabase } from '@/lib/supabase';

export interface MarketingSummary {
    total_segments: number;
    active_segments: number;
    total_campaigns: number;
    draft_campaigns: number;
    active_campaigns: number;
    scheduled_campaigns: number;
}

export interface CustomerSegment {
    id: string;
    store_id: string;
    code: string;
    name: string;
    description: string | null;
    segment_type: string;
    active: boolean;
    rules: Record<string, unknown>;
    members_count: number;
    created_at: string;
    updated_at: string;
}

export interface PromotionCampaign {
    id: string;
    store_id: string;
    code: string;
    name: string;
    description: string | null;
    campaign_type: string;
    status: string;
    target_type: string;
    target_segment_id: string | null;
    target_segment_name: string | null;
    target_customer_id: string | null;
    target_tag: string | null;
    channel: string;
    title: string | null;
    message_template: string | null;
    call_to_action: string | null;
    landing_url: string | null;
    benefit_rule_id: string | null;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    clicked_count: number;
    converted_count: number;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    scheduled_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface MarketingCenterData {
    summary: MarketingSummary;
    segments: CustomerSegment[];
    campaigns: PromotionCampaign[];
}

export interface UpsertCustomerSegmentInput {
    storeId: string;
    segmentId?: string | null;
    code?: string | null;
    name: string;
    description?: string | null;
    segmentType: string;
    active: boolean;
    rules?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface UpsertPromotionCampaignInput {
    storeId: string;
    campaignId?: string | null;
    code?: string | null;
    name: string;
    description?: string | null;
    campaignType: string;
    status: string;
    targetType: string;
    targetSegmentId?: string | null;
    targetCustomerId?: string | null;
    targetTag?: string | null;
    channel: string;
    title?: string | null;
    messageTemplate?: string | null;
    callToAction?: string | null;
    landingUrl?: string | null;
    benefitRuleId?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    scheduledAt?: string | null;
    active: boolean;
    conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface CampaignRecipientsPreview {
    ok: boolean;
    error?: string;
    target_type?: string;
    target_segment_id?: string | null;
    target_customer_id?: string | null;
    target_tag?: string | null;
    channel?: string;
    total_recipients?: number;
    preview_limit?: number;
    recipients?: Array<{
        customer_id: string;
        customer_name: string | null;
        phone: string | null;
        email: string | null;
        source: string | null;
        data_ownership: string | null;
        loyalty_points: number | null;
        loyalty_tier: string | null;
        tags: string[] | null;
        marketing_consent: boolean | null;
        loyalty_opt_in: boolean | null;
    }>;
}

export interface CampaignPreparedRecipient {
    id: string;
    campaign_id: string;
    customer_id: string;
    channel: string;
    recipient_name: string | null;
    recipient_phone: string | null;
    recipient_email: string | null;
    status: string;
    message_preview: string | null;
    sent_at: string | null;
    created_at: string;
}

export interface CampaignRecipientsData {
    campaign: {
        id: string;
        name: string;
        channel: string;
        status: string;
    };
    recipients: CampaignPreparedRecipient[];
}

export const MarketingCenterService = {
    async getCenter(storeId: string): Promise<MarketingCenterData> {
        const { data, error } = await supabase.rpc('get_marketing_center_safe', {
            p_store_id: storeId,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.error || 'Erro ao carregar central de marketing.');
        }

        return {
            summary: data.summary,
            segments: data.segments || [],
            campaigns: data.campaigns || [],
        };
    },

    async refreshSegments(storeId: string): Promise<{
        ok: boolean;
        members_refreshed?: number;
        error?: string;
    }> {
        const { data, error } = await supabase.rpc('refresh_customer_segments_safe', {
            p_store_id: storeId,
        });

        if (error) throw error;

        return data;
    },

    async upsertSegment(input: UpsertCustomerSegmentInput) {
        const { data, error } = await supabase.rpc('upsert_customer_segment_safe', {
            p_store_id: input.storeId,
            p_segment_id: input.segmentId || null,
            p_code: input.code || null,
            p_name: input.name,
            p_description: input.description || null,
            p_segment_type: input.segmentType,
            p_active: input.active,
            p_rules: input.rules || {},
            p_metadata: input.metadata || {},
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            segment_id?: string;
            code?: string;
        };
    },

    async upsertCampaign(input: UpsertPromotionCampaignInput) {
        const { data, error } = await supabase.rpc('upsert_promotion_campaign_safe', {
            p_store_id: input.storeId,
            p_campaign_id: input.campaignId || null,
            p_code: input.code || null,
            p_name: input.name,
            p_description: input.description || null,
            p_campaign_type: input.campaignType,
            p_status: input.status,
            p_target_type: input.targetType,
            p_target_segment_id: input.targetSegmentId || null,
            p_target_customer_id: input.targetCustomerId || null,
            p_target_tag: input.targetTag || null,
            p_channel: input.channel,
            p_title: input.title || null,
            p_message_template: input.messageTemplate || null,
            p_call_to_action: input.callToAction || null,
            p_landing_url: input.landingUrl || null,
            p_benefit_rule_id: input.benefitRuleId || null,
            p_starts_at: input.startsAt || null,
            p_ends_at: input.endsAt || null,
            p_scheduled_at: input.scheduledAt || null,
            p_active: input.active,
            p_conditions: input.conditions || {},
            p_metadata: input.metadata || {},
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            campaign_id?: string;
            code?: string;
        };
    },

    async previewRecipients(input: {
        storeId: string;
        campaignId?: string | null;
        targetType?: string | null;
        targetSegmentId?: string | null;
        targetCustomerId?: string | null;
        targetTag?: string | null;
        channel?: string | null;
        limit?: number;
    }): Promise<CampaignRecipientsPreview> {
        const { data, error } = await supabase.rpc('build_campaign_recipients_preview_safe', {
            p_store_id: input.storeId,
            p_campaign_id: input.campaignId || null,
            p_target_type: input.targetType || null,
            p_target_segment_id: input.targetSegmentId || null,
            p_target_customer_id: input.targetCustomerId || null,
            p_target_tag: input.targetTag || null,
            p_channel: input.channel || null,
            p_limit: input.limit || 20,
        });

        if (error) throw error;

        return data as CampaignRecipientsPreview;
    },

    async prepareCampaignRecipients(input: {
        storeId: string;
        campaignId: string;
        limit?: number;
    }) {
        const { data, error } = await supabase.rpc('prepare_campaign_recipients_safe', {
            p_store_id: input.storeId,
            p_campaign_id: input.campaignId,
            p_limit: input.limit || 500,
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            campaign_id?: string;
            total_preview_recipients?: number;
            recipients_prepared?: number;
        };
    },

    async getCampaignRecipients(input: {
        storeId: string;
        campaignId: string;
    }): Promise<CampaignRecipientsData> {
        const { data, error } = await supabase.rpc('get_campaign_recipients_safe', {
            p_store_id: input.storeId,
            p_campaign_id: input.campaignId,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.error || 'Erro ao carregar destinatários da campanha.');
        }

        return {
            campaign: data.campaign,
            recipients: data.recipients || [],
        };
    },

    async markRecipientManualSent(input: {
        storeId: string;
        recipientId: string;
    }) {
        const { data, error } = await supabase.rpc('mark_campaign_recipient_manual_sent_safe', {
            p_store_id: input.storeId,
            p_recipient_id: input.recipientId,
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            status?: string;
            recipient_id?: string;
        };
    },
};

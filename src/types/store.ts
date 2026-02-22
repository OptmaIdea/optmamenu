import type { StoreConfig } from '@/types';

export interface Store {
    id: string;
    name: string;
    slug: string;
    contacts?: {
        whatsapp_business?: string;
    };
    config?: StoreConfig;
}

export interface StoreHour {
    id?: string;
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
}

export interface StoreException {
    id?: string;
    exception_date: string;
    is_closed: boolean;
    open_time?: string;
    close_time?: string;
    reason?: string;
}

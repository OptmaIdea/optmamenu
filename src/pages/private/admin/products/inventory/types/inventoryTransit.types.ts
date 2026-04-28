export type InventoryTransitRow = {
    store_id: string;
    location_id: string;
    location_code: string | null;
    location_name: string;
    product_id: string;
    product_name: string;
    variant_id: string | null;

    in_transit_in: number;
    in_transit_out: number;
    net_in_transit: number;

    incoming_transfers_count: number;
    outgoing_transfers_count: number;

    incoming_transfers: Array<{
        transfer_id: string;
        transfer_code: string;
        qty: number;
        source_location_id: string;
        destination_location_id: string;
        shipped_at: string | null;
    }>;

    outgoing_transfers: Array<{
        transfer_id: string;
        transfer_code: string;
        qty: number;
        source_location_id: string;
        destination_location_id: string;
        shipped_at: string | null;
    }>;
};
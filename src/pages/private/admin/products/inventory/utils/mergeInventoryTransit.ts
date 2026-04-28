import type { InventoryTransitRow } from '../types/inventoryTransit.types';

type BaseInventoryRow = {
    location_id: string;
    product_id: string;
    variant_id?: string | null;
    available?: number | string | null;
    [key: string]: unknown;
};

function makeTransitKey(row: {
    location_id: string;
    product_id: string;
    variant_id?: string | null;
}) {
    return `${row.location_id}:${row.product_id}:${row.variant_id ?? 'default'}`;
}

export function mergeInventoryRowsWithTransit<T extends BaseInventoryRow>(
    inventoryRows: T[],
    transitRows: InventoryTransitRow[]
) {
    const transitMap = new Map<string, InventoryTransitRow>();

    transitRows.forEach((row) => {
        transitMap.set(makeTransitKey(row), row);
    });

    return inventoryRows.map((row) => {
        const transit = transitMap.get(makeTransitKey(row));
        const available = Number(row.available ?? 0);
        const inTransitIn = Number(transit?.in_transit_in ?? 0);
        const inTransitOut = Number(transit?.in_transit_out ?? 0);

        return {
            ...row,

            in_transit_in: inTransitIn,
            in_transit_out: inTransitOut,
            net_in_transit: Number(transit?.net_in_transit ?? 0),

            incoming_transfers_count: Number(transit?.incoming_transfers_count ?? 0),
            outgoing_transfers_count: Number(transit?.outgoing_transfers_count ?? 0),

            incoming_transfers: transit?.incoming_transfers ?? [],
            outgoing_transfers: transit?.outgoing_transfers ?? [],

            projected_available: available + inTransitIn,

            has_in_transit_in: inTransitIn > 0,
            has_in_transit_out: inTransitOut > 0,
            has_any_transit: inTransitIn > 0 || inTransitOut > 0,
        };
    });
}
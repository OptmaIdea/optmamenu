/**
 * Resolve deep links coming from "Meu consumo" when the catalog has changed.
 * Keep unrelated query params intact and never infer product availability from
 * old order snapshots: only the current public catalog is authoritative.
 */
export function resolveCustomerProductDeepLink(
    search: string,
    currentCatalogProductIds: readonly string[],
    catalogLoaded: boolean,
) {
    const params = new URLSearchParams(search);
    const productId = params.get('product');
    const fromConsumption = params.get('returnTo') === 'consumption';
    const existsInCatalog = Boolean(productId && currentCatalogProductIds.includes(productId));
    params.delete('product');
    params.delete('returnTo');

    return {
        productId,
        fromConsumption,
        existsInCatalog,
        shouldReturnToConsumption: catalogLoaded && Boolean(productId) && fromConsumption && !existsInCatalog,
        cleanSearch: params.toString(),
    };
}

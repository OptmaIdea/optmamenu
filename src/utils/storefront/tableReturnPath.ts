/**
 * Mantém a mesa associada à navegação de autoatendimento.
 * O código é um identificador de contexto, não uma credencial de autorização.
 */
export function buildStoreReturnPath(
  storeSlug: string,
  type?: string | null,
  tableCode?: string | null,
): string {
  const slug = encodeURIComponent(storeSlug);
  if (type === 'table' && tableCode?.trim()) {
    return `/mesa/${slug}/${encodeURIComponent(tableCode.trim())}`;
  }
  return `/s/${slug}`;
}

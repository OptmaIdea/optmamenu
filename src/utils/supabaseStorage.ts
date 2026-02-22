import type { SupabaseClient } from '@supabase/supabase-js';

/** Keep only unique, non-empty strings. */
export function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Extract the internal bucket path from a Supabase Storage public URL.
 * Returns null if it cannot parse.
 */
export function extractBucketPathFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = u.pathname.slice(idx + marker.length);
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/**
 * Convert image references (URLs or relative paths) into storage object paths for storage.remove().
 * If only a filename is provided, storeId/productId are used when available.
 */
export function toStoragePaths(
  imageRefs: string[],
  bucket: string,
  options?: { storeId?: string; productId?: string }
): string[] {
  return uniqueNonEmpty(
    imageRefs.map((ref) => {
      const extracted = extractBucketPathFromUrl(ref, bucket);
      if (extracted) return extracted;

      if (ref.includes('/')) return ref.replace(/^\/+/, '');

      const storeId = options?.storeId;
      const productId = options?.productId;
      if (storeId && productId) return `${storeId}/${productId}/${ref}`;
      return ref;
    })
  );
}

/**
 * Delete all objects under storeId/productId by listing and removing files.
 * Storage doesn't delete "folders" implicitly; you must remove each object path.
 */
export async function deleteProductFolderImages(params: {
  supabase: SupabaseClient;
  bucket: string;
  storeId: string;
  productId: string;
}): Promise<{ removed: number; errors: unknown[] }> {
  const { supabase, bucket, storeId, productId } = params;
  const prefix = `${storeId}/${productId}`;

  const { data: files, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) return { removed: 0, errors: [error] };
  if (!files?.length) return { removed: 0, errors: [] };

  const paths = files
    .filter((f) => !!f?.name && f.name !== '.emptyFolderPlaceholder')
    .map((f) => `${prefix}/${f.name}`);

  if (!paths.length) return { removed: 0, errors: [] };

  const { data: removed, error: removeErr } = await supabase.storage.from(bucket).remove(paths);
  const errors: unknown[] = [];
  if (removeErr) errors.push(removeErr);
  return { removed: removed?.length ?? 0, errors };
}

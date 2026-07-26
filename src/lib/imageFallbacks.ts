import type { SyntheticEvent } from 'react';

export const IMAGE_FALLBACKS = {
  product: '/fallbacks/product.svg',
  reward: '/fallbacks/reward.svg',
  store: '/fallbacks/store.svg',
} as const;

export type ImageFallbackKind = keyof typeof IMAGE_FALLBACKS;

export function imageOrFallback(value: string | null | undefined, kind: ImageFallbackKind): string {
  const normalized = value?.trim();
  return normalized || IMAGE_FALLBACKS[kind];
}

export function applyImageFallback(
  event: SyntheticEvent<HTMLImageElement>,
  kind: ImageFallbackKind,
): void {
  const image = event.currentTarget;
  const fallback = IMAGE_FALLBACKS[kind];

  if (image.dataset.fallbackApplied === 'true' || image.src.endsWith(fallback)) {
    image.onerror = null;
    return;
  }

  image.dataset.fallbackApplied = 'true';
  image.src = fallback;
}

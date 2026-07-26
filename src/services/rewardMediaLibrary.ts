import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

export const REWARD_MEDIA_LIBRARY_LIMIT = 15;

export type RewardMediaUsageStatus = 'active' | 'expired' | 'inactive';

export interface RewardMediaUsage {
  id: string;
  title: string;
  is_active: boolean;
  offer_valid_until: string | null;
  status: RewardMediaUsageStatus;
}

export interface RewardMediaAsset {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  usage_count?: number;
  usages?: RewardMediaUsage[];
}

function usageStatus(reward: { is_active: boolean; offer_valid_until: string | null }): RewardMediaUsageStatus {
  if (!reward.is_active) return 'inactive';
  if (reward.offer_valid_until && new Date(reward.offer_valid_until).getTime() < Date.now()) return 'expired';
  return 'active';
}

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(bytes: Uint8Array): string {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return state.map((value) => value.toString(16).padStart(8, '0')).join('');
}

async function sha256(blob: Blob): Promise<string> {
  return sha256Bytes(new Uint8Array(await blob.arrayBuffer()));
}

async function optimizeImage(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const max = 800;
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao converter imagem.')), 'image/webp', 0.82);
  });
  return { blob: optimizedBlob, width, height };
}

function storagePathFromUrl(url: string): string | null {
  const marker = '/reward-images/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

function isCanonicalPath(path: string | null): boolean {
  return Boolean(path && /\/library\/[0-9a-f-]{36}\/image\.webp$/i.test(path));
}

async function removeStorageObject(bucket: string, path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
  if (!data?.some((item) => item.name === path || item.name.endsWith(path.split('/').pop() || ''))) {
    throw new Error(`O Storage não confirmou a exclusão de ${path}.`);
  }
}

export async function listRewardMediaAssets(storeId: string): Promise<RewardMediaAsset[]> {
  const { data: assets, error } = await supabase
    .from('reward_media_assets')
    .select('*')
    .eq('store_id', storeId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = (assets || []).map((asset) => asset.id);
  const usages = new Map<string, RewardMediaUsage[]>();
  if (ids.length > 0) {
    const { data: rewards, error: rewardsError } = await supabase
      .from('fidelity_rewards')
      .select('id, title, is_active, offer_valid_until, media_asset_id')
      .in('media_asset_id', ids);
    if (rewardsError) throw rewardsError;
    for (const reward of rewards || []) {
      if (!reward.media_asset_id) continue;
      const current = usages.get(reward.media_asset_id) || [];
      current.push({
        id: reward.id,
        title: reward.title,
        is_active: reward.is_active,
        offer_valid_until: reward.offer_valid_until,
        status: usageStatus(reward),
      });
      usages.set(reward.media_asset_id, current);
    }
  }

  return (assets || []).map((asset) => {
    const assetUsages = usages.get(asset.id) || [];
    return { ...asset, usage_count: assetUsages.length, usages: assetUsages };
  });
}

export async function syncExistingRewardMediaAssets(storeId: string): Promise<{ imported: number; linked: number; skipped: number }> {
  const currentAssets = await listRewardMediaAssets(storeId);
  let availableSlots = Math.max(0, REWARD_MEDIA_LIBRARY_LIMIT - currentAssets.length);

  const { data: programs, error: programsError } = await supabase.from('fidelity_programs').select('id').eq('store_id', storeId);
  if (programsError) throw programsError;
  const programIds = (programs || []).map((program) => program.id);
  if (programIds.length === 0) return { imported: 0, linked: 0, skipped: 0 };

  const { data: rewards, error: rewardsError } = await supabase
    .from('fidelity_rewards')
    .select('id, title, image_url, media_asset_id, product_id')
    .in('program_id', programIds)
    .not('image_url', 'is', null);
  if (rewardsError) throw rewardsError;

  const candidates = (rewards || []).filter((reward) => {
    const url = reward.image_url || '';
    return !reward.product_id && url.includes('/reward-images/') && !url.includes('/fallbacks/');
  });

  const groups = new Map<string, typeof candidates>();
  for (const reward of candidates) {
    const url = reward.image_url as string;
    const current = groups.get(url) || [];
    current.push(reward);
    groups.set(url, current);
  }

  let imported = 0;
  let linked = 0;
  let skipped = 0;

  for (const [url, relatedRewards] of groups) {
    try {
      const oldPath = storagePathFromUrl(url);
      const currentAssetId = relatedRewards.find((reward) => reward.media_asset_id)?.media_asset_id as string | undefined;
      const currentAsset = currentAssetId ? currentAssets.find((asset) => asset.id === currentAssetId) : undefined;

      if (currentAsset && isCanonicalPath(currentAsset.storage_path) && currentAsset.mime_type === 'image/webp') continue;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const optimized = await optimizeImage(await response.blob());
      const contentHash = await sha256(optimized.blob);

      const { data: duplicate, error: duplicateError } = await supabase
        .from('reward_media_assets')
        .select('*')
        .eq('store_id', storeId)
        .eq('content_hash', contentHash)
        .is('archived_at', null)
        .neq('id', currentAssetId || '00000000-0000-0000-0000-000000000000')
        .maybeSingle();
      if (duplicateError) throw duplicateError;

      let assetId: string;
      let publicUrl: string;

      if (duplicate) {
        assetId = duplicate.id;
        publicUrl = duplicate.public_url;
      } else {
        if (!currentAsset && availableSlots <= 0) {
          skipped += relatedRewards.length;
          continue;
        }

        assetId = currentAsset?.id || uuidv4();
        const newPath = `${storeId}/library/${assetId}/image.webp`;
        const { error: uploadError } = await supabase.storage
          .from('reward-images')
          .upload(newPath, optimized.blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
        if (uploadError) throw uploadError;

        publicUrl = supabase.storage.from('reward-images').getPublicUrl(newPath).data.publicUrl;
        const payload = {
          id: assetId,
          store_id: storeId,
          name: currentAsset?.name || relatedRewards[0]?.title?.trim() || 'Imagem de prêmio',
          description: currentAsset?.description || 'Imagem migrada automaticamente para o pipeline da biblioteca.',
          storage_bucket: 'reward-images',
          storage_path: newPath,
          public_url: publicUrl,
          mime_type: 'image/webp',
          size_bytes: optimized.blob.size,
          width: optimized.width,
          height: optimized.height,
          content_hash: contentHash,
        };

        const { error: assetError } = currentAsset
          ? await supabase.from('reward_media_assets').update(payload).eq('id', currentAsset.id)
          : await supabase.from('reward_media_assets').insert(payload);
        if (assetError) {
          await supabase.storage.from('reward-images').remove([newPath]);
          throw assetError;
        }
        if (!currentAsset) {
          imported += 1;
          availableSlots -= 1;
        }
      }

      const rewardIds = relatedRewards.map((reward) => reward.id);
      const { error: updateError } = await supabase
        .from('fidelity_rewards')
        .update({ media_asset_id: assetId, image_url: publicUrl })
        .in('id', rewardIds);
      if (updateError) throw updateError;
      linked += rewardIds.length;

      if (currentAsset && duplicate && currentAsset.id !== duplicate.id) {
        const { error: deleteOldAssetError } = await supabase.from('reward_media_assets').delete().eq('id', currentAsset.id);
        if (deleteOldAssetError) throw deleteOldAssetError;
      }

      const newPath = storagePathFromUrl(publicUrl);
      if (oldPath && oldPath !== newPath) {
        try {
          await removeStorageObject('reward-images', oldPath);
        } catch (cleanupError) {
          console.warn('Imagem legada migrada, mas o arquivo antigo não pôde ser removido:', oldPath, cleanupError);
        }
      }
    } catch (error) {
      console.warn('Não foi possível migrar/relacionar imagem existente de prêmio:', url, error);
      skipped += relatedRewards.length;
    }
  }

  return { imported, linked, skipped };
}

export async function uploadRewardMediaAsset(storeId: string, file: File, name?: string): Promise<{ asset: RewardMediaAsset; reused: boolean }> {
  const optimized = await optimizeImage(file);
  const contentHash = await sha256(optimized.blob);

  const { data: existing, error: existingError } = await supabase
    .from('reward_media_assets')
    .select('*')
    .eq('store_id', storeId)
    .eq('content_hash', contentHash)
    .is('archived_at', null)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { asset: existing, reused: true };

  const { count, error: countError } = await supabase
    .from('reward_media_assets')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .is('archived_at', null);
  if (countError) throw countError;
  if ((count || 0) >= REWARD_MEDIA_LIBRARY_LIMIT) throw new Error(`A biblioteca atingiu o limite de ${REWARD_MEDIA_LIBRARY_LIMIT} imagens.`);

  const id = uuidv4();
  const storagePath = `${storeId}/library/${id}/image.webp`;
  const { error: uploadError } = await supabase.storage
    .from('reward-images')
    .upload(storagePath, optimized.blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage.from('reward-images').getPublicUrl(storagePath).data.publicUrl;
  const payload = {
    id,
    store_id: storeId,
    name: (name || file.name.replace(/\.[^.]+$/, '') || 'Imagem de prêmio').trim(),
    storage_bucket: 'reward-images',
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: 'image/webp',
    size_bytes: optimized.blob.size,
    width: optimized.width,
    height: optimized.height,
    content_hash: contentHash,
  };
  const { data: inserted, error: insertError } = await supabase.from('reward_media_assets').insert(payload).select('*').single();
  if (insertError) {
    await supabase.storage.from('reward-images').remove([storagePath]);
    throw insertError;
  }
  return { asset: inserted, reused: false };
}

export async function renameRewardMediaAsset(assetId: string, name: string): Promise<void> {
  const normalized = name.trim();
  if (!normalized) throw new Error('Informe um nome para a imagem.');
  const { error } = await supabase.from('reward_media_assets').update({ name: normalized }).eq('id', assetId);
  if (error) throw error;
}

export async function deleteRewardMediaAsset(asset: RewardMediaAsset): Promise<void> {
  const activeUsages = (asset.usages || []).filter((usage) => usage.status === 'active');
  if (activeUsages.length > 0) throw new Error(`Esta imagem está vinculada a ${activeUsages.length} prêmio(s) ativo(s).`);

  const { data, error } = await supabase.rpc('delete_reward_media_asset_atomic', { p_asset_id: asset.id });
  if (error) throw error;
  const removedAsset = data?.[0] as { storage_bucket?: string; storage_path?: string } | undefined;
  const bucket = removedAsset?.storage_bucket || asset.storage_bucket;
  const path = removedAsset?.storage_path || asset.storage_path;
  await removeStorageObject(bucket, path);

  window.setTimeout(() => window.location.reload(), 250);
}

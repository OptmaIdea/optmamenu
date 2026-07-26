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

async function sha256(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

async function optimizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
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
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao converter imagem.')), 'image/webp', 0.82);
  });
  return { blob, width, height };
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

  const { data: programs, error: programsError } = await supabase
    .from('fidelity_programs')
    .select('id')
    .eq('store_id', storeId);
  if (programsError) throw programsError;
  const programIds = (programs || []).map((program) => program.id);
  if (programIds.length === 0) return { imported: 0, linked: 0, skipped: 0 };

  const { data: rewards, error: rewardsError } = await supabase
    .from('fidelity_rewards')
    .select('id, title, image_url, media_asset_id, product_id')
    .in('program_id', programIds)
    .is('media_asset_id', null)
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
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const contentHash = await sha256(blob);

      const { data: existing, error: existingError } = await supabase
        .from('reward_media_assets')
        .select('*')
        .eq('store_id', storeId)
        .eq('content_hash', contentHash)
        .is('archived_at', null)
        .maybeSingle();
      if (existingError) throw existingError;

      let assetId = existing?.id as string | undefined;
      if (!assetId) {
        if (availableSlots <= 0) {
          skipped += relatedRewards.length;
          continue;
        }
        const size = await dimensions(blob);
        const storagePath = decodeURIComponent(url.split('/reward-images/')[1].split('?')[0]);
        const id = uuidv4();
        const payload = {
          id,
          store_id: storeId,
          name: relatedRewards[0]?.title?.trim() || 'Imagem de prêmio',
          description: 'Imagem relacionada automaticamente a partir de prêmio existente.',
          storage_bucket: 'reward-images',
          storage_path: storagePath,
          public_url: url,
          mime_type: blob.type || 'image/webp',
          size_bytes: blob.size,
          width: size.width,
          height: size.height,
          content_hash: contentHash,
        };
        const { data: inserted, error: insertError } = await supabase
          .from('reward_media_assets')
          .insert(payload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        assetId = inserted.id;
        imported += 1;
        availableSlots -= 1;
      }

      const ids = relatedRewards.map((reward) => reward.id);
      const { error: updateError } = await supabase
        .from('fidelity_rewards')
        .update({ media_asset_id: assetId })
        .in('id', ids);
      if (updateError) throw updateError;
      linked += ids.length;
    } catch (error) {
      console.warn('Não foi possível relacionar imagem existente de prêmio:', url, error);
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
  if ((count || 0) >= REWARD_MEDIA_LIBRARY_LIMIT) {
    throw new Error(`A biblioteca atingiu o limite de ${REWARD_MEDIA_LIBRARY_LIMIT} imagens.`);
  }

  const id = uuidv4();
  const storagePath = `${storeId}/library/${id}/image.webp`;
  const { error: uploadError } = await supabase.storage
    .from('reward-images')
    .upload(storagePath, optimized.blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from('reward-images').getPublicUrl(storagePath);
  const payload = {
    id,
    store_id: storeId,
    name: (name || file.name.replace(/\.[^.]+$/, '') || 'Imagem de prêmio').trim(),
    storage_bucket: 'reward-images',
    storage_path: storagePath,
    public_url: publicData.publicUrl,
    mime_type: 'image/webp',
    size_bytes: optimized.blob.size,
    width: optimized.width,
    height: optimized.height,
    content_hash: contentHash,
  };
  const { data: inserted, error: insertError } = await supabase
    .from('reward_media_assets')
    .insert(payload)
    .select('*')
    .single();
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
  if (activeUsages.length > 0) {
    throw new Error(`Esta imagem está vinculada a ${activeUsages.length} prêmio(s) ativo(s).`);
  }

  if ((asset.usages || []).length > 0) {
    const { error: detachError } = await supabase
      .from('fidelity_rewards')
      .update({ media_asset_id: null, image_url: null })
      .eq('media_asset_id', asset.id);
    if (detachError) throw detachError;
  }

  const { error: deleteError } = await supabase.from('reward_media_assets').delete().eq('id', asset.id);
  if (deleteError) throw deleteError;
  const { error: storageError } = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  if (storageError) throw storageError;
}

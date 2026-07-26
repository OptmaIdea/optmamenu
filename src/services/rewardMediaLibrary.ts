import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

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
}

async function sha256(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
  const usage = new Map<string, number>();
  if (ids.length > 0) {
    const { data: rewards, error: rewardsError } = await supabase
      .from('fidelity_rewards')
      .select('media_asset_id')
      .in('media_asset_id', ids);
    if (rewardsError) throw rewardsError;
    for (const reward of rewards || []) {
      if (!reward.media_asset_id) continue;
      usage.set(reward.media_asset_id, (usage.get(reward.media_asset_id) || 0) + 1);
    }
  }

  return (assets || []).map((asset) => ({ ...asset, usage_count: usage.get(asset.id) || 0 }));
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
  if ((asset.usage_count || 0) > 0) throw new Error(`Esta imagem é utilizada por ${asset.usage_count} prêmio(s).`);
  const { error: deleteError } = await supabase.from('reward_media_assets').delete().eq('id', asset.id);
  if (deleteError) throw deleteError;
  const { error: storageError } = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  if (storageError) throw storageError;
}

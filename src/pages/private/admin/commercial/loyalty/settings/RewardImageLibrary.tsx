import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, ImagePlus, Loader, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { applyImageFallback } from '@/lib/imageFallbacks';
import {
  deleteRewardMediaAsset,
  listRewardMediaAssets,
  renameRewardMediaAsset,
  REWARD_MEDIA_LIBRARY_LIMIT,
  syncExistingRewardMediaAssets,
  uploadRewardMediaAsset,
  type RewardMediaAsset,
  type RewardMediaUsage,
} from '@/services/rewardMediaLibrary';

interface RewardImageLibraryProps {
  storeId: string;
  open: boolean;
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: RewardMediaAsset) => void;
  onClose: () => void;
}

const usageLabel = (usage: RewardMediaUsage) => {
  if (usage.status === 'active') return 'ativo';
  if (usage.status === 'expired') return 'expirado';
  return 'inativo';
};

export default function RewardImageLibrary({ storeId, open, selectable = false, selectedId, onSelect, onClose }: RewardImageLibraryProps) {
  const [assets, setAssets] = useState<RewardMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [previewAsset, setPreviewAsset] = useState<RewardMediaAsset | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setAssets(await listRewardMediaAssets(storeId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar biblioteca.');
    } finally {
      setLoading(false);
    }
  };

  const syncExisting = async () => {
    setSyncing(true);
    try {
      const result = await syncExistingRewardMediaAssets(storeId);
      await load();
      if (result.imported > 0 || result.linked > 0) {
        toast.success(`${result.imported} imagem(ns) relacionada(s) e ${result.linked} prêmio(s) vinculado(s).`);
      }
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} vínculo(s) não puderam ser importados. Verifique o limite ou a origem da imagem.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao relacionar imagens existentes.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (open) void syncExisting();
  }, [open, storeId]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? assets.filter((asset) => asset.name.toLowerCase().includes(value) || (asset.usages || []).some((usage) => usage.title.toLowerCase().includes(value)))
      : assets;
  }, [assets, query]);

  const atLimit = assets.length >= REWARD_MEDIA_LIBRARY_LIMIT;

  const handleUpload = async (file?: File) => {
    if (!file) return;
    if (atLimit) {
      toast.error(`A biblioteca atingiu o limite de ${REWARD_MEDIA_LIBRARY_LIMIT} imagens.`);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadRewardMediaAsset(storeId, file);
      toast.success(result.reused ? 'Imagem já existente; o item da biblioteca foi reutilizado.' : 'Imagem adicionada à biblioteca.');
      await load();
      if (selectable && onSelect) onSelect(result.asset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleRename = async (asset: RewardMediaAsset) => {
    try {
      await renameRewardMediaAsset(asset.id, editingName);
      setEditingId(null);
      await load();
      toast.success('Imagem renomeada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao renomear imagem.');
    }
  };

  const handleDelete = async (asset: RewardMediaAsset) => {
    const usages = asset.usages || [];
    const activeUsages = usages.filter((usage) => usage.status === 'active');
    if (activeUsages.length > 0) {
      toast.error(`Exclusão bloqueada. Em uso por: ${activeUsages.map((usage) => usage.title).join(', ')}.`);
      return;
    }

    if (usages.length > 0) {
      const details = usages.map((usage) => `${usage.title} (${usageLabel(usage)})`).join(', ');
      if (!confirm(`Esta imagem está vinculada apenas a prêmio(s) expirado(s) ou inativo(s): ${details}. Ao excluir, esses prêmios passarão a usar a imagem padrão. Deseja continuar?`)) return;
    } else if (!confirm(`Excluir “${asset.name}” da biblioteca e do Storage?`)) {
      return;
    }

    try {
      await deleteRewardMediaAsset(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
      toast.success('Imagem excluída.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir imagem.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Biblioteca de imagens de prêmios">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Biblioteca de imagens</h2>
            <p className="text-xs text-gray-500">Envie uma vez, reutilize em vários prêmios e acompanhe onde cada imagem está sendo usada.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por imagem ou prêmio..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
          <div className="flex items-center justify-center rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-500 dark:border-gray-700">
            {assets.length}/{REWARD_MEDIA_LIBRARY_LIMIT} imagens
          </div>
          <button type="button" onClick={() => void syncExisting()} disabled={syncing} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            {syncing ? <Loader className="animate-spin" size={16} /> : <ImagePlus size={16} />}
            Relacionar existentes
          </button>
          <label className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white ${atLimit ? 'cursor-not-allowed bg-gray-400' : 'cursor-pointer bg-brand-green hover:bg-green-600'}`}>
            {uploading ? <Loader className="animate-spin" size={16} /> : <ImagePlus size={16} />}
            Adicionar imagem
            <input type="file" accept="image/*" className="hidden" disabled={uploading || atLimit} onChange={(event) => void handleUpload(event.target.files?.[0])} />
          </label>
        </div>

        {atLimit && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle size={14} /> Limite atual atingido. Essa quantidade será futuramente controlada pelo plano contratado.
          </div>
        )}

        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader className="animate-spin text-brand-green" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400 dark:border-gray-700">Nenhuma imagem encontrada.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((asset) => {
                const usages = asset.usages || [];
                const activeCount = usages.filter((usage) => usage.status === 'active').length;
                return (
                  <div key={asset.id} className={`overflow-hidden rounded-xl border bg-white dark:bg-gray-800 ${selectedId === asset.id ? 'border-brand-green ring-2 ring-brand-green/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-700">
                      <button type="button" disabled={!selectable} onClick={() => onSelect?.(asset)} className="block h-full w-full disabled:cursor-default">
                        <img src={asset.public_url} onError={(event) => applyImageFallback(event, 'reward')} alt={asset.name} className="h-full w-full object-cover" />
                      </button>
                      <button type="button" onClick={() => setPreviewAsset(asset)} className="absolute bottom-2 right-2 rounded-full bg-black/65 p-2 text-white hover:bg-black/80" title="Ampliar"><Eye size={15} /></button>
                      {selectedId === asset.id && <span className="absolute right-2 top-2 rounded-full bg-brand-green p-1 text-white"><Check size={14} /></span>}
                    </div>
                    <div className="space-y-2 p-3">
                      {editingId === asset.id ? (
                        <div className="flex gap-2">
                          <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                          <button onClick={() => void handleRename(asset)} className="rounded-lg bg-brand-green p-2 text-white"><Check size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{asset.name}</p>
                            <p className="text-[11px] text-gray-500">{asset.width}×{asset.height} · {(asset.size_bytes / 1024).toFixed(1)} KB · {usages.length} uso(s)</p>
                          </div>
                          <div className="flex shrink-0">
                            <button onClick={() => { setEditingId(asset.id); setEditingName(asset.name); }} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Renomear"><Pencil size={14} /></button>
                            <button onClick={() => void handleDelete(asset)} disabled={activeCount > 0} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30" title={activeCount > 0 ? 'Imagem vinculada a prêmio ativo' : 'Excluir'}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg bg-gray-50 px-2 py-2 text-[11px] text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                        {usages.length === 0 ? 'Ainda não utilizada em nenhum prêmio.' : (
                          <>
                            <span className="font-bold">Utilizada em:</span>{' '}
                            {usages.slice(0, 3).map((usage) => `${usage.title} (${usageLabel(usage)})`).join(', ')}
                            {usages.length > 3 ? ` e mais ${usages.length - 3}` : ''}.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6" onClick={() => setPreviewAsset(null)}>
          <div className="max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{previewAsset.name}</h3>
                <p className="text-xs text-gray-500">{previewAsset.width}×{previewAsset.height} · {(previewAsset.size_bytes / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            <img src={previewAsset.public_url} onError={(event) => applyImageFallback(event, 'reward')} alt={previewAsset.name} className="max-h-[70vh] w-full object-contain" />
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
              {(previewAsset.usages || []).length === 0
                ? 'Esta imagem ainda não está vinculada a nenhum prêmio.'
                : `Utilizada em: ${(previewAsset.usages || []).map((usage) => `${usage.title} (${usageLabel(usage)})`).join(', ')}.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

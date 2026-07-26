import { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, Loader, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { applyImageFallback } from '@/lib/imageFallbacks';
import {
  deleteRewardMediaAsset,
  listRewardMediaAssets,
  renameRewardMediaAsset,
  uploadRewardMediaAsset,
  type RewardMediaAsset,
} from '@/services/rewardMediaLibrary';

interface RewardImageLibraryProps {
  storeId: string;
  open: boolean;
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: RewardMediaAsset) => void;
  onClose: () => void;
}

export default function RewardImageLibrary({ storeId, open, selectable = false, selectedId, onSelect, onClose }: RewardImageLibraryProps) {
  const [assets, setAssets] = useState<RewardMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  useEffect(() => {
    if (open) void load();
  }, [open, storeId]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? assets.filter((asset) => asset.name.toLowerCase().includes(value)) : assets;
  }, [assets, query]);

  const handleUpload = async (file?: File) => {
    if (!file) return;
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
    if ((asset.usage_count || 0) > 0) {
      toast.error(`Esta imagem é utilizada por ${asset.usage_count} prêmio(s).`);
      return;
    }
    if (!confirm(`Excluir “${asset.name}” da biblioteca e do Storage?`)) return;
    try {
      await deleteRewardMediaAsset(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
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
            <p className="text-xs text-gray-500">Envie uma vez, reutilize em vários prêmios e exclua somente quando não houver uso.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pelo nome..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2 text-sm font-bold text-white hover:bg-green-600">
            {uploading ? <Loader className="animate-spin" size={16} /> : <ImagePlus size={16} />}
            Adicionar imagem
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => void handleUpload(event.target.files?.[0])} />
          </label>
        </div>

        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader className="animate-spin text-brand-green" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400 dark:border-gray-700">Nenhuma imagem encontrada.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((asset) => (
                <div key={asset.id} className={`overflow-hidden rounded-xl border bg-white dark:bg-gray-800 ${selectedId === asset.id ? 'border-brand-green ring-2 ring-brand-green/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <button type="button" disabled={!selectable} onClick={() => onSelect?.(asset)} className="relative block aspect-video w-full bg-gray-100 disabled:cursor-default dark:bg-gray-700">
                    <img src={asset.public_url} onError={(event) => applyImageFallback(event, 'reward')} alt={asset.name} className="h-full w-full object-cover" />
                    {selectedId === asset.id && <span className="absolute right-2 top-2 rounded-full bg-brand-green p-1 text-white"><Check size={14} /></span>}
                  </button>
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
                          <p className="text-[11px] text-gray-500">{asset.width}×{asset.height} · {(asset.size_bytes / 1024).toFixed(1)} KB · {asset.usage_count || 0} uso(s)</p>
                        </div>
                        <div className="flex shrink-0">
                          <button onClick={() => { setEditingId(asset.id); setEditingName(asset.name); }} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="Renomear"><Pencil size={14} /></button>
                          <button onClick={() => void handleDelete(asset)} disabled={(asset.usage_count || 0) > 0} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30" title={(asset.usage_count || 0) > 0 ? 'Imagem em uso' : 'Excluir'}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

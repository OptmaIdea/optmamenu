import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, Loader2, Sparkles } from 'lucide-react';
import {
  optimizeImageForUpload,
  revokeImagePreview,
  formatFileSize,
  IMAGE_PROFILES,
  type OptimizedImageResult,
} from '@/utils/imageOptimization';
import { toast } from 'sonner';

export type ImageUploadFieldProps = {
  value?: string | null;
  profile?: keyof typeof IMAGE_PROFILES;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  onOptimizedFile: (result: OptimizedImageResult | null) => void;
  className?: string;
};

export default function ImageUploadField({
  value,
  profile = 'product',
  disabled = false,
  label = 'Imagem',
  helperText,
  onOptimizedFile,
  className = '',
}: ImageUploadFieldProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    originalSize: string;
    optimizedSize: string;
    compressionRatio: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createdUrlRef = useRef<string | null>(null);

  // Limpa URLs temporárias ao desmontar
  useEffect(() => {
    return () => {
      if (createdUrlRef.current) {
        revokeImagePreview(createdUrlRef.current);
      }
    };
  }, []);

  const handleProcessFile = async (file: File) => {
    try {
      setOptimizing(true);
      const profileConfig = IMAGE_PROFILES[profile] ?? IMAGE_PROFILES.product;

      const result = await optimizeImageForUpload(file, profileConfig);

      // Descarte da URL antiga se já havia sido criada neste componente
      if (createdUrlRef.current) {
        revokeImagePreview(createdUrlRef.current);
      }

      const newPreviewUrl = URL.createObjectURL(result.blob);
      createdUrlRef.current = newPreviewUrl;

      setPreviewUrl(newPreviewUrl);
      setStats({
        originalSize: formatFileSize(result.originalSize),
        optimizedSize: formatFileSize(result.optimizedSize),
        compressionRatio: result.compressionRatio,
      });

      onOptimizedFile(result);
    } catch (err: any) {
      console.error('[ImageUploadField] Erro no processamento:', err);
      toast.error(err?.message || 'Não foi possível processar esta imagem. Tente outra imagem JPG, PNG ou WebP.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !optimizing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || optimizing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleClear = () => {
    if (disabled || optimizing) return;

    if (createdUrlRef.current) {
      revokeImagePreview(createdUrlRef.current);
      createdUrlRef.current = null;
    }

    setPreviewUrl(null);
    setStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOptimizedFile(null);
  };

  const activeDisplayUrl = previewUrl || value;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-200">
          {label}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || optimizing}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !optimizing && fileInputRef.current?.click()}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-4 text-center transition-all ${
          isDragging
            ? 'border-[#19A999] bg-[#19A999]/10'
            : activeDisplayUrl
            ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'
            : 'border-gray-300 hover:border-[#19A999] bg-white dark:border-gray-700 dark:bg-gray-800'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {optimizing ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#19A999]" />
            <p className="text-xs font-black text-gray-700 dark:text-gray-200">Otimizando imagem...</p>
            <p className="text-[11px] font-medium text-gray-400">Convertendo para WebP e redimensionando...</p>
          </div>
        ) : activeDisplayUrl ? (
          <div className="group relative flex w-full flex-col items-center justify-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xs">
              <img
                src={activeDisplayUrl}
                alt="Preview da imagem"
                className="h-full w-full object-contain p-1"
              />
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              disabled={disabled}
              className="absolute -top-2 -right-2 rounded-full bg-rose-500 p-1.5 text-white shadow-md hover:bg-rose-600 transition"
              title="Remover imagem"
            >
              <X size={14} />
            </button>

            {stats && (
              <div className="mt-3 flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Sparkles size={12} />
                <span>
                  Otimizado de {stats.originalSize} para {stats.optimizedSize} ({stats.compressionRatio > 0 ? `-${stats.compressionRatio}%` : 'WebP'})
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div className="rounded-2xl bg-teal-50 p-3 dark:bg-teal-950/40 text-[#19A999]">
              <Upload size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-gray-900 dark:text-white">
                Clique para selecionar ou arraste aqui
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400 font-medium">
                Arquivos JPG, PNG ou WebP de até 10 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
}

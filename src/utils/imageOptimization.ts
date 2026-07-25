import { createClientUuid } from './clientUuid';

export type ImageOptimizationOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxOriginalBytes?: number;
  outputType?: 'image/webp';
};

export type OptimizedImageResult = {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  mimeType: string;
  extension: 'webp';
};

export const IMAGE_UPLOAD_DEFAULTS = {
  maxOriginalBytes: 10 * 1024 * 1024, // 10 MB (suporta fotos de câmeras nativas sem travar a memória do browser)
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.82,
  outputType: 'image/webp',
} as const;

export const IMAGE_PROFILES = {
  product: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.82,
  },
  category: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.82,
  },
  avatar: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.82,
  },
  logo: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.9,
  },
  banner: {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.82,
  },
} as const;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Valida o formato e o tamanho do arquivo de imagem antes do processamento.
 */
export function validateImageFile(file: File, maxOriginalBytes = IMAGE_UPLOAD_DEFAULTS.maxOriginalBytes): void {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado.');
  }

  // Validação de tamanho
  if (file.size > maxOriginalBytes) {
    const maxMb = (maxOriginalBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`A imagem selecionada é muito grande. Escolha um arquivo de até ${maxMb} MB.`);
  }

  // Validação de MIME Type e extensão
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type);

  if (!hasValidMime && !hasValidExt) {
    throw new Error('Este formato de imagem não é compatível. Envie uma imagem JPG, PNG ou WebP.');
  }
}

/**
 * Calcula dimensões proporcionais de destino sem ampliar imagens menores.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: Math.max(1, maxWidth), height: Math.max(1, maxHeight) };
  }

  // Se a imagem já for menor ou igual aos limites, preserva as dimensões originais (sem upscale)
  if (origWidth <= maxWidth && origHeight <= maxHeight) {
    return { width: origWidth, height: origHeight };
  }

  const widthRatio = maxWidth / origWidth;
  const heightRatio = maxHeight / origHeight;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.max(1, Math.round(origWidth * ratio)),
    height: Math.max(1, Math.round(origHeight * ratio)),
  };
}

/**
 * Gera um nome seguro de arquivo utilizando UUID aleatório v4.
 */
export function createSafeImageFilename(_originalName?: string, prefix = 'img'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const uuid = createClientUuid();
  return `${cleanPrefix}_${uuid}.webp`;
}

/**
 * Formata o tamanho em bytes para exibição amigável em KB ou MB (pt-BR).
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`.replace('.', ',');
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`.replace('.', ',');
}

/**
 * Revoga uma URL de preview criada por URL.createObjectURL para evitar vazamento de memória.
 */
export function revokeImagePreview(url?: string | null): void {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignora erros de revogação
    }
  }
}

/**
 * Carrega a fonte da imagem como ImageBitmap ou HTMLImageElement para renderização em Canvas.
 */
async function loadImageSource(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback para HTMLImageElement se o createImageBitmap falhar
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível processar esta imagem. Tente outra imagem JPG, PNG ou WebP.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Função principal do pipeline frontend que valida, redimensiona,
 * converte para WebP e empacota o arquivo final otimizado.
 */
export async function optimizeImageForUpload(
  file: File,
  options?: ImageOptimizationOptions
): Promise<OptimizedImageResult> {
  const maxOriginalBytes = options?.maxOriginalBytes ?? IMAGE_UPLOAD_DEFAULTS.maxOriginalBytes;
  validateImageFile(file, maxOriginalBytes);

  const maxWidth = options?.maxWidth ?? IMAGE_UPLOAD_DEFAULTS.maxWidth;
  const maxHeight = options?.maxHeight ?? IMAGE_UPLOAD_DEFAULTS.maxHeight;
  const quality = options?.quality ?? IMAGE_UPLOAD_DEFAULTS.quality;

  const { source, width: origWidth, height: origHeight, cleanup } = await loadImageSource(file);

  try {
    if (origWidth <= 0 || origHeight <= 0) {
      throw new Error('A imagem selecionada possui dimensões inválidas.');
    }

    const target = calculateTargetDimensions(origWidth, origHeight, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Não foi possível inicializar o contexto gráfico para otimização da imagem.');
    }

    // Limpa o canvas para garantir preservação da transparência (Alpha) em PNGs/WebPs
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(source, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b && b.size > 0) {
            resolve(b);
          } else {
            reject(new Error('Falha ao gerar o arquivo de imagem otimizado.'));
          }
        },
        'image/webp',
        quality
      );
    });

    const safeName = createSafeImageFilename(file.name);
    const optimizedFile = new File([blob], safeName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    const originalSize = file.size;
    const optimizedSize = blob.size;
    const compressionRatio = originalSize > 0 ? Number(((1 - optimizedSize / originalSize) * 100).toFixed(1)) : 0;

    return {
      file: optimizedFile,
      blob,
      width: target.width,
      height: target.height,
      originalWidth: origWidth,
      originalHeight: origHeight,
      originalSize,
      optimizedSize,
      compressionRatio,
      mimeType: 'image/webp',
      extension: 'webp',
    };
  } finally {
    cleanup();
  }
}

import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, Star, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { FormMediaItem } from '../types/productForm.types';

interface ImagesSectionProps {
  mediaItems: FormMediaItem[];
  onProcessFiles: (files: FileList) => void;
  onRemoveMedia: (id: string) => void;
  onSetMainMedia: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
}

export const ImagesSection: React.FC<ImagesSectionProps> = ({
  mediaItems,
  onProcessFiles,
  onRemoveMedia,
  onSetMainMedia,
  onReorder,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputId = 'product-form-image-input';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onProcessFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onProcessFiles(e.target.files);
    }
  };

  const getItemSrc = (item: FormMediaItem): string => {
    if (item.type === 'file' && item.preview) return item.preview;
    return item.value as string;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#19A999]/10 rounded-lg">
            <ImageIcon size={18} className="text-[#19A999]" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Imagens do Produto</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adicione até 4 imagens. A primeira imagem é usada como capa oficial.
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-lg">
          {mediaItems.length} / 4 imagens
        </span>
      </div>

      {/* Zona de Drop / Upload */}
      {mediaItems.length < 4 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById(inputId)?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDraggingOver
              ? 'border-[#19A999] bg-[#19A999]/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-[#19A999] hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <input
            id={inputId}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-12 h-12 bg-[#19A999]/10 rounded-full flex items-center justify-center text-[#19A999] mb-2">
            <UploadCloud size={24} />
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Clique para selecionar ou arraste imagens aqui
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            As imagens são otimizadas automaticamente em formato WebP de alta velocidade.
          </p>
        </div>
      )}

      {/* Galeria de Imagens Selecionadas */}
      {mediaItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {mediaItems.map((item, idx) => {
            const isMain = idx === 0;
            const src = getItemSrc(item);

            return (
              <div
                key={item.id}
                className={`relative group rounded-xl border overflow-hidden bg-gray-50 dark:bg-gray-900 transition-all ${
                  isMain
                    ? 'border-[#19A999] ring-2 ring-[#19A999]/30 shadow-md'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Visualização de Imagem */}
                <div className="h-40 w-full flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-950">
                  <img
                    src={src}
                    alt={`Imagem do produto ${idx + 1}`}
                    className="max-h-full max-w-full object-contain rounded-lg"
                  />
                </div>

                {/* Badge da Imagem Capa */}
                {isMain && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-[#19A999] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                    <Star size={10} className="fill-white" />
                    Capa Principal
                  </span>
                )}

                {/* Barra de Ações do Item */}
                <div className="p-2 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-1">
                  {!isMain && (
                    <button
                      type="button"
                      onClick={() => onSetMainMedia(idx)}
                      className="text-[11px] font-semibold text-[#19A999] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Star size={12} />
                      Tornar Capa
                    </button>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => onReorder(idx, idx - 1)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition cursor-pointer"
                        title="Mover para esquerda/cima"
                      >
                        <ArrowUp size={14} />
                      </button>
                    )}
                    {idx < mediaItems.length - 1 && (
                      <button
                        type="button"
                        onClick={() => onReorder(idx, idx + 1)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition cursor-pointer"
                        title="Mover para direita/baixo"
                      >
                        <ArrowDown size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveMedia(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition cursor-pointer"
                      title="Remover imagem"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mediaItems.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 italic">
          Nenhuma imagem cadastrada ainda.
        </p>
      )}
    </div>
  );
};

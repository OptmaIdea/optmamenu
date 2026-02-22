import { X, UploadCloud, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    restrictToVerticalAxis,
    restrictToParentElement,
} from '@dnd-kit/modifiers';
import { SortableThumb } from '@/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb';
import type { MediaItem } from '@/pages/private/admin/products/products/hooks/useProductImages';

interface ImageSectionProps {
    mediaItems: MediaItem[];
    isDragging: boolean;
    currentImageIndex: number;
    hasMultipleImages: boolean;
    name: string;
    onClose: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveMedia: (id: string) => void;
    onSetMainMedia: (index: number) => void;
    onNextImage: () => void;
    onPrevImage: () => void;
    onDragEnd: (event: DragEndEvent) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    setCurrentImageIndex: (index: number) => void;
    sensors: ReturnType<typeof useSensors>;
}

export const ImageSection = ({
    mediaItems,
    isDragging,
    currentImageIndex,
    hasMultipleImages,
    name,
    onClose,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelect,
    onRemoveMedia,
    onSetMainMedia,
    onNextImage,
    onPrevImage,
    onDragEnd,
    onMoveUp,
    onMoveDown,
    setCurrentImageIndex,
    sensors,
}: ImageSectionProps) => {
    return (
        <div className="w-full md:w-2/5 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col items-center justify-start relative overflow-y-auto">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10 md:hidden"
            >
                <X size={20} className="text-gray-700 dark:text-gray-300" />
            </button>

            {mediaItems.length === 0 ? (
                <div
                    className={`w-full flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 mb-4 transition-all ${isDragging
                        ? 'border-[#21A896] bg-[#21A896]/5'
                        : 'border-gray-300 dark:border-gray-600 hover:border-[#21A896]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => document.getElementById('edit-media-upload')?.click()}
                >
                    <input
                        id="edit-media-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={onFileSelect}
                    />
                    <div className="w-16 h-16 bg-[#21A896]/10 rounded-full flex items-center justify-center mb-4 text-[#21A896]">
                        <UploadCloud size={32} />
                    </div>
                    <p className="font-medium text-gray-700 dark:text-gray-200 mb-1 text-center">
                        Clique para fazer upload
                    </p>
                    <p className="text-sm text-gray-500 text-center">
                        ou arraste suas imagens aqui
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        Máximo 4 imagens
                    </p>
                </div>
            ) : (
                <>
                    <div className="relative w-full flex-1 flex items-center justify-center mb-4">
                        <img
                            src={
                                mediaItems[currentImageIndex]?.type === 'file'
                                    ? mediaItems[currentImageIndex]?.preview
                                    : (mediaItems[currentImageIndex]?.value as string)
                            }
                            alt={name || 'Produto'}
                            className="max-h-64 md:max-h-80 object-contain rounded-lg"
                        />
                        {hasMultipleImages && (
                            <>
                                <button
                                    onClick={onPrevImage}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <ChevronLeft size={20} className="text-gray-700 dark:text-gray-300" />
                                </button>
                                <button
                                    onClick={onNextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <ChevronRight size={20} className="text-gray-700 dark:text-gray-300" />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="w-full">
                        {mediaItems.length > 0 && (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={onDragEnd}
                                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                            >
                                <SortableContext
                                    items={mediaItems.map(item => item.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {mediaItems.map((item, idx) => (
                                            <SortableThumb
                                                key={item.id}
                                                item={item}
                                                index={idx}
                                                currentImageIndex={currentImageIndex}
                                                setCurrentImageIndex={setCurrentImageIndex}
                                                removeMedia={onRemoveMedia}
                                                setMainMedia={onSetMainMedia}
                                                moveUp={onMoveUp}
                                                moveDown={onMoveDown}
                                                isFirst={idx === 0}
                                                isLast={idx === mediaItems.length - 1}
                                            />
                                        ))}
                                        {mediaItems.length < 4 && (
                                            <button
                                                onClick={() => document.getElementById('edit-media-upload')?.click()}
                                                className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-[#21A896] hover:bg-[#21A896]/5 transition-colors"
                                            >
                                                <UploadCloud size={20} className="text-gray-500" />
                                            </button>
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                        <input
                            id="edit-media-upload"
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={onFileSelect}
                        />
                    </div>
                </>
            )}
        </div>
    );
};
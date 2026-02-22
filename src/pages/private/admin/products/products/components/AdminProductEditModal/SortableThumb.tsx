import { X as XIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MediaItem } from '@/pages/private/admin/products/products/hooks/useProductImages';

interface SortableThumbProps {
    item: MediaItem;
    index: number;
    currentImageIndex: number;
    setCurrentImageIndex: (index: number) => void;
    removeMedia: (id: string) => void;
    setMainMedia: (index: number) => void;
    moveUp: (index: number) => void;
    moveDown: (index: number) => void;
    isFirst: boolean;
    isLast: boolean;
}

export const SortableThumb = ({
    item,
    index,
    currentImageIndex,
    setCurrentImageIndex,
    removeMedia,
    setMainMedia,
    moveUp,
    moveDown,
    isFirst,
    isLast,
}: SortableThumbProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative flex-shrink-0 group"
        >
            <button
                onClick={() => setCurrentImageIndex(index)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === index
                        ? 'border-[#21A896] opacity-100 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
            >
                <img
                    src={item.type === 'file' ? item.preview : (item.value as string)}
                    alt=""
                    className="w-full h-full object-cover"
                />
            </button>

            <button
                onClick={() => removeMedia(item.id)}
                className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remover imagem"
            >
                <XIcon size={10} />
            </button>

            <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isFirst && (
                    <button
                        onClick={() => moveUp(index)}
                        className="p-1 bg-gray-800/70 text-white rounded-full hover:bg-gray-900 shadow-md"
                        title="Mover para cima"
                    >
                        <ChevronUp size={12} />
                    </button>
                )}
                {!isLast && (
                    <button
                        onClick={() => moveDown(index)}
                        className="p-1 bg-gray-800/70 text-white rounded-full hover:bg-gray-900 shadow-md"
                        title="Mover para baixo"
                    >
                        <ChevronDown size={12} />
                    </button>
                )}
            </div>

            {index !== 0 && (
                <button
                    onClick={() => setMainMedia(index)}
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#21A896] text-white text-[8px] font-bold rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    title="Definir como imagem principal"
                >
                    ★ CAPA
                </button>
            )}

            {index === 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-[#21A896] text-white text-[8px] font-bold rounded shadow-md whitespace-nowrap">
                    CAPA
                </span>
            )}
        </div>
    );
};
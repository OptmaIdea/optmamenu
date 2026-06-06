import { X } from 'lucide-react';

interface AdditionalInfo {
    id: string;
    title: string;
    text: string;
    sensitive: boolean;
    created_at?: string;
    isNew?: boolean;
}

interface InfoCardProps {
    item: AdditionalInfo;
    index: number;
    onUpdate: (index: number, field: keyof AdditionalInfo, value: string | boolean) => void;
    onRemove: (index: number) => void;
    onRemoveRequest?: (index: number) => void;
}

export function InfoCard({ item, index, onUpdate, onRemove, onRemoveRequest }: InfoCardProps) {
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 relative">
            {/* Badge Sensível */}
            {item.sensitive && (
                <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Sensível
                    </span>
                </div>
            )}

            {/* Botão de Remover ou Solicitar Remoção */}
            {item.isNew ? (
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute top-2 left-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remover informação"
                >
                    <X size={16} />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onRemoveRequest?.(index)}
                    className="absolute top-2 left-2 text-xs font-semibold text-gray-400 hover:text-orange-500 transition-colors"
                    title="Solicitar remoção da informação"
                >
                    Solicitar remoção
                </button>
            )}

            {/* Campos */}
            <div className="space-y-3 pt-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Título
                    </label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500"
                        value={item.title}
                        disabled={!item.isNew}
                        onChange={(e) => onUpdate(index, 'title', e.target.value)}
                        placeholder="Ex: Alergias"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Descrição
                    </label>
                    <textarea
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#21A896] outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition resize-none"
                        rows={3}
                        value={item.text}
                        onChange={(e) => onUpdate(index, 'text', e.target.value)}
                        placeholder="Ex: Alérgico a amendoim e lactose"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id={`sensitive-${index}`}
                        checked={item.sensitive}
                        onChange={(e) => onUpdate(index, 'sensitive', e.target.checked)}
                        className="rounded border-gray-300 text-[#21A896] focus:ring-[#21A896]"
                    />
                    <label htmlFor={`sensitive-${index}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Marcar como informação sensível
                    </label>
                </div>
            </div>
        </div>
    );
}
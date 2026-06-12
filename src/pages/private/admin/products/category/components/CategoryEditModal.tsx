import { useState, useEffect } from 'react';
import { X, Package, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { Category } from '../types/category.types';
import { useCategoryForm } from '@/pages/private/admin/products/category/hooks/useCategoryForm';
import { useCategorySave } from '@/pages/private/admin/products/category/hooks/useCategorySave';
import CategoryFormFields from '@/pages/private/admin/products/category/components/CategoryFormFields';

interface CategoryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    category?: Category | null;
    storeId: string;
    onSuccess: () => void;
    canManage?: boolean;
}

export default function CategoryEditModal({
    isOpen,
    onClose,
    category,
    storeId: _storeId,
    onSuccess,
    canManage = true,
}: CategoryEditModalProps) {
    const isEditing = !!category;
    const categoryId = category?.id || uuidv4();

    const form = useCategoryForm(category);
    const { saving, handleSave } = useCategorySave();

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [localActive, setLocalActive] = useState(form.active);

    // Atualiza estado local quando o formulário carrega
    useEffect(() => {
        setLocalActive(form.active);
    }, [form.active]);

    useEffect(() => {
        if (isOpen) {
            if (isEditing && category) {
                form.loadCategory(category);
                setLocalActive(category.active);
            } else {
                form.resetForm();
                setLocalActive(true);
            }
            setImageFile(null);
        }
    }, [isOpen, category]);

    const handleActiveToggle = (value: boolean) => {
        // 🚫 Impedir inativação se houver produtos vinculados
        if (!value && (category?.products_count ?? 0) > 0) {
            toast.error('Não é possível inativar categoria com produtos vinculados.');
            return;
        }
        setLocalActive(value);
        form.setActive(value);
    };

    const handleSaveClick = () => {
        if (!canManage) {
            toast.error('Você não tem permissão para gerenciar categorias.');
            return;
        }
        if (!form.name.trim()) {
            toast.error('O nome da categoria é obrigatório.');
            return;
        }
        handleConfirmSave();
    };

    const handleConfirmSave = async () => {
        try {
            await handleSave({
                categoryId: isEditing ? categoryId : undefined,
                formData: { ...form.getFormData(), active: localActive },
                imageFile: imageFile,
                onSuccess: () => {
                    toast.success(isEditing ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
                    onSuccess();
                    onClose();
                },
            });
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
                {/* LADO ESQUERDO – UPLOAD/IMAGEM (BANNER HORIZONTAL) */}
                <div className="w-full md:w-2/5 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col items-center justify-start relative overflow-y-auto">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 self-start">
                        Imagem da Categoria
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 self-start">
                        Recomendado: imagem horizontal, 1200x400px (formato banner)
                    </p>

                    <div className="w-full flex flex-col items-center">
                        {/* Preview da imagem (horizontal) */}
                        {form.imageUrl ? (
                            <div className="relative w-full mb-4 group">
                                <img
                                    src={form.imageUrl}
                                    alt={form.name || 'Categoria'}
                                    className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        form.setImageUrl(null);
                                        setImageFile(null);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remover imagem"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div
                                className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800/50 cursor-pointer hover:border-[#21A896] hover:bg-[#21A896]/5 transition-colors"
                                onClick={() => document.getElementById('category-image-upload')?.click()}
                            >
                                <span className="text-4xl text-gray-400 mb-2">🖼️</span>
                                <p className="font-medium text-gray-600 dark:text-gray-300 text-sm">
                                    Clique para fazer upload
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    PNG, JPG • max 2MB
                                </p>
                            </div>
                        )}
                        <input
                            id="category-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                    toast.error('A imagem deve ter no máximo 2MB');
                                    return;
                                }
                                const url = URL.createObjectURL(file);
                                form.setImageUrl(url); // preview
                                setImageFile(file);
                            }}
                        />
                    </div>
                </div>

                {/* LADO DIREITO – FORMULÁRIO */}
                <div className="w-full md:w-3/5 flex flex-col max-h-full overflow-hidden">
                    <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#21A896]/10 rounded-lg">
                                <Package size={20} className="text-[#21A896]" />
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                                {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <CategoryFormFields
                            {...form}
                            active={localActive}
                            setActive={handleActiveToggle}
                            onImageFileChange={setImageFile}
                        />
                    </div>

                    <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveClick}
                            disabled={saving || !form.name || !canManage}
                            className="px-4 py-2 bg-[#21A896] hover:bg-[#1a867a] text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    {isEditing ? 'Atualizar' : 'Criar'} Categoria
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
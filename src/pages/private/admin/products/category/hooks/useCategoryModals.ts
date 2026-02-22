import { useState } from 'react';
import type { Category } from '../types/category.types';

export const useCategoryModals = () => {
    // Modais de visualização, edição e exclusão
    const [viewCategory, setViewCategory] = useState<Category | null>(null);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);

    const openViewModal = (category: Category) => setViewCategory(category);
    const closeViewModal = () => setViewCategory(null);

    const openEditModal = (category: Category) => setEditCategory(category);
    const closeEditModal = () => setEditCategory(null);

    const openDeleteModal = (category: Category) => setDeleteCategory(category);
    const closeDeleteModal = () => setDeleteCategory(null);

    const openNewModal = () => setIsNewModalOpen(true);
    const closeNewModal = () => setIsNewModalOpen(false);

    return {
        // Estados
        viewCategory,
        editCategory,
        deleteCategory,
        isNewModalOpen,

        // Ações
        openViewModal,
        closeViewModal,
        openEditModal,
        closeEditModal,
        openDeleteModal,
        closeDeleteModal,
        openNewModal,
        closeNewModal,
    };
};
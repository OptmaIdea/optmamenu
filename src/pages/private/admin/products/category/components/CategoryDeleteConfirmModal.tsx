import { useState } from 'react';
import { toast } from 'sonner';
import SecurityConfirmModal from '@/components/common/SecurityConfirmModal';
import { useStoreSecurityConfig } from '@/hooks/useStoreSecurityConfig';
import type { Category } from '../types/category.types';

interface CategoryDeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: Category | null;
    onSuccess: () => void;
    onDelete: (category: Category) => Promise<boolean>; // função real de exclusão
}

export default function CategoryDeleteConfirmModal({
    isOpen,
    onClose,
    category,
    onSuccess,
    onDelete,
}: CategoryDeleteConfirmModalProps) {
    const { tokenExpirySeconds, maxTokenAttempts } = useStoreSecurityConfig();
    const [isDeleting, setIsDeleting] = useState(false);

    if (!category) return null;

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            const success = await onDelete(category);
            if (success) {
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Erro ao excluir categoria:', error);
            toast.error('Erro inesperado ao excluir categoria');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <SecurityConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            title="Confirmar exclusão de categoria"
            description={`Deseja excluir a categoria "${category.name}"? Esta ação é permanente e só poderá ser realizada se não houver produtos vinculados.`}
            confirmText={isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
            cancelText="Cancelar"
            requireToken={true}
            tokenExpirySeconds={tokenExpirySeconds}
            maxTokenAttempts={maxTokenAttempts}
        />
    );
}
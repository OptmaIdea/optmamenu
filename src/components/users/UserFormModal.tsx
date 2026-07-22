import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { UserAdmin, UserFormData, UserRole } from '@/types';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => Promise<void>;
    user?: UserAdmin | null;
    mode: 'create' | 'edit';
}

export function UserFormModal({
    isOpen,
    onClose,
    onSubmit,
    user,
    mode,
}: UserFormModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<UserFormData>({
        defaultValues: {
            email: '',
            full_name: '',
            phone: '',
            cpf: '',
            role: 'staff',
            is_admin: false,
            internal_notes: '',
        },
    });

    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'create') {
            reset({
                email: '',
                full_name: '',
                phone: '',
                cpf: '',
                role: 'staff',
                is_admin: false,
                internal_notes: '',
            });
            return;
        }

        if (user) {
            reset({
                email: user.email ?? '',
                full_name: user.full_name ?? '',
                phone: user.phone ?? '',
                cpf: user.cpf ?? '',
                role: user.role,
                is_admin: user.is_admin,
                internal_notes: user.internal_notes ?? '',
            });
        }
    }, [isOpen, mode, user, reset]);

    if (!isOpen) return null;

    const resetCreateForm = () => {
        reset({
            email: '',
            full_name: '',
            phone: '',
            cpf: '',
            role: 'staff',
            is_admin: false,
            internal_notes: '',
        });
    };

    const handleClose = () => {
        if (mode === 'create') {
            resetCreateForm();
        }

        onClose();
    };

    const handleFormSubmit = async (data: UserFormData) => {
        if (!data.email.includes('@')) {
            toast.error('Por favor, insira um e-mail válido.');
            return;
        }
        await onSubmit(data);
        handleClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {mode === 'create' ? 'Acesso para novo usuário' : 'Editar cargo'}
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
                        {/* Email (somente create) */}
                        {mode === 'create' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    {...register('email', {
                                        required: 'Email é obrigatório',
                                        pattern: {
                                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                            message: 'Email inválido',
                                        },
                                    })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                                    placeholder="usuario@exemplo.com"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                                )}
                            </div>
                        )}

                        {/* Nome ou apelido */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome *
                            </label>
                            <input
                                type="text"
                                {...register('full_name', {
                                    required: 'Nome é obrigatório',
                                    minLength: {
                                        value: 3,
                                        message: 'Nome deve ter pelo menos 3 caracteres',
                                    },
                                })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                                placeholder="Ex: João"
                            />
                            {errors.full_name && (
                                <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>
                            )}
                        </div>



                        {/* Cargo/Cargo do usuário */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Permissão *
                            </label>
                            <select
                                {...register('role', { required: true })}
                                onChange={(e) => {
                                    const role = e.target.value as UserRole;
                                    setValue('role', role);
                                    setValue('is_admin', role === 'admin' || role === 'manager');
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#19A999] focus:border-transparent"
                            >
                                <option value="viewer">Visualizador</option>
                                <option value="staff">Equipe</option>
                                <option value="sales">Vendas</option>
                                <option value="cashier">Caixa</option>
                                <option value="stock_operator">Operador de estoque</option>
                                <option value="manager">Gerente</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 rounded-lg bg-[#19A999] text-white hover:bg-[#14887B] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Enviando...' : mode === 'create' ? 'Enviar convite' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

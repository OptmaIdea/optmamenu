import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { UserAdmin, UserFormData, UserRole } from '@/types';
import { X } from 'lucide-react';

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
        if (user && mode === 'edit') {
            setValue('full_name', user.full_name || '');
            setValue('phone', user.phone || '');
            setValue('cpf', user.cpf || '');
            setValue('role', user.role);
            setValue('is_admin', user.is_admin);
            setValue('internal_notes', user.internal_notes || '');
        } else if (mode === 'create') {
            reset({
                email: '',
                full_name: '',
                phone: '',
                cpf: '',
                role: 'staff',
                is_admin: false,
                internal_notes: '',
            });
        }
    }, [user, mode, setValue, reset]);

    if (!isOpen) return null;

    const handleFormSubmit = async (data: UserFormData) => {
        await onSubmit(data);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
                        </h2>
                        <button
                            onClick={onClose}
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
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                                    placeholder="usuario@exemplo.com"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                                )}
                            </div>
                        )}

                        {/* Nome Completo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome Completo *
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
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                                placeholder="João Silva"
                            />
                            {errors.full_name && (
                                <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>
                            )}
                        </div>

                        {/* Telefone e CPF */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Telefone
                                </label>
                                <input
                                    type="tel"
                                    {...register('phone')}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    CPF
                                </label>
                                <input
                                    type="text"
                                    {...register('cpf')}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                                    placeholder="000.000.000-00"
                                />
                            </div>
                        </div>

                        {/* Cargo/Permissão */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Permissão *
                            </label>
                            <select
                                {...register('role', { required: true })}
                                onChange={(e) => {
                                    const role = e.target.value as UserRole;
                                    setValue('role', role);
                                    setValue('is_admin', role === 'admin' || role === 'super_admin');
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent"
                            >
                                <option value="viewer">Visualizador</option>
                                <option value="staff">Equipe</option>
                                <option value="manager">Gerente</option>
                                <option value="admin">Administrador</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>

                        {/* Observações Internas */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Observações Internas
                            </label>
                            <textarea
                                {...register('internal_notes')}
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#21A896] focus:border-transparent resize-none"
                                placeholder="Adicione observações sobre este usuário..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 rounded-lg bg-[#21A896] text-white hover:bg-[#1A867A] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Criar' : 'Salvar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

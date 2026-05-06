import { useState } from 'react';
import { toast } from 'sonner';
import type {
    StoreMemberOccurrenceSeverity,
    StoreMemberOccurrenceType,
    UserAdmin,
} from '@/types';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleBadge } from './UserRoleBadge';
import {
    X,
    Mail,
    Phone,
    User,
    Calendar,
    Shield,
    Store,
    Briefcase,
    Save,
    Plus,
    AlertTriangle,
    Loader,
} from 'lucide-react';
import { useStoreMemberDetails } from '@/hooks/useStoreMemberDetails';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserAdmin | null;
}

type ModalTab = 'overview' | 'internal' | 'occurrences';

interface InternalFormState {
    nickname: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    startedAt: string;
    endedAt: string;
    exitReason: string;
    internalNotes: string;
}

interface OccurrenceFormState {
    occurrenceType: StoreMemberOccurrenceType;
    severity: StoreMemberOccurrenceSeverity;
    title: string;
    description: string;
    occurredAt: string;
    visibleToMember: boolean;
}

function getStringFromRecord(
    value: Record<string, unknown> | null | undefined,
    key: string
): string {
    const field = value?.[key];
    return typeof field === 'string' ? field : '';
}

function formatRoleLabel(role: string): string {
    const labels: Record<string, string> = {
        owner: 'Proprietário',
        super_admin: 'Super Administrador',
        admin: 'Administrador',
        manager: 'Gerente',
        stock_operator: 'Operador de estoque',
        cashier: 'Caixa',
        sales: 'Vendas',
        staff: 'Equipe',
        viewer: 'Visualizador',
    };

    return labels[role] ?? role;
}

function formatOccurrenceType(type: StoreMemberOccurrenceType): string {
    const labels: Record<StoreMemberOccurrenceType, string> = {
        note: 'Observação',
        warning: 'Advertência',
        praise: 'Elogio',
        training: 'Treinamento',
        incident: 'Incidente',
        role_change: 'Mudança de função',
        absence: 'Ausência',
        exit: 'Saída',
        other: 'Outro',
    };

    return labels[type];
}

function formatSeverity(severity: StoreMemberOccurrenceSeverity): string {
    const labels: Record<StoreMemberOccurrenceSeverity, string> = {
        info: 'Informativo',
        low: 'Baixa',
        medium: 'Média',
        high: 'Alta',
        critical: 'Crítica',
    };

    return labels[severity];
}

function todayInputValue(): string {
    return new Date().toISOString().slice(0, 10);
}

export function UserDetailModal({ isOpen, onClose, user }: UserDetailModalProps) {
    const [activeTab, setActiveTab] = useState<ModalTab>('overview');
    const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
    const [loadedDetailsId, setLoadedDetailsId] = useState<string | null>(null);

    const {
        details,
        occurrences,
        loading,
        saving,
        error,
        saveDetails,
        addOccurrence,
    } = useStoreMemberDetails(isOpen && user ? user.id : null);

    const memberStore = user?.stores?.[0] ?? null;

    const [internalForm, setInternalForm] = useState<InternalFormState>(() =>
        getEmptyInternalForm()
    );

    if (isOpen && user?.id && loadedUserId !== user.id) {
        setLoadedUserId(user.id);
        setLoadedDetailsId(null);
        setActiveTab('overview');
        setInternalForm(getEmptyInternalForm());
    }

    const detailsSyncKey = details?.id ?? 'empty';

    if (isOpen && user?.id && loadedDetailsId !== detailsSyncKey && !loading) {
        setLoadedDetailsId(detailsSyncKey);
        setInternalForm(getInternalFormFromDetails(details));
    }



    const [occurrenceForm, setOccurrenceForm] = useState<OccurrenceFormState>({
        occurrenceType: 'note',
        severity: 'info',
        title: '',
        description: '',
        occurredAt: todayInputValue(),
        visibleToMember: false,
    });

    const initials = getInitials(user?.full_name);

    if (!isOpen || !user) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateOnly = (dateString: string | null | undefined) => {
        if (!dateString) return 'Não informado';

        return new Date(`${dateString}T00:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    const handleSaveInternalDetails = async () => {
        if (!memberStore) {
            toast.error('Vínculo de loja não encontrado para este usuário.');
            return;
        }

        try {
            await saveDetails({
                storeId: memberStore.store_id,
                memberId: user.id,
                userId: memberStore.user_id,
                nickname: internalForm.nickname.trim() || null,
                address: {
                    street: internalForm.street.trim(),
                    number: internalForm.number.trim(),
                    complement: internalForm.complement.trim(),
                    district: internalForm.district.trim(),
                    city: internalForm.city.trim(),
                    state: internalForm.state.trim(),
                    zip_code: internalForm.zipCode.trim(),
                },
                startedAt: internalForm.startedAt || null,
                endedAt: internalForm.endedAt || null,
                exitReason: internalForm.exitReason.trim() || null,
                internalNotes: internalForm.internalNotes.trim() || null,
            });

            toast.success('Dados internos salvos com sucesso.');
        } catch {
            toast.error('Não foi possível salvar os dados internos.');
        }
    };

    const handleAddOccurrence = async () => {
        if (!memberStore) {
            toast.error('Vínculo de loja não encontrado para este usuário.');
            return;
        }

        if (!occurrenceForm.title.trim()) {
            toast.error('Informe um título para a ocorrência.');
            return;
        }

        try {
            await addOccurrence({
                storeId: memberStore.store_id,
                memberId: user.id,
                userId: memberStore.user_id,
                occurrenceType: occurrenceForm.occurrenceType,
                severity: occurrenceForm.severity,
                title: occurrenceForm.title.trim(),
                description: occurrenceForm.description.trim() || null,
                occurredAt: occurrenceForm.occurredAt
                    ? `${occurrenceForm.occurredAt}T12:00:00`
                    : null,
                visibleToMember: occurrenceForm.visibleToMember,
                createdByEmail: null,
            });

            setOccurrenceForm({
                occurrenceType: 'note',
                severity: 'info',
                title: '',
                description: '',
                occurredAt: todayInputValue(),
                visibleToMember: false,
            });

            toast.success('Ocorrência registrada com sucesso.');
        } catch {
            toast.error('Não foi possível registrar a ocorrência.');
        }
    };

    const tabs: Array<{ id: ModalTab; label: string; icon: typeof User }> = [
        { id: 'overview', label: 'Visão geral', icon: User },
        { id: 'internal', label: 'Dados internos', icon: Briefcase },
        { id: 'occurrences', label: 'Ocorrências', icon: AlertTriangle },
    ];

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Detalhes do Usuário
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="max-h-[calc(90vh-73px)] overflow-y-auto">
                        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/30">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#21A896] to-[#1A867A] text-2xl font-bold text-white">
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {details?.nickname || user.full_name || 'Sem nome'}
                                        </h3>
                                        {details?.nickname && user.full_name && (
                                            <p className="text-sm text-gray-500">
                                                Nome: {user.full_name}
                                            </p>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <UserRoleBadge role={user.role} size="sm" />
                                            <UserStatusBadge status={user.status} size="sm" />
                                        </div>
                                    </div>
                                </div>

                                {loading && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Loader className="h-4 w-4 animate-spin" />
                                        Carregando dados internos...
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={
                                                isActive
                                                    ? 'inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-3 py-2 text-sm font-bold text-white'
                                                    : 'inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                            }
                                        >
                                            <Icon size={15} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {error && (
                            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6 p-6">
                            {activeTab === 'overview' && (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {user.email && (
                                            <InfoCard icon={Mail} label="Email" value={user.email} />
                                        )}

                                        {user.phone && (
                                            <InfoCard icon={Phone} label="Telefone" value={user.phone} />
                                        )}

                                        {user.cpf && (
                                            <InfoCard icon={User} label="CPF" value={user.cpf} />
                                        )}

                                        <InfoCard
                                            icon={Shield}
                                            label="Permissão"
                                            value={formatRoleLabel(user.role)}
                                        />

                                        <InfoCard
                                            icon={Calendar}
                                            label="Criado em"
                                            value={formatDate(user.created_at)}
                                        />

                                        {user.last_sign_in_at && (
                                            <InfoCard
                                                icon={Calendar}
                                                label="Último acesso"
                                                value={formatDate(user.last_sign_in_at)}
                                            />
                                        )}

                                        <InfoCard
                                            icon={Briefcase}
                                            label="Início das atividades"
                                            value={formatDateOnly(details?.started_at)}
                                        />

                                        <InfoCard
                                            icon={Calendar}
                                            label="Fim das atividades"
                                            value={formatDateOnly(details?.ended_at)}
                                        />
                                    </div>

                                    {user.stores && user.stores.length > 0 && (
                                        <div>
                                            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                <Store size={16} />
                                                Lojas vinculadas
                                            </h4>
                                            <div className="space-y-2">
                                                {user.stores.map((store) => (
                                                    <div
                                                        key={store.id}
                                                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">
                                                                {store.store_name || 'Loja atual'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {store.store_slug}
                                                            </p>
                                                        </div>
                                                        <UserRoleBadge role={store.role} size="sm" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                                        <StatCard label="É Admin" value={user.is_admin ? 'Sim' : 'Não'} />
                                        <StatCard
                                            label="Email Verificado"
                                            value={user.email_verified ? 'Sim' : 'Não'}
                                        />
                                        <StatCard label="Status" value={user.is_active ? 'Ativo' : 'Inativo'} />
                                    </div>
                                </>
                            )}

                            {activeTab === 'internal' && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                        Estes dados são internos da loja e devem ficar restritos a owner,
                                        admin ou gerente autorizado.
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <TextField
                                            label="Apelido"
                                            value={internalForm.nickname}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    nickname: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="CEP"
                                            value={internalForm.zipCode}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    zipCode: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Rua"
                                            value={internalForm.street}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    street: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Número"
                                            value={internalForm.number}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    number: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Complemento"
                                            value={internalForm.complement}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    complement: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Bairro"
                                            value={internalForm.district}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    district: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="Cidade"
                                            value={internalForm.city}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    city: value,
                                                }))
                                            }
                                        />

                                        <TextField
                                            label="UF"
                                            value={internalForm.state}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    state: value,
                                                }))
                                            }
                                        />

                                        <DateField
                                            label="Início das atividades"
                                            value={internalForm.startedAt}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    startedAt: value,
                                                }))
                                            }
                                        />

                                        <DateField
                                            label="Fim das atividades"
                                            value={internalForm.endedAt}
                                            onChange={(value) =>
                                                setInternalForm((current) => ({
                                                    ...current,
                                                    endedAt: value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <TextAreaField
                                        label="Motivo da saída"
                                        value={internalForm.exitReason}
                                        onChange={(value) =>
                                            setInternalForm((current) => ({
                                                ...current,
                                                exitReason: value,
                                            }))
                                        }
                                    />

                                    <TextAreaField
                                        label="Observações internas"
                                        value={internalForm.internalNotes}
                                        onChange={(value) =>
                                            setInternalForm((current) => ({
                                                ...current,
                                                internalNotes: value,
                                            }))
                                        }
                                    />

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveInternalDetails}
                                            disabled={saving}
                                            className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:opacity-60"
                                        >
                                            {saving ? (
                                                <Loader className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            Salvar dados internos
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'occurrences' && (
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                        <h4 className="mb-3 font-bold text-gray-900 dark:text-white">
                                            Nova ocorrência
                                        </h4>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            <SelectField
                                                label="Tipo"
                                                value={occurrenceForm.occurrenceType}
                                                options={[
                                                    ['note', 'Observação'],
                                                    ['warning', 'Advertência'],
                                                    ['praise', 'Elogio'],
                                                    ['training', 'Treinamento'],
                                                    ['incident', 'Incidente'],
                                                    ['role_change', 'Mudança de função'],
                                                    ['absence', 'Ausência'],
                                                    ['exit', 'Saída'],
                                                    ['other', 'Outro'],
                                                ]}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        occurrenceType: value as StoreMemberOccurrenceType,
                                                    }))
                                                }
                                            />

                                            <SelectField
                                                label="Gravidade"
                                                value={occurrenceForm.severity}
                                                options={[
                                                    ['info', 'Informativo'],
                                                    ['low', 'Baixa'],
                                                    ['medium', 'Média'],
                                                    ['high', 'Alta'],
                                                    ['critical', 'Crítica'],
                                                ]}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        severity: value as StoreMemberOccurrenceSeverity,
                                                    }))
                                                }
                                            />

                                            <DateField
                                                label="Data"
                                                value={occurrenceForm.occurredAt}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        occurredAt: value,
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div className="mt-4 space-y-4">
                                            <TextField
                                                label="Título"
                                                value={occurrenceForm.title}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        title: value,
                                                    }))
                                                }
                                            />

                                            <TextAreaField
                                                label="Descrição"
                                                value={occurrenceForm.description}
                                                onChange={(value) =>
                                                    setOccurrenceForm((current) => ({
                                                        ...current,
                                                        description: value,
                                                    }))
                                                }
                                            />

                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={occurrenceForm.visibleToMember}
                                                    onChange={(event) =>
                                                        setOccurrenceForm((current) => ({
                                                            ...current,
                                                            visibleToMember: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Visível ao membro no futuro
                                            </label>

                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleAddOccurrence}
                                                    disabled={saving}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-[#21A896] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] disabled:opacity-60"
                                                >
                                                    {saving ? (
                                                        <Loader className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Plus size={16} />
                                                    )}
                                                    Registrar ocorrência
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="mb-3 font-bold text-gray-900 dark:text-white">
                                            Histórico de ocorrências
                                        </h4>

                                        {occurrences.length === 0 ? (
                                            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-700/50">
                                                Nenhuma ocorrência registrada.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {occurrences.map((occurrence) => (
                                                    <div
                                                        key={occurrence.id}
                                                        className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                                                    >
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                            <div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                                        {formatOccurrenceType(
                                                                            occurrence.occurrence_type
                                                                        )}
                                                                    </span>
                                                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                                        {formatSeverity(occurrence.severity)}
                                                                    </span>
                                                                    {!occurrence.visible_to_member && (
                                                                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                                                            Interno
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <h5 className="mt-2 font-bold text-gray-900 dark:text-white">
                                                                    {occurrence.title}
                                                                </h5>

                                                                {occurrence.description && (
                                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                                                                        {occurrence.description}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <p className="text-xs text-gray-500">
                                                                {formatDate(occurrence.occurred_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function InfoCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <Icon size={18} className="mt-0.5 text-gray-400" />
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {label}
                </p>
                <p className="text-sm text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-center">
            <p className="text-2xl font-bold text-[#21A896]">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
    );
}

function TextField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function DateField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <input
                type="date"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function TextAreaField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
        </label>
    );
}

function getEmptyInternalForm(): InternalFormState {
    return {
        nickname: '',
        street: '',
        number: '',
        complement: '',
        district: '',
        city: '',
        state: '',
        zipCode: '',
        startedAt: '',
        endedAt: '',
        exitReason: '',
        internalNotes: '',
    };
}

function getInternalFormFromDetails(
    details: ReturnType<typeof useStoreMemberDetails>['details']
): InternalFormState {
    if (!details) {
        return getEmptyInternalForm();
    }

    return {
        nickname: details.nickname ?? '',
        street: getStringFromRecord(details.address, 'street'),
        number: getStringFromRecord(details.address, 'number'),
        complement: getStringFromRecord(details.address, 'complement'),
        district: getStringFromRecord(details.address, 'district'),
        city: getStringFromRecord(details.address, 'city'),
        state: getStringFromRecord(details.address, 'state'),
        zipCode: getStringFromRecord(details.address, 'zip_code'),
        startedAt: details.started_at ?? '',
        endedAt: details.ended_at ?? '',
        exitReason: details.exit_reason ?? '',
        internalNotes: details.internal_notes ?? '',
    };
}

function getInitials(fullName: string | null | undefined): string {
    if (!fullName) return 'U';

    return fullName
        .split(' ')
        .map((namePart) => namePart[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<[string, string]>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                {label}
            </span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </select>
        </label>
    );
}
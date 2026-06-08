import { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronUp, Loader, Plus } from 'lucide-react';
import {
    PROFILE_REQUEST_STATUS_LABELS,
    PROFILE_REQUEST_TYPE_LABELS,
    type ProfileChangeRequest,
    type ProfileChangeRequestType,
    type ProfileChangeRequestStatus
} from '@/services/securityService';

const FIELD_LABELS: Record<string, string> = {
    name: 'Nome completo',
    cpf: 'CPF',
    birthdate: 'Data de nascimento',
    member_email: 'E-mail de contato',
    phone: 'Telefone fixo',
    mobile_phone: 'Celular',
    whatsapp_phone: 'WhatsApp',
    zip_code: 'CEP',
    address: 'Endereço',
    address_number: 'Número',
    complement: 'Complemento',
    district: 'Bairro',
    city: 'Cidade',
    state: 'UF',
    other: 'Descrição',
};

interface MyProfileChangeRequestsTabProps {
    myRequests: ProfileChangeRequest[];
    loadingMyRequests: boolean;
    loadMyProfileRequests: () => Promise<void>;
    openProfileRequestModal: (requestType: ProfileChangeRequestType) => void;
    handleCancelMyRequest: (request: ProfileChangeRequest) => Promise<void>;
}

function formatChangeValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Não informado';
    if (typeof value === 'string') return value;
    return String(value);
}

function formatAdditionalInfoChange(change: any): {
  title: string;
  oldText: string;
  newText: string;
  oldSensitive: string;
  newSensitive: string;
} {
  const itemId = change?.item_id;
  const oldArray = Array.isArray(change?.old) ? change.old : [];
  const newArray = Array.isArray(change?.new) ? change.new : [];

  const oldItem = oldArray.find((item: any) => item?.id === itemId);
  const newItem = newArray.find((item: any) => item?.id === itemId);

  return {
    title:
      change?.item_label ||
      newItem?.title ||
      oldItem?.title ||
      'Informação adicional',
    oldText: oldItem?.text || 'Não informado',
    newText: newItem?.text || 'Não informado',
    oldSensitive: oldItem?.sensitive ? 'Sim' : 'Não',
    newSensitive: newItem?.sensitive ? 'Sim' : 'Não',
  };
}

export default function MyProfileChangeRequestsTab({
    myRequests,
    loadingMyRequests,
    loadMyProfileRequests,
    openProfileRequestModal,
    handleCancelMyRequest,
}: MyProfileChangeRequestsTabProps) {
    // Filtros e ordenação para as solicitações cadastrais
    const [requestSearch, setRequestSearch] = useState('');
    const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | ProfileChangeRequestStatus>('all');
    const [requestDateFrom, setRequestDateFrom] = useState('');
    const [requestDateTo, setRequestDateTo] = useState('');
    const [requestSortOrder, setRequestSortOrder] = useState<string>('created_desc');
    const [collapsedRequests, setCollapsedRequests] = useState<Record<string, boolean>>({});

    const toggleRequestCollapse = (requestId: string) => {
        setCollapsedRequests((prev) => ({
            ...prev,
            [requestId]: !prev[requestId],
        }));
    };

    function getRequestTitle(request: ProfileChangeRequest): string {
        const baseTitle = PROFILE_REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type;
        
        if (request.request_type === 'additional_info_remove') {
            const itemTitle = request.requested_changes?.title || 'Informação adicional';
            return `Remoção de informação adicional (${itemTitle})`;
        }
        
        if (request.request_type === 'additional_info_update') {
            let itemTitle = 'Informação adicional';
            const changes = request.requested_changes ?? {};
            const additionalInfoChange = changes.member_additional_info || changes.additional_info;
            if (additionalInfoChange) {
                const infoChange = formatAdditionalInfoChange(additionalInfoChange);
                itemTitle = infoChange.title;
            }
            return `Alteração de informação adicional (${itemTitle})`;
        }
        
        return baseTitle;
    }

    const filteredRequests = useMemo(() => {
        return myRequests
            .filter((req) => {
                // Filtro de status
                if (requestStatusFilter !== 'all' && req.status !== requestStatusFilter) {
                    return false;
                }

                // Filtro de data de início (created_at >= requestDateFrom)
                if (requestDateFrom) {
                    const fromDate = new Date(`${requestDateFrom}T00:00:00`);
                    if (new Date(req.created_at) < fromDate) {
                        return false;
                    }
                }

                // Filtro de data final (created_at <= requestDateTo)
                if (requestDateTo) {
                    const toDate = new Date(`${requestDateTo}T23:59:59`);
                    if (new Date(req.created_at) > toDate) {
                        return false;
                    }
                }

                // Filtro de pesquisa de texto
                if (requestSearch.trim()) {
                    const query = requestSearch.toLowerCase();
                    const reason = (req.reason ?? '').toLowerCase();
                    const typeLabel = (PROFILE_REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type).toLowerCase();
                    const statusLabel = (PROFILE_REQUEST_STATUS_LABELS[req.status] ?? req.status).toLowerCase();
                    
                    // Buscar também nas alterações solicitadas se houver
                    let matchInChanges = false;
                    if (req.requested_changes) {
                        const changesStr = JSON.stringify(req.requested_changes).toLowerCase();
                        if (changesStr.includes(query)) {
                            matchInChanges = true;
                        }
                    }

                    if (
                        !reason.includes(query) &&
                        !typeLabel.includes(query) &&
                        !statusLabel.includes(query) &&
                        !matchInChanges
                    ) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                if (requestSortOrder === 'created_desc') {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                } else if (requestSortOrder === 'created_asc') {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                } else if (requestSortOrder === 'reviewed_desc') {
                    const aTime = a.reviewed_at ? new Date(a.reviewed_at).getTime() : 0;
                    const bTime = b.reviewed_at ? new Date(b.reviewed_at).getTime() : 0;
                    if (aTime === bTime) {
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    }
                    return bTime - aTime;
                } else if (requestSortOrder === 'reviewed_asc') {
                    const aTime = a.reviewed_at ? new Date(a.reviewed_at).getTime() : Infinity;
                    const bTime = b.reviewed_at ? new Date(b.reviewed_at).getTime() : Infinity;
                    if (aTime === bTime) {
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    }
                    return aTime - bTime;
                }
                return 0;
            });
    }, [myRequests, requestSearch, requestStatusFilter, requestDateFrom, requestDateTo, requestSortOrder]);

    return (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Solicitações cadastrais
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Acompanhe pedidos de alteração ou remoção enviados para análise.
                    </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={() => openProfileRequestModal('address_update')}
                        className="rounded-lg bg-[#21A896] hover:bg-[#1A867A] px-3 py-2 text-sm font-bold text-white transition shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                        <Plus size={16} />
                        Nova Solicitação
                    </button>
                    <button
                        type="button"
                        onClick={loadMyProfileRequests}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 transition shrink-0"
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros e Busca */}
            {!loadingMyRequests && myRequests.length > 0 && (
                <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Campo de busca */}
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Localizar alteração específica (tipo, motivo, valor)..."
                                value={requestSearch}
                                onChange={(e) => setRequestSearch(e.target.value)}
                                className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                            />
                            {requestSearch && (
                                <button
                                    type="button"
                                    onClick={() => setRequestSearch('')}
                                    className="absolute right-3 top-2 text-gray-400 hover:text-[#F26541] transition cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        
                        {/* Seletor de Status */}
                        <div className="w-full sm:w-48">
                            <select
                                value={requestStatusFilter}
                                onChange={(e) => setRequestStatusFilter(e.target.value as any)}
                                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                            >
                                <option value="all">Todos os status</option>
                                <option value="pending">Pendente</option>
                                <option value="applied">Aplicada</option>
                                <option value="rejected">Rejeitada</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Data De */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                De (Data de solicitação)
                            </label>
                            <input
                                type="date"
                                value={requestDateFrom}
                                onChange={(e) => setRequestDateFrom(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                            />
                        </div>

                        {/* Data Até */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                Até (Data de solicitação)
                            </label>
                            <input
                                type="date"
                                value={requestDateTo}
                                onChange={(e) => setRequestDateTo(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                            />
                        </div>

                        {/* Ordenação */}
                        <div>
                             <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                                 Ordenar por data
                             </label>
                             <select
                                 value={requestSortOrder}
                                 onChange={(e) => setRequestSortOrder(e.target.value)}
                                 className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#21A896] focus:ring-1 focus:ring-[#21A896]/30 transition"
                             >
                                 <option value="created_desc">Mais recente primeiro (Criação)</option>
                                 <option value="created_asc">Mais antigo primeiro (Criação)</option>
                                 <option value="reviewed_desc">Mais recente primeiro (Resposta)</option>
                                 <option value="reviewed_asc">Mais antigo primeiro (Resposta)</option>
                             </select>
                         </div>
                    </div>

                    {/* Botão de limpar filtros se houver filtros ativos */}
                    {(requestSearch || requestStatusFilter !== 'all' || requestDateFrom || requestDateTo || requestSortOrder !== 'created_desc') && (
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setRequestSearch('');
                                    setRequestStatusFilter('all');
                                    setRequestDateFrom('');
                                    setRequestDateTo('');
                                    setRequestSortOrder('created_desc');
                                }}
                                className="text-[11px] font-bold text-gray-500 hover:text-[#F26541] transition cursor-pointer"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}
                </div>
            )}

            {loadingMyRequests ? (
                <div className="flex items-center justify-center py-8">
                    <Loader className="animate-spin text-[#21A896]" size={24} />
                    <span className="ml-2 text-sm text-gray-500">Carregando solicitações...</span>
                </div>
            ) : myRequests.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center bg-gray-50 dark:bg-gray-800 rounded-xl">
                    Nenhuma solicitação cadastral registrada.
                </p>
            ) : filteredRequests.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center bg-gray-50 dark:bg-gray-800 rounded-xl">
                    Nenhuma solicitação cadastral corresponde aos filtros aplicados.
                </p>
            ) : (
                <div className="space-y-3">
                    {filteredRequests.map((request) => (
                        <div
                            key={request.request_id}
                            className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
                        >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {getRequestTitle(request)}
                                    </p>

                                    {!collapsedRequests[request.request_id] && (
                                        <>
                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                {request.reason}
                                            </p>

                                            {request.admin_notes && (
                                                <p className="mt-2 rounded-lg bg-white p-2 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                                    <strong>Retorno:</strong> {request.admin_notes}
                                                </p>
                                            )}

                                            {request.request_type === 'additional_info_remove' && (
                                                <div className="mt-3 rounded-lg bg-white p-3 text-sm dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                                        Item solicitado para remoção
                                                    </p>
                                                    <p className="mt-1 font-bold text-gray-900 dark:text-white">
                                                        {String(request.requested_changes?.title ?? 'Sem título')}
                                                    </p>
                                                    <p className="text-gray-600 dark:text-gray-300">
                                                        {String(request.requested_changes?.text ?? '')}
                                                    </p>
                                                </div>
                                            )}

                                            {request.request_type !== 'additional_info_remove' && Object.keys(request.requested_changes ?? {}).length > 0 && (
                                                <div className="mt-3 rounded-lg bg-white p-3 text-sm dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                                        Alterações solicitadas
                                                    </p>

                                                    <div className="mt-2 space-y-2">
                                                        {Object.entries(request.requested_changes ?? {}).map(([field, rawChange]) => {
                                                            const change = rawChange as any;

                                                            if (field === 'member_additional_info' || field === 'additional_info') {
                                                                const infoChange = formatAdditionalInfoChange(change);

                                                                return (
                                                                    <div key={field} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                                                                        <p className="text-xs font-bold text-gray-500">
                                                                            {infoChange.title}
                                                                        </p>

                                                                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                                                            <p>
                                                                                <strong>Atual:</strong> {infoChange.oldText}
                                                                            </p>
                                                                            <p>
                                                                                <strong>Novo:</strong> {infoChange.newText}
                                                                            </p>
                                                                            <p>
                                                                                <strong>Sensível:</strong> {infoChange.oldSensitive} → {infoChange.newSensitive}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }

                                                            // Pular campos legados sem estrutura {old, new}
                                                            if (typeof change !== 'object' || change === null || !('new' in change)) {
                                                                return (
                                                                    <div key={field} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                                                                        <p className="text-xs font-bold text-gray-500">{FIELD_LABELS[field] || field}</p>
                                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatChangeValue(change)}</p>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div key={field} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                                                                    <p className="text-xs font-bold text-gray-500">
                                                                        {change.label || FIELD_LABELS[field] || field}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        Atual: {formatChangeValue(change.old)}
                                                                    </p>
                                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                        Novo: {formatChangeValue(change.new)}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-col items-start gap-2 md:items-end shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-bold ${
                                            request.status === 'applied'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                                : request.status === 'rejected'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                                : request.status === 'cancelled'
                                                ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                        }`}>
                                            {PROFILE_REQUEST_STATUS_LABELS[request.status] ?? request.status}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => toggleRequestCollapse(request.request_id)}
                                            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition cursor-pointer flex items-center justify-center"
                                            title={collapsedRequests[request.request_id] ? "Expandir" : "Recolher"}
                                        >
                                            {collapsedRequests[request.request_id] ? (
                                                <ChevronDown size={14} />
                                            ) : (
                                                <ChevronUp size={14} />
                                            )}
                                        </button>
                                    </div>

                                    {!collapsedRequests[request.request_id] && request.status === 'pending' && (
                                        <button
                                            type="button"
                                            onClick={() => void handleCancelMyRequest(request)}
                                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30 cursor-pointer"
                                        >
                                            Cancelar solicitação
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!collapsedRequests[request.request_id] && (
                                <div className="mt-2 flex flex-col gap-1 text-[11px] text-gray-400">
                                    <p>Criada em {new Date(request.created_at).toLocaleString('pt-BR')}</p>
                                    {request.reviewed_at && (
                                        <p>Revisada em {new Date(request.reviewed_at).toLocaleString('pt-BR')}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

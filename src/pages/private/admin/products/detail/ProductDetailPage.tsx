import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Package,
    Edit,
    CheckCircle,
    XCircle,
    Archive,
    AlertCircle,
    Layers,
    Activity,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    RefreshCw
} from 'lucide-react';

import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/empty-state/EmptyState';
import AdminProductEditModal from '@/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal';

import { useProductDetail } from './hooks/useProductDetail';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';

type DetailTab = 'overview' | 'details' | 'pricing' | 'stock' | 'history';

export default function ProductDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const { storeId } = useCurrentStore();
    const { hasPermission } = usePermissions(storeId ?? null);

    // Permissões de escrita e navegação
    const canManageProducts = hasPermission('products.manage');
    const canViewStock = hasPermission('stock.view');
    const canCreateTransfer = hasPermission('transfers.create');

    const { product, loading, error, errorType, refetch } = useProductDetail(id);

    const [activeTab, setActiveTab] = useState<DetailTab>('overview');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Retorno inteligente para a listagem
    const handleBack = () => {
        const returnTo = (location.state as any)?.returnTo;
        if (returnTo) {
            navigate(returnTo);
        } else {
            navigate('/admin/products');
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    // 1. Avalia erro de carregamento PRIMEIRO para não mascarar falhas reais
    if (errorType === 'fetch_error') {
        return (
            <PageContainer
                title="Produtos"
                subtitle="Detalhes do produto"
                category="Produtos"
                icon={<Package size={28} className="text-[#19A999]" />}
                flat
            >
                <EmptyState
                    icon={<AlertCircle className="h-8 w-8 text-red-500" />}
                    title="Erro ao carregar produto"
                    description={error || 'Ocorreu um erro ao buscar as informações do produto.'}
                    action={
                        <div className="flex gap-3">
                            <button
                                onClick={() => refetch()}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#19A999] text-white text-sm font-medium rounded-xl hover:bg-[#14887B] transition-colors cursor-pointer"
                            >
                                <RefreshCw size={16} />
                                <span>Tentar novamente</span>
                            </button>
                            <button
                                onClick={() => navigate('/admin/products')}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                            >
                                <ArrowLeft size={16} />
                                <span>Voltar para Produtos</span>
                            </button>
                        </div>
                    }
                />
            </PageContainer>
        );
    }

    // 2. Avalia produto não encontrado ou fora da store ativa
    if (errorType === 'not_found' || !product) {
        return (
            <PageContainer
                title="Produtos"
                subtitle="Detalhes do produto"
                category="Produtos"
                icon={<Package size={28} className="text-[#19A999]" />}
                flat
            >
                <EmptyState
                    icon={<Package className="h-8 w-8 text-gray-400" />}
                    title="Produto não encontrado"
                    description="O produto solicitado não existe ou você não possui permissão para acessá-lo nesta loja."
                    action={
                        <button
                            onClick={() => navigate('/admin/products')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#19A999] text-white text-sm font-medium rounded-xl hover:bg-[#14887B] transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                            <span>Voltar para Produtos</span>
                        </button>
                    }
                />
            </PageContainer>
        );
    }

    const images = product.images && product.images.length > 0 ? product.images : [];
    const hasMultipleImages = images.length > 1;

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const formattedPrice = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(product.price);

    // Status cadastral / comercial consolidado
    const statusMeta = (() => {
        if (product.is_discontinued) {
            return {
                label: 'Descontinuado',
                badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
                icon: <Archive size={16} className="text-purple-600 dark:text-purple-400" />
            };
        }
        if (product.active) {
            return {
                label: 'Ativo',
                badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                icon: <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
            };
        }
        return {
            label: 'Inativo',
            badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            icon: <XCircle size={16} className="text-gray-500" />
        };
    })();

    // Ação gerencial recomendada
    const actionMeta = (() => {
        if (product.is_discontinued) {
            return { label: 'Descontinuado', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
        }
        switch (product.recommended_action) {
            case 'buy':
                return { label: 'Comprar', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
            case 'transfer':
            case 'transfer_or_redistribute':
                return { label: 'Transferir', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
            case 'monitor':
                return { label: 'Monitorar', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
            case 'review_excess':
                return { label: 'Revisar excesso', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
            default:
                return { label: 'OK', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
        }
    })();

    // Código principal
    const primaryCode = product.codes?.find((c) => c.is_primary) || product.codes?.[0];

    const handleProductSaved = async () => {
        setIsEditModalOpen(false);
        await refetch();
    };

    return (
        <>
            <PageContainer
                title={product.name}
                subtitle={`Produtos / ${product.category?.name || 'Sem categoria'}`}
                category="Produtos"
                icon={<Package size={28} className="text-[#19A999]" />}
                flat
            >
                {/* Header Superior com Botão Voltar e Ações */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <button
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={18} />
                        <span>Voltar para Produtos</span>
                    </button>

                    {canManageProducts && (
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#19A999] hover:bg-[#14887B] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer shrink-0"
                        >
                            <Edit size={16} />
                            <span>Editar Produto</span>
                        </button>
                    )}
                </div>

                {/* Card Hero — Imagem e Informações Principais */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-6 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        {/* Imagem do Produto */}
                        <div className="w-full lg:w-72 shrink-0 flex flex-col items-center">
                            {images.length > 0 ? (
                                <div className="relative w-full h-64 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center p-4">
                                    <img
                                        src={images[currentImageIndex]}
                                        alt={product.name}
                                        className="max-h-full max-w-full object-contain rounded-lg"
                                    />
                                    {hasMultipleImages && (
                                        <>
                                            <button
                                                onClick={prevImage}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                                            >
                                                <ChevronLeft size={18} className="text-gray-700 dark:text-gray-300" />
                                            </button>
                                            <button
                                                onClick={nextImage}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                                            >
                                                <ChevronRight size={18} className="text-gray-700 dark:text-gray-300" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-64 bg-gray-100 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                    <Package size={56} className="text-gray-400" />
                                </div>
                            )}

                            {hasMultipleImages && (
                                <div className="flex gap-2 mt-3 overflow-x-auto max-w-full py-1">
                                    {images.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`w-12 h-12 rounded-lg border-2 overflow-hidden shrink-0 transition cursor-pointer ${currentImageIndex === idx ? 'border-[#19A999]' : 'border-transparent opacity-60'
                                                }`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Dados Principais */}
                        <div className="flex-1 min-w-0 w-full space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}>
                                    {statusMeta.icon}
                                    <span>{statusMeta.label}</span>
                                </span>
                                {product.category?.name && (
                                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                                        {product.category.name}
                                    </span>
                                )}
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${actionMeta.className}`}>
                                    Ação: {actionMeta.label}
                                </span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">
                                    {product.name}
                                </h1>
                                {product.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-3">
                                        {product.description}
                                    </p>
                                )}
                            </div>

                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Preço de Venda</span>
                                    <span className="text-xl font-bold text-[#19A999]">{formattedPrice}</span>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Estoque Disponível</span>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                                        {product.display_available ?? 0}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Estoque Físico</span>
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {product.display_on_hand ?? 0}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block">Código Principal</span>
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate block">
                                        {primaryCode ? primaryCode.code_value : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navegação em Abas */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
                    <nav className="flex gap-6 whitespace-nowrap">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'overview'
                                    ? 'border-[#19A999] text-[#19A999]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Visão Geral
                        </button>
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'details'
                                    ? 'border-[#19A999] text-[#19A999]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Cadastro
                        </button>
                        <button
                            onClick={() => setActiveTab('pricing')}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'pricing'
                                    ? 'border-[#19A999] text-[#19A999]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Preço e Regras
                        </button>
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'stock'
                                    ? 'border-[#19A999] text-[#19A999]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Estoque
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'history'
                                    ? 'border-[#19A999] text-[#19A999]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Histórico
                        </button>
                    </nav>
                </div>

                {/* Conteúdo da Aba 1: Visão Geral */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                                    Descrição do Produto
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                    {product.description || 'Nenhuma descrição informada para este produto.'}
                                </p>
                            </div>

                            {/* Resumo de Estoque Consolidado */}
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                                    <span>Resumo de Estoque</span>
                                    <span className="text-xs font-medium text-[#19A999]">Multiestoque Consolidado</span>
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Em Mãos (Físico)</span>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                                            {product.display_on_hand ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Reservado</span>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                                            {product.display_reserved ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Disponível</span>
                                        <p className="text-lg font-bold text-[#19A999] mt-0.5">
                                            {product.display_available ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Mínimo Global</span>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                                            {product.global_min_stock ?? product.min_stock ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Máximo Global</span>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                                            {product.global_max_stock ?? product.max_stock ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Locais Ativos</span>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                                            {product.active_locations ?? 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Lateral — Códigos e Metadados */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                                    Códigos do Produto
                                </h3>
                                {product.codes && product.codes.length > 0 ? (
                                    <div className="space-y-2">
                                        {product.codes.map((code) => (
                                            <div
                                                key={code.id}
                                                className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl text-xs"
                                            >
                                                <span className="text-gray-500 dark:text-gray-400 uppercase font-medium">
                                                    {code.code_type} {code.is_primary && '(Principal)'}
                                                </span>
                                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                                    {code.code_value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">Nenhum código cadastrado.</p>
                                )}
                            </div>

                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                                    Datas Relevantes
                                </h3>
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Cadastrado em:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {product.created_at ? new Date(product.created_at).toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Última atualização:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {product.updated_at ? new Date(product.updated_at).toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Última entrada de estoque:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {product.last_stock_entry_at ? new Date(product.last_stock_entry_at).toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Última venda:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {product.last_sale_at ? new Date(product.last_sale_at).toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba 2: Cadastro */}
                {activeTab === 'details' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                Dados Cadastrais (Modo Leitura)
                            </h3>
                            {canManageProducts && (
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#19A999] hover:underline cursor-pointer"
                                >
                                    <Edit size={14} />
                                    <span>Editar produto</span>
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Nome</span>
                                <span className="text-gray-900 dark:text-white font-semibold">{product.name}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Categoria</span>
                                <span className="text-gray-900 dark:text-white font-semibold">
                                    {product.category?.name || 'Sem Categoria'}
                                </span>
                            </div>
                            <div className="md:col-span-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Descrição</span>
                                <span className="text-gray-900 dark:text-white whitespace-pre-line">
                                    {product.description || 'Sem descrição.'}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Situação</span>
                                <span className="text-gray-900 dark:text-white font-semibold">{statusMeta.label}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Data de Criação</span>
                                <span className="text-gray-900 dark:text-white font-semibold">
                                    {product.created_at ? new Date(product.created_at).toLocaleString('pt-BR') : '—'}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Última Atualização</span>
                                <span className="text-gray-900 dark:text-white font-semibold">
                                    {product.updated_at ? new Date(product.updated_at).toLocaleString('pt-BR') : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Tabela de Códigos */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                                Códigos de Identificação
                            </h4>
                            {product.codes && product.codes.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2">Tipo</th>
                                                <th className="px-3 py-2">Valor</th>
                                                <th className="px-3 py-2">Principal</th>
                                                <th className="px-3 py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {product.codes.map((code) => (
                                                <tr key={code.id}>
                                                    <td className="px-3 py-2 font-medium uppercase">{code.code_type}</td>
                                                    <td className="px-3 py-2 font-mono font-bold">{code.code_value}</td>
                                                    <td className="px-3 py-2">{code.is_primary ? 'Sim' : 'Não'}</td>
                                                    <td className="px-3 py-2">{code.active !== false ? 'Ativo' : 'Inativo'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 italic">Nenhum código cadastrado.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba 3: Preço e Regras */}
                {activeTab === 'pricing' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-6">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            Configuração de Preço e Regras
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Preço Base</span>
                                <span className="text-2xl font-bold text-[#19A999] mt-1 block">{formattedPrice}</span>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Origem da Precificação</span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 block">
                                    {product.use_category_pricing ? 'Preço da Categoria' : 'Regra Própria'}
                                </span>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Tipo de Lógica</span>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 block uppercase">
                                    {product.price_logic_type || 'standard'}
                                </span>
                            </div>
                        </div>

                        {/* Faixas / Regras de preço configuradas */}
                        {product.price_rules && Array.isArray(product.price_rules) && product.price_rules.length > 0 ? (
                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                                    Faixas de Preço por Quantidade
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2">Qtd Mínima</th>
                                                <th className="px-3 py-2">Preço Unitário</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {product.price_rules.map((rule: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 font-medium">{rule.min ?? rule.min_quantity} un</td>
                                                    <td className="px-3 py-2 font-bold text-[#19A999]">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rule.price)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 italic">Nenhuma faixa de preço especial configurada.</p>
                        )}
                    </div>
                )}

                {/* Conteúdo da Aba 4: Estoque */}
                {activeTab === 'stock' && (
                    <div className="space-y-6">
                        {/* Resumo de Estoque */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                                Diagnóstico Gerencial de Estoque
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500">Disponível Global</span>
                                    <p className="text-xl font-bold text-[#19A999] mt-1">{product.display_available ?? 0}</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500">Em Mãos (Físico)</span>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{product.display_on_hand ?? 0}</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500">Reservado Global</span>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{product.display_reserved ?? 0}</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500">Locais Ativos</span>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{product.active_locations ?? 0}</p>
                                </div>
                            </div>

                            {/* Links Operacionais (apenas respeitando permissões) */}
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                                Links Operacionais de Estoque
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                {canViewStock && (
                                    <button
                                        onClick={() => navigate('/admin/inventory')}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl transition cursor-pointer"
                                    >
                                        <Layers size={14} />
                                        <span>Ver estoque por local</span>
                                        <ExternalLink size={12} className="opacity-60" />
                                    </button>
                                )}

                                {canViewStock && (
                                    <button
                                        onClick={() => navigate(`/admin/stock/movements?productId=${product.id}`)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl transition cursor-pointer"
                                    >
                                        <Activity size={14} />
                                        <span>Ver movimentações do produto</span>
                                        <ExternalLink size={12} className="opacity-60" />
                                    </button>
                                )}

                                {canCreateTransfer && (
                                    <button
                                        onClick={() => navigate('/admin/transfers')}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#19A999]/10 hover:bg-[#19A999]/20 text-[#19A999] text-xs font-semibold rounded-xl transition cursor-pointer"
                                    >
                                        <ExternalLink size={14} />
                                        <span>Criar transferência</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Conteúdo da Aba 5: Histórico */}
                {activeTab === 'history' && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-6">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            Histórico do Produto
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                                <span className="text-gray-500 block">Data de Criação</span>
                                <span className="font-bold text-gray-900 dark:text-white text-sm mt-0.5 block">
                                    {product.created_at ? new Date(product.created_at).toLocaleDateString('pt-BR') : '—'}
                                </span>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                                <span className="text-gray-500 block">Última Entrada de Estoque</span>
                                <span className="font-bold text-gray-900 dark:text-white text-sm mt-0.5 block">
                                    {product.last_stock_entry_at ? new Date(product.last_stock_entry_at).toLocaleDateString('pt-BR') : '—'}
                                </span>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                                <span className="text-gray-500 block">Última Venda</span>
                                <span className="font-bold text-gray-900 dark:text-white text-sm mt-0.5 block">
                                    {product.last_sale_at ? new Date(product.last_sale_at).toLocaleDateString('pt-BR') : '—'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Vida do Produto
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Consulte a linha do tempo completa com auditoria, histórico de estoque e fornecedores.
                                </p>
                            </div>

                            {canManageProducts && (
                                <button
                                    onClick={() => navigate(`/admin/products/${product.id}/lifecycle`)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#19A999] hover:bg-[#14887B] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                                >
                                    <Activity size={14} />
                                    <span>Abrir Vida do Produto</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </PageContainer>

            {/* Modal de edição (apenas se gerencia) */}
            {canManageProducts && (
                <AdminProductEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    product={product}
                    onSuccess={handleProductSaved}
                />
            )}
        </>
    );
}

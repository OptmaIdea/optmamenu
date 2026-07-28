import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Package, ArrowLeft, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';

import { useProductFormData } from './hooks/useProductFormData';
import { useProductFormState } from './hooks/useProductFormState';
import { ProductForm } from './components/ProductForm';
import type { ProductFormMode } from './types/productForm.types';

interface ProductFormPageProps {
  mode: ProductFormMode;
}

export default function ProductFormPage({ mode }: ProductFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isEditing = mode === 'edit';

  const { storeId } = useCurrentStore();
  const { hasPermission } = usePermissions(storeId ?? null);
  const canManageProducts = hasPermission('products.manage');

  // Hook de busca de dados
  const {
    product,
    categories,
    loadingProduct,
    loadingCategories,
    notFound,
    codesLoaded,
    refetchCategories,
  } = useProductFormData(isEditing ? id : undefined);

  // Hook de formulário e estado
  const formState = useProductFormState({
    product,
    categories,
    isEditing,
    codesLoaded,
  });

  const { isDirty, handleSave } = formState;

  // Proteção para fechamento/recarregamento da aba com alterações pendentes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Existem alterações não salvas. Deseja sair mesmo assim?';
        return 'Existem alterações não salvas. Deseja sair mesmo assim?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Função de confirmação para sair/cancelar
  const confirmCancel = (targetUrl?: string) => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Existem alterações não salvas. Deseja sair mesmo assim?'
      );
      if (!confirmLeave) return;
    }

    if (targetUrl) {
      navigate(targetUrl);
    } else {
      const returnTo = (location.state as any)?.returnTo;
      navigate(returnTo || (isEditing && id ? `/admin/products/${id}` : '/admin/products'));
    }
  };

  // Handler de salvamento
  const onSaveSubmit = async () => {
    const productIdToUse = isEditing && id ? id : uuidv4();
    const result = await handleSave(isEditing, canManageProducts, productIdToUse);

    if (result.success && result.productId) {
      navigate(`/admin/products/${result.productId}`, { replace: true });
    }
  };

  // Se estiver carregando o produto em modo de edição
  if (isEditing && loadingProduct) {
    return <LoadingSpinner />;
  }

  // Se o produto não for encontrado ou pertencer a outra loja
  if (isEditing && (notFound || !product)) {
    return (
      <PageContainer
        title="Produtos"
        subtitle="Editar produto"
        category="Produtos"
        icon={<Package size={28} className="text-[#19A999]" />}
        flat
      >
        <EmptyState
          icon={<AlertCircle className="h-8 w-8 text-red-500" />}
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

  // Título e Subtítulo baseados no modo
  const pageTitle = isEditing ? `Editar ${product?.name || 'produto'}` : 'Novo produto';
  const pageSubtitle = isEditing
    ? `Produtos / ${product?.name || ''} / Editar`
    : 'Produtos / Novo produto';

  return (
    <PageContainer
      title={pageTitle}
      subtitle={pageSubtitle}
      category="Produtos"
      icon={<Package size={28} className="text-[#19A999]" />}
      flat
    >
      {/* Botão de Navegação / Cancelamento no Topo */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => confirmCancel()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span>Voltar para {isEditing && id ? 'Detalhes do produto' : 'Produtos'}</span>
        </button>
      </div>

      {/* Formulário Principal */}
      <div className="max-w-5xl">
        <ProductForm
          mode={mode}
          formState={formState}
          categories={categories}
          categoriesLoading={loadingCategories}
          onRefetchCategories={refetchCategories}
          onSave={onSaveSubmit}
          onCancel={() => confirmCancel()}
          canManage={canManageProducts}
          codesLoaded={codesLoaded}
        />
      </div>
    </PageContainer>
  );
}

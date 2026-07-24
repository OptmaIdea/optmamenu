import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

import CategoryEditModal from '@/pages/private/admin/products/category/components/CategoryEditModal';
import DeactivateProductModal from '@/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal';
import ReactivateProductModal from '@/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal';


import { ImageSection } from './ImageSection';
import ProductFormPanel from './panels/ProductFormPanel';

import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useProductSave } from '@/pages/private/admin/products/products/hooks/useProductSave';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';


import type { Category, Product } from '../../types/product.types';

import type { DragEndEvent } from '@dnd-kit/core';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface AdminProductEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    onSuccess: () => void;
}

interface PriceRule {
    min: number;
    price: string;
}

type MediaItem = {
    id: string;
    type: 'url' | 'file';
    value: string | File;
    preview?: string;
};

export default function AdminProductEditModal({
    isOpen,
    onClose,
    product,
    onSuccess,
}: AdminProductEditModalProps) {
    const isEditing = !!product;
    const productId = product?.id || uuidv4();

    // Permissões
    const { storeId: currentStoreId } = useCurrentStore();
    const { hasPermission } = usePermissions(currentStoreId ?? null);
    const canManageProducts = hasPermission('products.manage');

    // ----- TODOS OS ESTADOS DENTRO DO COMPONENTE -----
    const { handleSave: saveProduct, saving } = useProductSave();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);

    // Campos do formulário
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>('');
    const [active, setActive] = useState(true);
    const [stockQuantity, setStockQuantity] = useState(0);
    const [minStock, setMinStock] = useState(0);
    const [maxStock, setMaxStock] = useState(0);
    const [internalCode, setInternalCode] = useState('');
    const [sku, setSku] = useState('');
    const [ean, setEan] = useState('');

    // Imagens
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Preços
    const [pricingMode, setPricingMode] = useState<'standard' | 'category_volume'>('standard');
    const [useCategoryPricing, setUseCategoryPricing] = useState(true);
    const [priceLogicType, setPriceLogicType] = useState<'standard' | 'category_volume'>('standard');
    const [priceRules, setPriceRules] = useState<PriceRule[]>([]);

    // Modal de confirmação de segurança (apenas inativação/reativação mantém modal)
    // Edição comum agora salva diretamente sem senha

    // ===== MODAIS DE INATIVAÇÃO E REATIVAÇÃO =====
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showReactivateModal, setShowReactivateModal] = useState(false);

    // ===== NOVA CATEGORIA MODAL =====
    const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);

    const handleNewCategorySuccess = () => {
        // Atualiza a lista de categorias
        fetchCategories();
        setIsNewCategoryModalOpen(false);
    };

    // Bloqueia campo de estoque
    // Bloqueia campo de estoque
    // Guardamos apenas o setter: o valor não é lido aqui, mas pode ser útil para bloquear campos em componentes filhos.
    const [, setHasMovements] = useState(false);

    // ----- FUNÇÕES AUXILIARES -----
    const findCategoryById = (id: string): Category | undefined => {
        return categories.find(c => c.id === id);
    };



    // Buscar dados iniciais
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            if (isEditing && product) {
                loadProductData();
            } else {
                resetForm();
            }
        }
    }, [isOpen, product]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Hook para movimentações de estoque
    const { hasMovements: checkHasMovements } = useStockMovement();

    const fetchCategories = async () => {
        try {
            setLoadingCategories(true);
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) {
                toast.error('Nenhuma loja ativa selecionada.');
                return;
            }
            setStoreId(activeStoreId);
            const { data } = await supabase
                .from('categories')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('sort_order', { ascending: true });
            if (data) setCategories(data);
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
        } finally {
            setLoadingCategories(false);
        }
    };

    const loadProductData = async () => {
        if (!product) return;
        setName(product.name);
        setDescription(product.description || '');
        setPrice(product.price.toString());
        setCategoryId(product.category?.id || null);
        setActive(product.active ?? true);
        setStockQuantity(product.stock_quantity || 0);
        setMinStock(product.min_stock || 0);
        setMaxStock(product.max_stock || 0);
        setInternalCode(product.codes?.find((code) => code.code_type === 'internal')?.code_value ?? '');
        setSku(product.codes?.find((code) => code.code_type === 'sku')?.code_value ?? '');
        setEan(product.codes?.find((code) => code.code_type === 'ean')?.code_value ?? '');

        setUseCategoryPricing(product.use_category_pricing ?? true);
        setPricingMode(product.price_logic_type || 'standard');
        setPriceLogicType(product.price_logic_type || 'standard');
        setPriceRules(Array.isArray(product.price_rules) ? product.price_rules.map(r => ({ min: r.min, price: String(r.price) })) : []);

        // Carregar imagens
        let initialImages: string[] = [];
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            initialImages = product.images;
        } else if ((product as any).image_url) {
            initialImages = [(product as any).image_url];
        }
        setMediaItems(
            initialImages.map(url => ({
                id: Math.random().toString(36).substr(2, 9),
                type: 'url',
                value: url,
            }))
        );
        setImagesToDelete([]);
        setCurrentImageIndex(0);

        // Verificar movimentações na tabela stock_movements
        const hasMov = await checkHasMovements(product.id);
        setHasMovements(hasMov);
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setPrice('');
        setCategoryId(null);
        setActive(true);
        setStockQuantity(0);
        setMinStock(0);
        setMaxStock(0);
        setInternalCode('');
        setSku('');
        setEan('');
        setPricingMode('standard');
        setPriceLogicType('standard');
        setUseCategoryPricing(true);
        setPriceRules([]);
        setMediaItems([]);
        setImagesToDelete([]);
        setCurrentImageIndex(0);
    };

    // --- Lógica de imagens ---
    const processFiles = (files: FileList) => {
        if (mediaItems.length + files.length > 4) {
            toast.error('Máximo de 4 imagens por produto');
            return;
        }
        const newItems: MediaItem[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            type: 'file',
            value: file,
            preview: URL.createObjectURL(file),
        }));
        setMediaItems(prev => [...prev, ...newItems]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(e.target.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
    };

    const removeMedia = (idToRemove: string) => {
        const item = mediaItems.find(i => i.id === idToRemove);
        if (item && item.type === 'url') {
            setImagesToDelete(prev => [...prev, item.value as string]);
        }
        setMediaItems(items => items.filter(i => i.id !== idToRemove));
        if (currentImageIndex >= mediaItems.length - 1) {
            setCurrentImageIndex(Math.max(0, mediaItems.length - 2));
        }
    };

    const setMainMedia = (index: number) => {
        if (index === 0) return;
        setMediaItems(items => {
            const newItems = [...items];
            const [moved] = newItems.splice(index, 1);
            newItems.unshift(moved);
            return newItems;
        });
        setCurrentImageIndex(0);
    };

    const nextImage = () => {
        if (mediaItems.length > 1) {
            setCurrentImageIndex((prev) => (prev + 1) % mediaItems.length);
        }
    };
    const prevImage = () => {
        if (mediaItems.length > 1) {
            setCurrentImageIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
        }
    };

    // --- Lógica de preços ---
    useEffect(() => {
        const isInherit = useCategoryPricing;
        const category = isInherit && categoryId ? findCategoryById(categoryId) : null;
        const currentLogicType = isInherit
            ? category?.price_logic_type
            : priceLogicType;

        if (currentLogicType === 'category_volume') {
            const rules = isInherit
                ? category?.price_rules
                : priceRules;
            if (Array.isArray(rules) && rules.length > 0) {
                const maxPrice = Math.max(...rules.map(r => Number(r.price) || 0));
                if (maxPrice > 0) setPrice(maxPrice.toString());
            }
            return;
        }

        // Categoria com preço único (standard)
        if (isInherit && currentLogicType === 'standard') {
            const rules = category?.price_rules;
            if (Array.isArray(rules) && rules.length > 0) {
                const baseRule = rules.find((r) => Number(r.min) === 0);
                const basePrice = baseRule ? Number(baseRule.price) || 0 : 0;
                if (basePrice > 0) setPrice(basePrice.toString());
            }
        }
    }, [useCategoryPricing, categoryId, priceLogicType, priceRules, findCategoryById]);

    const handleAddRule = () => {
        setPriceRules([...priceRules, { min: 0, price: '0' }]);
    };
    const handleRuleChange = (index: number, field: 'min' | 'price', value: string) => {
        const newRules = [...priceRules];
        newRules[index] = { ...newRules[index], [field]: parseFloat(value) || 0 };
        setPriceRules(newRules);
    };
    const handleRemoveRule = (index: number) => {
        setPriceRules(priceRules.filter((_, i) => i !== index));
    };

    // ----- FUNÇÕES DE DRAG & DROP E ORDENAÇÃO -----

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;

        const oldIndex = mediaItems.findIndex((item) => item.id === active.id);
        const newIndex = mediaItems.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(mediaItems, oldIndex, newIndex);
        setMediaItems(newItems);

        // Ajusta o índice da imagem atual se necessário
        if (currentImageIndex === oldIndex) {
            setCurrentImageIndex(newIndex);
        } else if (currentImageIndex > oldIndex && currentImageIndex <= newIndex) {
            setCurrentImageIndex(currentImageIndex - 1);
        } else if (currentImageIndex < oldIndex && currentImageIndex >= newIndex) {
            setCurrentImageIndex(currentImageIndex + 1);
        }
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newItems = arrayMove(mediaItems, index, index - 1);
        setMediaItems(newItems);
        if (currentImageIndex === index) {
            setCurrentImageIndex(index - 1);
        } else if (currentImageIndex === index - 1) {
            setCurrentImageIndex(index);
        }
    };

    const moveDown = (index: number) => {
        if (index === mediaItems.length - 1) return;
        const newItems = arrayMove(mediaItems, index, index + 1);
        setMediaItems(newItems);
        if (currentImageIndex === index) {
            setCurrentImageIndex(index + 1);
        } else if (currentImageIndex === index + 1) {
            setCurrentImageIndex(index);
        }
    };

    // ----- HANDLE SAVE (lógica de salvamento) -----
    const handleSave = async () => {
        if (!storeId) {
            toast.error('Loja não identificada');
            return;
        }

        const productId = isEditing ? product!.id : uuidv4();

        await saveProduct({
            productId,
            name,
            description,
            price,
            categoryId,
            active,
            mediaItems,
            imagesToDelete,
            pricingMode: useCategoryPricing ? 'inherit' : 'custom',
            priceLogicType: pricingMode,
            priceRules: priceRules.map(r => ({ min: r.min, price: Number(r.price) || 0 })),
            stockQuantity,
            minStock,
            maxStock,
            productCodes: [
                { type: 'internal', value: internalCode },
                { type: 'sku', value: sku },
                { type: 'ean', value: ean },
            ],
            isEditing,
            canManageProducts,
            onSuccess: () => {
                onSuccess();
                resetForm();
                onClose();
            },
            onClose,
        });
    };


    // ----- CONFIRMAÇÃO DE SEGURANÇA -----
    const handleSaveConfirmed = async () => {
        try {
            await handleSave();   // ✅ handleSave já usa os estados atuais (name, price, etc.)
            // Registrar log de sucesso
            await logAction(
                isEditing ? 'Editar Produto' : 'Criar Produto',
                { product_id: productId, name },   // ✅ name, não form.name
                'success'
            );
            toast.success(isEditing ? '✅ Produto atualizado com sucesso!' : '🎉 Produto criado com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            // Registrar log de falha
            await logAction(
                isEditing ? 'Editar Produto' : 'Criar Produto',
                { product_id: productId, name, error: error.message },   // ✅ name
                'failure'
            );
            toast.error('Erro ao salvar: ' + error.message);
        }
    };

    if (!isOpen) return null;

    const hasMultipleImages = mediaItems.length > 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
                {/* LADO ESQUERDO – IMAGENS */}
                <ImageSection
                    mediaItems={mediaItems}
                    isDragging={isDragging}
                    currentImageIndex={currentImageIndex}
                    hasMultipleImages={hasMultipleImages}
                    name={name}
                    onClose={onClose}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onFileSelect={handleFileSelect}
                    onRemoveMedia={removeMedia}
                    onSetMainMedia={setMainMedia}
                    onNextImage={nextImage}
                    onPrevImage={prevImage}
                    onDragEnd={handleDragEnd}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    setCurrentImageIndex={setCurrentImageIndex}
                    sensors={sensors}
                />

                {/* LADO DIREITO – FORMULÁRIO */}
                <ProductFormPanel
                    isEditing={isEditing}
                    name={name}
                    setName={setName}
                    description={description}
                    setDescription={setDescription}
                    internalCode={internalCode}
                    setInternalCode={setInternalCode}
                    sku={sku}
                    setSku={setSku}
                    ean={ean}
                    setEan={setEan}
                    categories={categories}
                    categoriesLoading={loadingCategories}
                    categoryId={categoryId}
                    setCategoryId={setCategoryId}
                    onOpenNewCategoryModal={() => setIsNewCategoryModalOpen(true)}
                    active={active}
                    setActive={setActive}
                    onRequestDeactivate={() => setShowDeactivateModal(true)}
                    onRequestReactivate={() => setShowReactivateModal(true)}
                    onRequestDelete={() => { /* handled via ProductDeleteConfirmModal */ }}
                    pricingMode={pricingMode}
                    setPricingMode={setPricingMode}
                    useCategoryPricing={useCategoryPricing}
                    setUseCategoryPricing={setUseCategoryPricing}
                    price={price}
                    setPrice={setPrice}
                    priceRules={priceRules}
                    onAddRule={handleAddRule}
                    onRuleChange={handleRuleChange}
                    onRemoveRule={handleRemoveRule}
                    stockQuantity={stockQuantity}
                    setStockQuantity={setStockQuantity}
                    minStock={minStock}
                    setMinStock={setMinStock}
                    maxStock={maxStock}
                    setMaxStock={setMaxStock}
                    saving={saving}
                    canSave={Boolean(name)}
                    onSaveClick={handleSaveConfirmed}
                    onCancel={onClose}
                />
            </div>


            {/* Modal de Inativação */}
            {showDeactivateModal && product && (
                <DeactivateProductModal
                    isOpen={showDeactivateModal}
                    onClose={() => setShowDeactivateModal(false)}
                    product={product!}
                    onSuccess={() => {
                        setShowDeactivateModal(false);
                        setActive(false);
                        onSuccess(); // Atualiza a lista de produtos
                        onClose(); // Fecha o modal de edição
                    }}
                />
            )}

            {/* Modal de Reativação */}
            {showReactivateModal && product && (
                <ReactivateProductModal
                    isOpen={showReactivateModal}
                    onClose={() => setShowReactivateModal(false)}
                    product={product}
                    onSuccess={() => {
                        setShowReactivateModal(false);
                        setActive(true);
                        setStockQuantity(prev => prev + (product?.stock_quantity || 0));
                        onSuccess(); // Atualiza a lista de produtos
                        onClose(); // Fecha o modal de edição
                    }}
                />
            )}

            {/* Modal de Nova Categoria */}
            {storeId && (
                <CategoryEditModal
                    isOpen={isNewCategoryModalOpen}
                    onClose={() => setIsNewCategoryModalOpen(false)}
                    category={null}
                    storeId={storeId!}
                    onSuccess={handleNewCategorySuccess}
                />
            )}
        </div>
    );
}

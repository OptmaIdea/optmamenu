import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { arrayMove } from '@dnd-kit/sortable';
import { useProductSave } from '@/pages/private/admin/products/products/hooks/useProductSave';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import type { Product, Category } from '../../products/types/product.types';
import type { FormErrors, FormMediaItem, FormPriceRule } from '../types/productForm.types';

interface UseProductFormStateProps {
  product?: Product | null;
  categories: Category[];
  isEditing: boolean;
  codesLoaded: boolean;
}

export function useProductFormState({ product, categories, isEditing, codesLoaded }: UseProductFormStateProps) {
  const { handleSave: saveProduct, saving } = useProductSave();

  // Estados dos campos
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [isDiscontinued, setIsDiscontinued] = useState(false);
  const [internalCode, setInternalCode] = useState('');
  const [sku, setSku] = useState('');
  const [ean, setEan] = useState('');

  // Precificação
  const [pricingMode, setPricingMode] = useState<'standard' | 'category_volume'>('standard');
  const [useCategoryPricing, setUseCategoryPricing] = useState(true);
  const [priceRules, setPriceRules] = useState<FormPriceRule[]>([]);

  // Parâmetros cadastrais de estoque
  const [minStock, setMinStock] = useState(0);
  const [maxStock, setMaxStock] = useState(0);
  const [stockQuantity, setStockQuantity] = useState(0);

  // Mídia
  const [mediaItems, setMediaItems] = useState<FormMediaItem[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  // Rastreamento de alterações (dirty state)
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Efeito para preencher o formulário quando o produto for carregado
  useEffect(() => {
    if (isEditing && product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price ? product.price.toString() : '');
      setCategoryId(product.category?.id || null);
      setActive(product.active ?? true);
      setIsDiscontinued(product.is_discontinued ?? false);
      setStockQuantity(product.stock_quantity || 0);
      setMinStock(product.min_stock || 0);
      setMaxStock(product.max_stock || 0);

      setInternalCode(product.codes?.find((c) => c.code_type === 'internal')?.code_value ?? '');
      setSku(product.codes?.find((c) => c.code_type === 'sku')?.code_value ?? '');
      setEan(product.codes?.find((c) => c.code_type === 'ean')?.code_value ?? '');

      setUseCategoryPricing(product.use_category_pricing ?? true);
      setPricingMode(product.price_logic_type || 'standard');
      setPriceRules(
        Array.isArray(product.price_rules)
          ? product.price_rules.map((r: any) => ({ min: Number(r.min) || 0, price: String(r.price ?? '0') }))
          : []
      );

      let initialImages: string[] = [];
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        initialImages = product.images;
      } else if ((product as any).image_url) {
        initialImages = [(product as any).image_url];
      }

      setMediaItems(
        initialImages.map((url) => ({
          id: Math.random().toString(36).substring(2, 11),
          type: 'url',
          value: url,
        }))
      );
      setImagesToDelete([]);
      setIsDirty(false);
    } else if (!isEditing) {
      setName('');
      setDescription('');
      setPrice('');
      setCategoryId(null);
      setActive(true);
      setIsDiscontinued(false);
      setStockQuantity(0);
      setMinStock(0);
      setMaxStock(0);
      setInternalCode('');
      setSku('');
      setEan('');
      setPricingMode('standard');
      setUseCategoryPricing(true);
      setPriceRules([]);
      setMediaItems([]);
      setImagesToDelete([]);
      setIsDirty(false);
    }
  }, [product, isEditing]);

  // Auxiliar para marcar formulário como alterado
  const markDirty = () => setIsDirty(true);

  // Handlers para atualização de estado com marcação de dirty
  const updateName = (val: string) => { setName(val); markDirty(); };
  const updateDescription = (val: string) => { setDescription(val); markDirty(); };
  const updatePrice = (val: string) => { setPrice(val); markDirty(); };
  const updateCategoryId = (val: string | null) => { setCategoryId(val); markDirty(); };
  const updateActive = (val: boolean) => { setActive(val); markDirty(); };
  const updateInternalCode = (val: string) => { setInternalCode(val); markDirty(); };
  const updateSku = (val: string) => { setSku(val); markDirty(); };
  const updateEan = (val: string) => { setEan(val); markDirty(); };
  const updatePricingMode = (val: 'standard' | 'category_volume') => { setPricingMode(val); markDirty(); };
  const updateUseCategoryPricing = (val: boolean) => { setUseCategoryPricing(val); markDirty(); };
  const updateMinStock = (val: number) => { setMinStock(val); markDirty(); };
  const updateMaxStock = (val: number) => { setMaxStock(val); markDirty(); };

  // Atualização automática de preço derivado de categoria se herdado
  useEffect(() => {
    if (!useCategoryPricing || !categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    const currentLogicType = cat.price_logic_type || 'standard';
    if (currentLogicType === 'category_volume' && Array.isArray(cat.price_rules) && cat.price_rules.length > 0) {
      const maxP = Math.max(...cat.price_rules.map((r: any) => Number(r.price) || 0));
      if (maxP > 0) setPrice(maxP.toString());
    } else if (currentLogicType === 'standard' && Array.isArray(cat.price_rules) && cat.price_rules.length > 0) {
      const baseRule = cat.price_rules.find((r: any) => Number(r.min) === 0);
      const baseP = baseRule ? Number(baseRule.price) || 0 : 0;
      if (baseP > 0) setPrice(baseP.toString());
    }
  }, [useCategoryPricing, categoryId, categories]);

  // Handlers de regras de preço por atacado
  const handleAddPriceRule = () => {
    setPriceRules((prev) => [...prev, { min: 1, price: '0' }]);
    markDirty();
  };

  const handleRuleChange = (index: number, field: 'min' | 'price', value: string) => {
    setPriceRules((prev) => {
      const next = [...prev];
      if (field === 'min') {
        next[index] = { ...next[index], min: Math.max(0, parseInt(value, 10) || 0) };
      } else {
        next[index] = { ...next[index], price: value };
      }
      return next;
    });
    markDirty();
  };

  const handleRemovePriceRule = (index: number) => {
    setPriceRules((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  // Handlers de imagens
  const processFiles = (files: FileList) => {
    if (mediaItems.length + files.length > 4) {
      toast.error('Máximo de 4 imagens por produto');
      return;
    }
    const newItems: FormMediaItem[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 11),
      type: 'file',
      value: file,
      preview: URL.createObjectURL(file),
    }));
    setMediaItems((prev) => [...prev, ...newItems]);
    markDirty();
  };

  const removeMediaItem = (idToRemove: string) => {
    const item = mediaItems.find((i) => i.id === idToRemove);
    if (item && item.type === 'url') {
      setImagesToDelete((prev) => [...prev, item.value as string]);
    }
    setMediaItems((prev) => prev.filter((i) => i.id !== idToRemove));
    markDirty();
  };

  const setMainMediaItem = (index: number) => {
    if (index === 0) return;
    setMediaItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
    markDirty();
  };

  const reorderMediaItems = (oldIndex: number, newIndex: number) => {
    setMediaItems((prev) => arrayMove(prev, oldIndex, newIndex));
    markDirty();
  };

  // Validações locais
  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!name.trim()) {
      errs.name = 'O nome do produto é obrigatório.';
    }

    if (!useCategoryPricing) {
      const parsedPrice = parseFloat(price.replace(',', '.'));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        errs.price = 'Informe um preço válido maior ou igual a zero.';
      }

      if (pricingMode === 'category_volume') {
        const mins = new Set<number>();
        for (const rule of priceRules) {
          if (rule.min < 1) {
            toast.error('A quantidade mínima nas faixas de atacado deve ser maior ou igual a 1.');
            return false;
          }
          const rulePrice = parseFloat(String(rule.price).replace(',', '.'));
          if (isNaN(rulePrice) || rulePrice < 0) {
            toast.error('O preço em cada faixa de atacado deve ser maior ou igual a zero.');
            return false;
          }
          if (mins.has(rule.min)) {
            toast.error(`Não são permitidas faixas duplicadas para a mesma quantidade (${rule.min} un).`);
            return false;
          }
          mins.add(rule.min);
        }
      }
    }

    if (minStock < 0) {
      errs.minStock = 'O estoque mínimo não pode ser negativo.';
    }

    if (maxStock < 0) {
      errs.maxStock = 'O estoque máximo não pode ser negativo.';
    }

    if (minStock > 0 && maxStock > 0 && maxStock < minStock) {
      errs.maxStock = 'O estoque máximo deve ser maior ou igual ao estoque mínimo.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submissão do formulário
  const executeSave = async (
    targetIsEditing: boolean,
    canManage: boolean,
    targetProductId: string
  ): Promise<{ success: boolean; productId?: string }> => {
    if (!validateForm()) {
      toast.error('Verifique os campos com erros antes de salvar.');
      return { success: false };
    }

    if (targetIsEditing && !codesLoaded) {
      toast.error('Aguarde o carregamento dos códigos do produto antes de salvar.');
      return { success: false };
    }

    // Ordenar faixas de atacado por quantidade min
    const sortedPriceRules = [...priceRules]
      .sort((a, b) => a.min - b.min)
      .map((r) => ({ min: r.min, price: Number(r.price) || 0 }));

    let saveSuccess = false;

    await saveProduct({
      productId: targetProductId,
      name: name.trim(),
      description: description.trim(),
      price: price.trim(),
      categoryId: categoryId || null,
      active,
      mediaItems: mediaItems as any,
      imagesToDelete,
      pricingMode: useCategoryPricing ? 'inherit' : 'custom',
      priceLogicType: pricingMode,
      priceRules: sortedPriceRules,
      stockQuantity,
      minStock,
      maxStock,
      productCodes: [
        { type: 'internal', value: internalCode },
        { type: 'sku', value: sku },
        { type: 'ean', value: ean },
      ],
      codesLoaded,
      isEditing: targetIsEditing,
      canManageProducts: canManage,
      onSuccess: () => {
        saveSuccess = true;
      },
      onClose: () => {},
    });

    if (saveSuccess) {
      await logAction(
        targetIsEditing ? 'Editar Produto' : 'Criar Produto',
        { product_id: targetProductId, name: name.trim() },
        'success'
      );
      setIsDirty(false);
      return { success: true, productId: targetProductId };
    } else {
      await logAction(
        targetIsEditing ? 'Editar Produto' : 'Criar Produto',
        { product_id: targetProductId, name: name.trim() },
        'failure'
      );
      return { success: false };
    }
  };

  return {
    values: {
      name,
      description,
      price,
      categoryId,
      active,
      isDiscontinued,
      internalCode,
      sku,
      ean,
      pricingMode,
      useCategoryPricing,
      priceRules,
      minStock,
      maxStock,
      mediaItems,
      imagesToDelete,
    },
    errors,
    isDirty,
    saving,
    setName: updateName,
    setDescription: updateDescription,
    setPrice: updatePrice,
    setCategoryId: updateCategoryId,
    setActive: updateActive,
    setInternalCode: updateInternalCode,
    setSku: updateSku,
    setEan: updateEan,
    setPricingMode: updatePricingMode,
    setUseCategoryPricing: updateUseCategoryPricing,
    setMinStock: updateMinStock,
    setMaxStock: updateMaxStock,
    handleAddPriceRule,
    handleRuleChange,
    handleRemovePriceRule,
    processFiles,
    removeMediaItem,
    setMainMediaItem,
    reorderMediaItems,
    handleSave: executeSave,
  };
}

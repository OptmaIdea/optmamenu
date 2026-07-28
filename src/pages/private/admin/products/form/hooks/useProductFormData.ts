import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type { Category, Product } from '../../products/types/product.types';

export interface UseProductFormDataResult {
  product: Product | null;
  categories: Category[];
  loadingProduct: boolean;
  loadingCategories: boolean;
  notFound: boolean;
  error: string | null;
  codesLoaded: boolean;
  codesLoadError: string | null;
  refetchCategories: () => Promise<void>;
  refetchProduct: () => Promise<void>;
}

export function useProductFormData(productId?: string): UseProductFormDataResult {
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingProduct, setLoadingProduct] = useState<boolean>(Boolean(productId));
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [codesLoaded, setCodesLoaded] = useState<boolean>(!productId);
  const [codesLoadError, setCodesLoadError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const activeStoreId = getActiveStoreId();
      if (!activeStoreId) {
        setCategories([]);
        return;
      }
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name, price_logic_type, price_rules, sort_order, active')
        .eq('store_id', activeStoreId)
        .order('sort_order', { ascending: true });

      if (catError) throw catError;
      if (data) setCategories(data as Category[]);
    } catch (err: any) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setNotFound(false);
      setLoadingProduct(false);
      setCodesLoaded(true);
      setCodesLoadError(null);
      return;
    }

    try {
      setLoadingProduct(true);
      setError(null);
      setNotFound(false);
      setCodesLoaded(false);
      setCodesLoadError(null);

      const activeStoreId = getActiveStoreId();
      if (!activeStoreId) {
        setError('Nenhuma loja ativa selecionada.');
        setNotFound(true);
        setLoadingProduct(false);
        return;
      }

      // Consulta explícita por colunas (sem select('*'))
      const { data, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          store_id,
          category_id,
          name,
          description,
          price,
          active,
          is_discontinued,
          images,
          use_category_pricing,
          price_logic_type,
          price_rules,
          min_stock,
          max_stock,
          product_codes(id, code_type, code_value, normalized_code, is_primary, active),
          category:categories(id, name, price_logic_type, price_rules)
        `)
        .eq('id', productId)
        .eq('store_id', activeStoreId)
        .maybeSingle();

      if (prodError) throw prodError;

      if (!data || (data as any).store_id !== activeStoreId) {
        setProduct(null);
        setNotFound(true);
      } else {
        const rawCodes = Array.isArray((data as any).product_codes)
          ? (data as any).product_codes
          : [];
        setProduct({
          ...((data as unknown) as Product),
          codes: rawCodes.filter((code: any) => code.active !== false),
        });
        setNotFound(false);
        setCodesLoaded(true);
      }
    } catch (err: any) {
      console.error('Erro ao carregar produto para edição:', err);
      setError(err.message || 'Erro ao carregar produto.');
      setCodesLoadError(err.message || 'Não foi possível carregar os códigos do produto.');
      setNotFound(true);
    } finally {
      setLoadingProduct(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    } else {
      setLoadingProduct(false);
      setNotFound(false);
    }
  }, [productId, fetchProduct]);

  return {
    product,
    categories,
    loadingProduct,
    loadingCategories,
    notFound,
    error,
    codesLoaded,
    codesLoadError,
    refetchCategories: fetchCategories,
    refetchProduct: fetchProduct,
  };
}

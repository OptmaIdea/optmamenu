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
      return;
    }

    try {
      setLoadingProduct(true);
      setError(null);
      setNotFound(false);

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
        setProduct((data as unknown) as Product);
        setNotFound(false);
      }
    } catch (err: any) {
      console.error('Erro ao carregar produto para edição:', err);
      setError(err.message || 'Erro ao carregar produto.');
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
    refetchCategories: fetchCategories,
    refetchProduct: fetchProduct,
  };
}

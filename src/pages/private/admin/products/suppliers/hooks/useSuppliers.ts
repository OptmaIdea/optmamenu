import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Supplier, SupplierInput } from '../types/supplier.types';

type StoreLike = { id: string };

const getCurrentStore = async (): Promise<StoreLike | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: storeData, error } = await supabase.rpc('get_user_store_by_id', { p_user_id: user.id });
  if (error || !storeData) return null;
  const store = Array.isArray(storeData) ? storeData[0] : storeData;
  if (!store?.id) return null;

  return { id: store.id };
};

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const activeSuppliers = useMemo(
    () => suppliers.filter(s => s.active),
    [suppliers]
  );

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const store = await getCurrentStore();
      if (!store) return;

      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('store_id', store.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers((data ?? []) as Supplier[]);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error fetching suppliers:', e);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertSupplier = useCallback(async (input: SupplierInput, supplierId?: string) => {
    setSaving(true);
    try {
      const store = await getCurrentStore();
      if (!store) throw new Error('Store not found');

      const payload: Partial<Supplier> = {
        ...(supplierId ? { id: supplierId } : {}),
        store_id: store.id,
        name: input.name.trim(),
        document: input.document?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        active: input.active ?? true,
      };

      const { data, error } = await supabase
        .from('suppliers')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) throw error;

      setSuppliers(prev => {
        const next = prev.filter(s => s.id !== data.id);
        next.push(data as Supplier);
        next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        return next;
      });

      toast.success(supplierId ? 'Fornecedor atualizado' : 'Fornecedor criado');
      setLastUpdated(new Date());
      return data as Supplier;
    } catch (e) {
      console.error('Error saving supplier:', e);
      toast.error('Erro ao salvar fornecedor');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const setSupplierActive = useCallback(async (supplierId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ active })
        .eq('id', supplierId);
      if (error) throw error;

      setSuppliers(prev => prev.map(s => (s.id === supplierId ? { ...s, active } : s)));
      toast.success(active ? 'Fornecedor reativado' : 'Fornecedor desativado');
      setLastUpdated(new Date());
      return true;
    } catch (e) {
      console.error('Error updating supplier:', e);
      toast.error('Erro ao atualizar fornecedor');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return {
    suppliers,
    activeSuppliers,
    loading,
    saving,
    lastUpdated,
    fetchSuppliers,
    upsertSupplier,
    setSupplierActive,
  };
};

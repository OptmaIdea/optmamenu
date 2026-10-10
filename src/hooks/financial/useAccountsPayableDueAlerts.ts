import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AccountsPayableDueAlert {
  installment_id: string;
  payable_id: string;
  payable_code: string;
  description: string;
  installment_number: number;
  due_date: string;
  open_amount: number;
  days_until_due: number;
  is_non_business_due_date?: boolean;
  next_business_date?: string | null;
  urgency: 'overdue' | 'today' | 'upcoming';
}

export function useAccountsPayableDueAlerts(storeId?: string | null) {
  const [items, setItems] = useState<AccountsPayableDueAlert[]>([]);
  const [loading, setLoading] = useState(Boolean(storeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) { setItems([]); setLoading(false); return; }
    let alive = true;
    const load = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('list_accounts_payable_due_alerts_safe', {
          p_store_id: storeId, p_days_ahead: 5,
        });
        if (rpcError) throw rpcError;
        if (!data?.ok) {
          if (data?.error === 'access_denied') { if (alive) setItems([]); return; }
          throw new Error(data?.error || 'Falha ao consultar vencimentos.');
        }
        if (alive) { setItems(Array.isArray(data.items) ? data.items : []); setError(null); }
      } catch (err) {
        if (alive) { setError(err instanceof Error ? err.message : 'Falha ao carregar avisos.'); setItems([]); }
      } finally { if (alive) setLoading(false); }
    };
    setLoading(true);
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [storeId]);
  return { items, loading, error, count: items.length };
}

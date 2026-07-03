import { useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  CashbookDiscrepancyService,
  type CashbookDiscrepancy,
} from '@/services/cashbookDiscrepancyService';

interface CashbookOccurrenceResolutionBoxProps {
  storeId: string | null;
  occurrence: CashbookDiscrepancy;
  canResolve?: boolean;
  onUpdated?: (occurrence: CashbookDiscrepancy) => void;
}

const STATUS_OPTIONS = [
  { value: 'under_review', label: 'Em análise' },
  { value: 'waiting_external_confirmation', label: 'Aguardando confirmação externa' },
  { value: 'resolved', label: 'Resolvida' },
];

export default function CashbookOccurrenceResolutionBox({
  storeId,
  occurrence,
  canResolve = false,
  onUpdated,
}: CashbookOccurrenceResolutionBoxProps) {
  const [status, setStatus] = useState(occurrence.status === 'open' ? 'under_review' : occurrence.status);
  const [notes, setNotes] = useState(occurrence.resolution_notes || '');
  const [saving, setSaving] = useState(false);

  const isFinal = occurrence.status === 'resolved';

  async function submit() {
    if (!storeId) return;

    if (!canResolve) {
      toast.error('Você não tem permissão para atualizar esta ocorrência.');
      return;
    }

    if (status === 'resolved' && !notes.trim()) {
      toast.error('Informe uma observação para resolver a ocorrência.');
      return;
    }

    try {
      setSaving(true);
      const updated = await CashbookDiscrepancyService.resolve({
        storeId,
        occurrenceId: occurrence.id,
        status,
        resolutionType: status,
        resolutionNotes: notes || null,
      });

      toast.success('Ocorrência atualizada.');
      onUpdated?.(updated);
    } catch (error) {
      console.error('Erro ao atualizar ocorrência:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar ocorrência.');
    } finally {
      setSaving(false);
    }
  }

  if (isFinal) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
        <p className="text-[10px] font-black uppercase tracking-widest">Ocorrência resolvida</p>
        {occurrence.resolution_notes && <p className="mt-2">{occurrence.resolution_notes}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
        <CheckCircle2 size={16} />
        <h4 className="text-sm font-black uppercase tracking-widest">Atualizar ocorrência</h4>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!canResolve || saving}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Observação</span>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!canResolve || saving}
            placeholder="Informe o que foi conferido ou resolvido."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!canResolve || saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Atualizar ocorrência
        </button>
      </div>
    </div>
  );
}

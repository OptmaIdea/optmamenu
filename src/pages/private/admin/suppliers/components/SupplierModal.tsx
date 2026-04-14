import { useEffect, useState } from 'react';
import type { Supplier, SupplierInput } from '../types/supplier.types';
import { useSuppliers } from '../hooks/useSuppliers';

interface SupplierModalProps {
  supplier: Supplier | null;  // null = create mode
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function SupplierModal({
  supplier,
  isOpen,
  onClose,
  onSaved,
}: SupplierModalProps) {
  const { saving, saveSupplier } = useSuppliers();

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  // Seed form whenever modal opens or the target supplier changes
  useEffect(() => {
    if (!isOpen) return;
    setName(supplier?.name ?? '');
    setDocument(supplier?.document ?? '');
    setPhone(supplier?.phone ?? '');
    setEmail(supplier?.email ?? '');
    setNotes(supplier?.notes ?? '');
    setActive(supplier?.active ?? true);
  }, [isOpen, supplier?.id]);

  if (!isOpen) return null;

  const isEdit = supplier !== null;
  const title = isEdit ? 'Editar fornecedor' : 'Novo fornecedor';

  const handleSave = async () => {
    if (!name.trim()) return;
    const input: SupplierInput = {
      name: name.trim(),
      document: document.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      active,
    };
    await saveSupplier(input, supplier?.id);
    await onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Dados básicos para identificar a origem das entradas.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Fechar
          </button>
        </div>

        {/* Fields */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Nome *
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Ex: Distribuidora XPTO"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Documento
            </div>
            <input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="CNPJ/CPF (opcional)"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Telefone
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="(xx) xxxxx-xxxx"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              E-mail
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="financeiro@fornecedor.com"
            />
          </label>

          <label className="block md:col-span-2">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Observações
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[80px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Prazo, condições, etc (opcional)"
            />
          </label>

          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Fornecedor ativo
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

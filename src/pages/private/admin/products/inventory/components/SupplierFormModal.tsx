import { useEffect, useState } from 'react';
import {
    BadgeCheck,
    Ban,
    Building2,
    FileText,
    Landmark,
    Truck,
    UserRound,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { SupplierFormValues } from '../types/supplierForm.types';
import {
    emptySupplierFormValues,
    supplierFormValuesToPayload,
    supplierToFormValues,
} from '../utils/supplierFormUtils';

type SupplierFormModalProps = {
    open: boolean;
    mode: 'create' | 'edit';
    supplier?: Record<string, any> | null;
    onClose: () => void;
    onSubmit: (payload: Record<string, any>) => Promise<void> | void;
};

type SectionKey =
    | 'basic'
    | 'fiscal'
    | 'contacts'
    | 'commercial'
    | 'financial'
    | 'status';

const sections: Array<{
    key: SectionKey;
    label: string;
    icon: React.ElementType;
}> = [
        { key: 'basic', label: 'Identificação', icon: Building2 },
        { key: 'fiscal', label: 'Fiscal / legal', icon: FileText },
        { key: 'contacts', label: 'Contatos', icon: UserRound },
        { key: 'commercial', label: 'Comercial / logística', icon: Truck },
        { key: 'financial', label: 'Financeiro', icon: Landmark },
        { key: 'status', label: 'Status', icon: BadgeCheck },
    ];

function Field({
    label,
    children,
    required,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
}) {
    return (
        <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
                {required ? ' *' : ''}
            </span>
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

const textareaClass =
    'min-h-[84px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

export function SupplierFormModal({
    open,
    mode,
    supplier,
    onClose,
    onSubmit,
}: SupplierFormModalProps) {
    const [activeSection, setActiveSection] = useState<SectionKey>('basic');
    const [values, setValues] = useState<SupplierFormValues>(emptySupplierFormValues);
    const [saving, setSaving] = useState(false);
    const headerSupplierName =
        mode === 'edit'
            ? values.name.trim() || values.trade_name.trim() || supplier?.name || 'Fornecedor sem nome'
            : '';

    useEffect(() => {
        if (!open) return;

        setActiveSection('basic');
        setValues(supplierToFormValues(supplier));
    }, [open, supplier]);

    if (!open) return null;

    const update = <K extends keyof SupplierFormValues>(
        key: K,
        value: SupplierFormValues[K],
    ) => {
        setValues((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const updateNumber = (
        key:
            | 'average_payment_days'
            | 'minimum_order_value'
            | 'delivery_days'
            | 'lead_time_days'
            | 'credit_limit',
        rawValue: string,
    ) => {
        update(key, rawValue === '' ? '' : Number(rawValue));
    };

    const handleSubmit = async () => {
        if (!values.name.trim()) {
            toast.warning('Informe o nome do fornecedor.');
            setActiveSection('basic');
            return;
        }

        if (values.blocked && !values.blocked_reason.trim()) {
            toast.warning('Informe o motivo do bloqueio do fornecedor.');
            setActiveSection('status');
            return;
        }

        setSaving(true);

        try {
            await onSubmit(supplierFormValuesToPayload(values));
            onClose();
        } catch (error) {
            console.error('Erro ao salvar fornecedor:', error);
            toast.error('Não foi possível salvar o fornecedor.');
        } finally {
            setSaving(false);
        }
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'basic':
                return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Nome / apelido interno" required>
                            <input
                                className={inputClass}
                                value={values.name}
                                onChange={(event) => update('name', event.target.value)}
                                placeholder="Ex: Distribuidora XPTO"
                            />
                        </Field>

                        <Field label="Documento">
                            <input
                                className={inputClass}
                                value={values.document}
                                onChange={(event) => update('document', event.target.value)}
                                placeholder="CNPJ, CPF ou documento externo"
                            />
                        </Field>

                        <Field label="Razão social">
                            <input
                                className={inputClass}
                                value={values.legal_name}
                                onChange={(event) => update('legal_name', event.target.value)}
                            />
                        </Field>

                        <Field label="Nome fantasia">
                            <input
                                className={inputClass}
                                value={values.trade_name}
                                onChange={(event) => update('trade_name', event.target.value)}
                            />
                        </Field>

                        <Field label="Tipo de pessoa">
                            <select
                                className={inputClass}
                                value={values.person_type}
                                onChange={(event) => update('person_type', event.target.value as any)}
                            >
                                <option value="">Não informado</option>
                                <option value="PJ">Pessoa jurídica</option>
                                <option value="PF">Pessoa física</option>
                                <option value="OUTRO">Outro / exterior</option>
                            </select>
                        </Field>

                        <Field label="Telefone principal">
                            <input
                                className={inputClass}
                                value={values.phone}
                                onChange={(event) => update('phone', event.target.value)}
                            />
                        </Field>

                        <Field label="Telefone secundário">
                            <input
                                className={inputClass}
                                value={values.secondary_phone}
                                onChange={(event) => update('secondary_phone', event.target.value)}
                            />
                        </Field>

                        <Field label="E-mail">
                            <input
                                className={inputClass}
                                value={values.email}
                                onChange={(event) => update('email', event.target.value)}
                            />
                        </Field>

                        <Field label="Site">
                            <input
                                className={inputClass}
                                value={values.website}
                                onChange={(event) => update('website', event.target.value)}
                                placeholder="https://..."
                            />
                        </Field>

                        <div className="md:col-span-2">
                            <Field label="Observações gerais">
                                <textarea
                                    className={textareaClass}
                                    value={values.notes}
                                    onChange={(event) => update('notes', event.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                );

            case 'fiscal':
                return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Inscrição estadual">
                            <input
                                className={inputClass}
                                value={values.state_registration}
                                onChange={(event) => update('state_registration', event.target.value)}
                            />
                        </Field>

                        <Field label="Inscrição municipal">
                            <input
                                className={inputClass}
                                value={values.municipal_registration}
                                onChange={(event) => update('municipal_registration', event.target.value)}
                            />
                        </Field>

                        <Field label="Regime tributário">
                            <input
                                className={inputClass}
                                value={values.tax_regime}
                                onChange={(event) => update('tax_regime', event.target.value)}
                                placeholder="Simples Nacional, Lucro Presumido..."
                            />
                        </Field>

                        <Field label="CNAE">
                            <input
                                className={inputClass}
                                value={values.cnae_code}
                                onChange={(event) => update('cnae_code', event.target.value)}
                            />
                        </Field>

                        <Field label="Indicador ICMS">
                            <input
                                className={inputClass}
                                value={values.icms_taxpayer_indicator}
                                onChange={(event) => update('icms_taxpayer_indicator', event.target.value)}
                            />
                        </Field>

                        <div className="md:col-span-2">
                            <Field label="Observações fiscais">
                                <textarea
                                    className={textareaClass}
                                    value={values.fiscal_notes}
                                    onChange={(event) => update('fiscal_notes', event.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                );

            case 'contacts':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Contato comercial
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Nome">
                                    <input className={inputClass} value={values.commercial_contact_name} onChange={(event) => update('commercial_contact_name', event.target.value)} />
                                </Field>
                                <Field label="Cargo">
                                    <input className={inputClass} value={values.commercial_contact_role} onChange={(event) => update('commercial_contact_role', event.target.value)} />
                                </Field>
                                <Field label="Telefone">
                                    <input className={inputClass} value={values.commercial_phone} onChange={(event) => update('commercial_phone', event.target.value)} />
                                </Field>
                                <Field label="WhatsApp">
                                    <input className={inputClass} value={values.commercial_whatsapp} onChange={(event) => update('commercial_whatsapp', event.target.value)} />
                                </Field>
                                <Field label="E-mail">
                                    <input className={inputClass} value={values.commercial_email} onChange={(event) => update('commercial_email', event.target.value)} />
                                </Field>
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Contato financeiro
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <Field label="Nome">
                                    <input className={inputClass} value={values.financial_contact_name} onChange={(event) => update('financial_contact_name', event.target.value)} />
                                </Field>
                                <Field label="Telefone">
                                    <input className={inputClass} value={values.financial_phone} onChange={(event) => update('financial_phone', event.target.value)} />
                                </Field>
                                <Field label="E-mail">
                                    <input className={inputClass} value={values.financial_email} onChange={(event) => update('financial_email', event.target.value)} />
                                </Field>
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Contato fiscal
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <Field label="Nome">
                                    <input className={inputClass} value={values.fiscal_contact_name} onChange={(event) => update('fiscal_contact_name', event.target.value)} />
                                </Field>
                                <Field label="Telefone">
                                    <input className={inputClass} value={values.fiscal_phone} onChange={(event) => update('fiscal_phone', event.target.value)} />
                                </Field>
                                <Field label="E-mail">
                                    <input className={inputClass} value={values.fiscal_email} onChange={(event) => update('fiscal_email', event.target.value)} />
                                </Field>
                            </div>
                        </div>
                    </div>
                );

            case 'commercial':
                return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Condição de pagamento">
                            <input
                                className={inputClass}
                                value={values.payment_terms}
                                onChange={(event) => update('payment_terms', event.target.value)}
                                placeholder="Ex: 14 dias, boleto, pix antecipado..."
                            />
                        </Field>

                        <Field label="Prazo médio pagamento (dias)">
                            <input
                                type="number"
                                className={inputClass}
                                value={values.average_payment_days}
                                onChange={(event) => updateNumber('average_payment_days', event.target.value)}
                            />
                        </Field>

                        <Field label="Pedido mínimo">
                            <input
                                type="number"
                                step="0.01"
                                className={inputClass}
                                value={values.minimum_order_value}
                                onChange={(event) => updateNumber('minimum_order_value', event.target.value)}
                            />
                        </Field>

                        <Field label="Política de frete">
                            <input
                                className={inputClass}
                                value={values.freight_policy}
                                onChange={(event) => update('freight_policy', event.target.value)}
                            />
                        </Field>

                        <Field label="Prazo de entrega (dias)">
                            <input
                                type="number"
                                className={inputClass}
                                value={values.delivery_days}
                                onChange={(event) => updateNumber('delivery_days', event.target.value)}
                            />
                        </Field>

                        <Field label="Lead time operacional (dias)">
                            <input
                                type="number"
                                className={inputClass}
                                value={values.lead_time_days}
                                onChange={(event) => updateNumber('lead_time_days', event.target.value)}
                            />
                        </Field>

                        <Field label="Frequência de compra">
                            <input
                                className={inputClass}
                                value={values.purchase_frequency}
                                onChange={(event) => update('purchase_frequency', event.target.value)}
                                placeholder="Semanal, quinzenal, mensal..."
                            />
                        </Field>

                        <div className="md:col-span-2">
                            <Field label="Condições comerciais">
                                <textarea
                                    className={textareaClass}
                                    value={values.commercial_terms}
                                    onChange={(event) => update('commercial_terms', event.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                );

            case 'financial':
                return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Limite de crédito">
                            <input
                                type="number"
                                step="0.01"
                                className={inputClass}
                                value={values.credit_limit}
                                onChange={(event) => updateNumber('credit_limit', event.target.value)}
                            />
                        </Field>

                        <Field label="Favorecido">
                            <input
                                className={inputClass}
                                value={values.beneficiary_name}
                                onChange={(event) => update('beneficiary_name', event.target.value)}
                            />
                        </Field>

                        <Field label="Tipo de chave Pix">
                            <input
                                className={inputClass}
                                value={values.pix_key_type}
                                onChange={(event) => update('pix_key_type', event.target.value)}
                                placeholder="CPF, CNPJ, e-mail, telefone, aleatória"
                            />
                        </Field>

                        <Field label="Chave Pix">
                            <input
                                className={inputClass}
                                value={values.pix_key}
                                onChange={(event) => update('pix_key', event.target.value)}
                            />
                        </Field>

                        <Field label="Banco">
                            <input className={inputClass} value={values.bank_name} onChange={(event) => update('bank_name', event.target.value)} />
                        </Field>

                        <Field label="Agência">
                            <input className={inputClass} value={values.bank_agency} onChange={(event) => update('bank_agency', event.target.value)} />
                        </Field>

                        <Field label="Conta">
                            <input className={inputClass} value={values.bank_account} onChange={(event) => update('bank_account', event.target.value)} />
                        </Field>

                        <Field label="Tipo de conta">
                            <input className={inputClass} value={values.bank_account_type} onChange={(event) => update('bank_account_type', event.target.value)} />
                        </Field>
                    </div>
                );

            case 'status':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Status de homologação">
                                <select
                                    className={inputClass}
                                    value={values.homologation_status}
                                    onChange={(event) => update('homologation_status', event.target.value as any)}
                                    disabled={values.blocked}
                                >
                                    <option value="not_evaluated">Não avaliado</option>
                                    <option value="pending">Em análise</option>
                                    <option value="approved">Aprovado</option>
                                    <option value="rejected">Reprovado</option>
                                    <option value="blocked">Bloqueado</option>
                                </select>
                            </Field>

                            <Field label="Tags">
                                <input
                                    className={inputClass}
                                    value={values.tags_text}
                                    onChange={(event) => update('tags_text', event.target.value)}
                                    placeholder="separe por vírgula"
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <label className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                                <input
                                    type="checkbox"
                                    checked={values.active}
                                    onChange={(event) => update('active', event.target.checked)}
                                />
                                Fornecedor ativo
                            </label>

                            <label className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                                <input
                                    type="checkbox"
                                    checked={values.preferred_supplier}
                                    onChange={(event) => update('preferred_supplier', event.target.checked)}
                                />
                                Fornecedor preferencial
                            </label>

                            <label className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20">
                                <input
                                    type="checkbox"
                                    checked={values.blocked}
                                    onChange={(event) => update('blocked', event.target.checked)}
                                />
                                <Ban size={15} />
                                Bloqueio operacional
                            </label>
                        </div>

                        {values.blocked && (
                            <Field label="Motivo do bloqueio">
                                <textarea
                                    className={textareaClass}
                                    value={values.blocked_reason}
                                    onChange={(event) => update('blocked_reason', event.target.value)}
                                />
                            </Field>
                        )}

                        <Field label="Notas de relacionamento">
                            <textarea
                                className={textareaClass}
                                value={values.relationship_notes}
                                onChange={(event) => update('relationship_notes', event.target.value)}
                            />
                        </Field>

                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                            <strong>Importante:</strong> &quot;Inativo&quot; remove o fornecedor do uso operacional,
                            mas preserva o histórico. &quot;Bloqueio operacional&quot; é uma trava forte que impede novas compras.
                            &quot;Rejeitado&quot; impede novas compras, mas não apaga compras antigas.
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-950">
                <div className="flex items-start gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {mode === 'create' ? 'Novo fornecedor' : 'Editar fornecedor'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Cadastro completo para compras, fiscal, financeiro e relacionamento.
                        </p>
                    </div>

                    {headerSupplierName && (
                        <div className="ml-auto max-w-[42%] rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right dark:border-emerald-900/50 dark:bg-emerald-950/30">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                Fornecedor em edição
                            </div>
                            <div className="truncate text-sm font-bold text-gray-900 dark:text-white" title={headerSupplierName}>
                                {headerSupplierName}
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr]">
                    <aside className="border-b border-gray-100 p-3 dark:border-gray-800 md:border-b-0 md:border-r">
                        <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
                            {sections.map((section) => {
                                const Icon = section.icon;
                                const active = activeSection === section.key;

                                return (
                                    <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => setActiveSection(section.key)}
                                        className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${active
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {section.label}
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <main className="min-h-0 overflow-y-auto p-5">
                        {renderSection()}
                    </main>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        disabled={saving || !values.name.trim()}
                        onClick={() => void handleSubmit()}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Salvando...' : 'Salvar fornecedor'}
                    </button>
                </div>
            </div>
        </div>
    );
}

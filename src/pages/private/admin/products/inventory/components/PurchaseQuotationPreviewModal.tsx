import { Copy, FileText, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';

type PurchaseQuotationPreviewItem = {
    productId: string;
    productName: string;
    quantity: number;
    unitCost?: number | null;
    notes?: string | null;
};

type PurchaseQuotationPreviewModalProps = {
    open: boolean;
    supplierName: string;
    supplierPhone?: string | null;
    supplierEmail?: string | null;
    items: PurchaseQuotationPreviewItem[];
    onClose: () => void;
};

function formatCurrency(value: number | null | undefined) {
    if (value == null || Number.isNaN(Number(value))) return '—';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value));
}

function buildQuotationText(
    supplierName: string,
    items: PurchaseQuotationPreviewItem[],
) {
    const lines = items.map((item, index) => {
        const estimatedCost =
            item.unitCost != null && Number(item.unitCost) > 0
                ? ` | último custo estimado: ${formatCurrency(item.unitCost)}`
                : '';

        return `${index + 1}. ${item.productName} — ${item.quantity} un.${estimatedCost}`;
    });

    return [
        `Olá, tudo bem?`,
        ``,
        `Segue solicitação de cotação para ${supplierName}:`,
        ``,
        ...lines,
        ``,
        `Por gentileza, informar:`,
        `- preço unitário`,
        `- prazo de entrega`,
        `- condição de pagamento`,
        `- disponibilidade dos itens`,
        ``,
        `Obrigado.`,
    ].join('\n');
}

export function PurchaseQuotationPreviewModal({
    open,
    supplierName,
    supplierPhone,
    supplierEmail,
    items,
    onClose,
}: PurchaseQuotationPreviewModalProps) {
    if (!open) return null;

    const quotationText = buildQuotationText(supplierName, items);

    const whatsappUrl = supplierPhone
        ? `https://wa.me/55${supplierPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
            quotationText,
        )}`
        : null;

    const mailtoUrl = supplierEmail
        ? `mailto:${supplierEmail}?subject=${encodeURIComponent(
            `Solicitação de cotação - ${supplierName}`,
        )}&body=${encodeURIComponent(quotationText)}`
        : null;

    async function handleCopy() {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(quotationText);
                toast.success('Texto da cotação copiado.');
                return;
            }

            const textarea = document.createElement('textarea');
            textarea.value = quotationText;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';

            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (!copied) {
                throw new Error('Fallback copy failed');
            }

            toast.success('Texto da cotação copiado.');
        } catch (error) {
            console.error('Erro ao copiar texto da cotação:', error);
            toast.error('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
        }
    }

    function handleDownloadTxt() {
        const blob = new Blob([quotationText], {
            type: 'text/plain;charset=utf-8',
        });

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `cotacao_${supplierName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')}.txt`;

        anchor.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Lista de cotação
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Revise os itens antes de enviar ao fornecedor.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-5">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase text-slate-500">
                            Fornecedor
                        </div>
                        <div className="mt-1 text-base font-semibold text-slate-900">
                            {supplierName}
                        </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Produto</th>
                                    <th className="px-4 py-3 text-right">Quantidade</th>
                                    <th className="px-4 py-3 text-right">Custo estimado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((item) => (
                                    <tr key={item.productId}>
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {item.productName}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.quantity} un.
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatCurrency(item.unitCost)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                            Texto pronto
                        </div>
                        <textarea
                            readOnly
                            value={quotationText}
                            className="min-h-[240px] w-full resize-none rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700 outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t p-5">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <Copy size={16} />
                        Copiar texto
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadTxt}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <FileText size={16} />
                        Baixar TXT
                    </button>

                    {mailtoUrl && (
                        <a
                            href={mailtoUrl}
                            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            E-mail
                        </a>
                    )}

                    {whatsappUrl && (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                            <MessageCircle size={16} />
                            WhatsApp
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
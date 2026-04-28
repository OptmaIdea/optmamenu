import {
    Copy,
    FileText,
    MessageCircle,
    Printer,
    ShoppingCart,
    X,
} from 'lucide-react';
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
    onCreateDraft?: () => Promise<void> | void;
    creatingDraft?: boolean;

    onSaveQuotation?: (payload: {
        messageSubject: string;
        messageBody: string;
        sentChannel: 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | null;
    }) => Promise<void> | void;
    savingQuotation?: boolean;
    savedQuotationCode?: string | null;
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
    const today = new Intl.DateTimeFormat('pt-BR').format(new Date());

    const lines = items.map((item, index) => {
        const estimatedCost =
            item.unitCost != null && Number(item.unitCost) > 0
                ? ` | referência interna: ${formatCurrency(item.unitCost)}`
                : '';

        return `${index + 1}. ${item.productName} — ${item.quantity} un.${estimatedCost}`;
    });

    return [
        `Olá, tudo bem?`,
        ``,
        `Solicito cotação para os itens abaixo.`,
        ``,
        `Fornecedor: ${supplierName}`,
        `Data da solicitação: ${today}`,
        ``,
        `Produtos:`,
        ...lines,
        ``,
        `Por gentileza, informar:`,
        `- preço unitário`,
        `- disponibilidade dos itens`,
        `- prazo de entrega`,
        `- condição de pagamento`,
        `- validade da proposta`,
        ``,
        `Observação: os valores de referência, quando exibidos, são apenas históricos internos e podem ser atualizados conforme sua cotação.`,
        ``,
        `Obrigado.`,
    ].join('\n');
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function buildQuotationHtml(
    supplierName: string,
    supplierPhone: string | null | undefined,
    supplierEmail: string | null | undefined,
    items: PurchaseQuotationPreviewItem[],
) {
    const today = new Intl.DateTimeFormat('pt-BR').format(new Date());

    const rows = items
        .map((item, index) => {
            return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="right">${item.quantity} un.</td>
          <td class="right">${formatCurrency(item.unitCost)}</td>
          <td></td>
          <td></td>
        </tr>
      `;
        })
        .join('');

    return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Cotação - ${escapeHtml(supplierName)}</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 32px;
            font-size: 13px;
          }

          .header {
            border-bottom: 2px solid #0f766e;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }

          h1 {
            margin: 0;
            font-size: 22px;
          }

          .subtitle {
            margin-top: 6px;
            color: #475569;
          }

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }

          .box {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
          }

          .label {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
            margin-bottom: 4px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
          }

          th {
            background: #f1f5f9;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            color: #475569;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px;
            vertical-align: top;
          }

          .right {
            text-align: right;
          }

          .notes {
            margin-top: 20px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
            color: #475569;
          }

          .footer {
            margin-top: 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }

          .signature {
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            text-align: center;
            color: #475569;
          }

          @media print {
            body {
              margin: 20mm;
            }

            button {
              display: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="header">
          <h1>Solicitação de cotação</h1>
          <div class="subtitle">
            Documento operacional para consulta de preços, disponibilidade e prazo.
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="label">Fornecedor</div>
            <div><strong>${escapeHtml(supplierName)}</strong></div>
          </div>

          <div class="box">
            <div class="label">Data da solicitação</div>
            <div>${today}</div>
          </div>

          <div class="box">
            <div class="label">WhatsApp / telefone</div>
            <div>${escapeHtml(supplierPhone || 'Não informado')}</div>
          </div>

          <div class="box">
            <div class="label">E-mail</div>
            <div>${escapeHtml(supplierEmail || 'Não informado')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Produto</th>
              <th class="right">Quantidade</th>
              <th class="right">Referência interna</th>
              <th>Preço cotado</th>
              <th>Observações do fornecedor</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="notes">
          <strong>Solicitamos informar:</strong>
          preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.
          <br /><br />
          Os valores de referência, quando preenchidos, são históricos internos e não representam limite obrigatório para cotação.
        </div>

        <div class="footer">
          <div class="signature">Responsável pela cotação</div>
          <div class="signature">Fornecedor</div>
        </div>
      </body>
    </html>
  `;
}

export function PurchaseQuotationPreviewModal({
    open,
    supplierName,
    supplierPhone,
    supplierEmail,
    items,
    onClose,
    onCreateDraft,
    creatingDraft = false,
    onSaveQuotation,
    savingQuotation = false,
    savedQuotationCode = null,
}: PurchaseQuotationPreviewModalProps) {
    if (!open) return null;

    const quotationText = buildQuotationText(supplierName, items);

    const quotationSubject = `Solicitação de cotação - ${supplierName}`;

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

    function handlePrintPdf() {
        const html = buildQuotationHtml(
            supplierName,
            supplierPhone,
            supplierEmail,
            items,
        );

        const printWindow = window.open('', '_blank', 'width=900,height=700');

        if (!printWindow) {
            toast.error('Não foi possível abrir a janela de impressão.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
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

                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Esta cotação não movimenta estoque. O estoque só será alterado depois que um
                            documento de compra for criado e confirmado.
                        </div>

                        {savedQuotationCode && (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                Cotação salva como <strong>{savedQuotationCode}</strong>.
                            </div>
                        )}
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
                    {onSaveQuotation && (
                        <button
                            type="button"
                            onClick={() =>
                                void onSaveQuotation({
                                    messageSubject: quotationSubject,
                                    messageBody: quotationText,
                                    sentChannel: null,
                                })
                            }
                            disabled={savingQuotation}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FileText size={16} />
                            {savingQuotation ? 'Salvando...' : 'Salvar cotação'}
                        </button>
                    )}

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

                    <button
                        type="button"
                        onClick={handlePrintPdf}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <Printer size={16} />
                        Imprimir / PDF
                    </button>

                    {mailtoUrl ? (
                        <a
                            href={mailtoUrl}
                            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            E-mail
                        </a>
                    ) : (
                        <button
                            type="button"
                            disabled
                            title="Fornecedor sem e-mail cadastrado"
                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-slate-400 opacity-60"
                        >
                            E-mail indisponível
                        </button>
                    )}

                    {whatsappUrl ? (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                            <MessageCircle size={16} />
                            WhatsApp
                        </a>
                    ) : (
                        <button
                            type="button"
                            disabled
                            title="Fornecedor sem WhatsApp/telefone cadastrado"
                            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500 opacity-70"
                        >
                            <MessageCircle size={16} />
                            WhatsApp indisponível
                        </button>
                    )}

                    {onCreateDraft && (
                        <button
                            type="button"
                            onClick={onCreateDraft}
                            disabled={creatingDraft}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <ShoppingCart size={16} />
                            {creatingDraft ? 'Criando...' : 'Criar rascunho'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
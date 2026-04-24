import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Product } from '../types/product.types';

export type ExportFormat = 'json' | 'csv' | 'txt';

const getStockStatus = (product: Product) => {
    const onHand = product.display_on_hand ?? product.stock_quantity ?? 0;
    const available = product.display_available ?? product.stock_quantity ?? 0;

    if (!product.active) return 'inativo';
    if (available <= 0) return 'zerado';
    if (available <= product.min_stock) return 'baixo';
    if (onHand > product.max_stock) return 'excesso';
    return 'normal';
};

export const useExport = () => {
    const exportData = useCallback((products: Product[], format: ExportFormat = 'json') => {
        try {
            if (!products.length) {
                toast.warning('Nenhum produto para exportar');
                return;
            }

            const data = products.map((p) => {
                const onHand = p.display_on_hand ?? p.stock_quantity ?? 0;
                const reserved = p.display_reserved ?? 0;
                const available = p.display_available ?? p.stock_quantity ?? 0;

                return {
                    id: p.id,
                    name: p.name,
                    description: p.description || '',
                    price: p.price,
                    category: p.category?.name || '',
                    stock_on_hand: onHand,
                    stock_reserved: reserved,
                    stock_available: available,
                    min_stock: p.min_stock,
                    max_stock: p.max_stock,
                    stock_status: getStockStatus(p),
                    active: p.active ? 'Sim' : 'Não',
                    images: p.images?.length || 0,
                };
            });

            let content: string;
            let mimeType: string;
            let extension: string;

            switch (format) {
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                    extension = 'json';
                    break;

                case 'csv': {
                    const delimiter = ';';
                    const formatNumberPtBr = (value: number) =>
                        new Intl.NumberFormat('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        }).format(value);

                    const headers = [
                        'Nome',
                        'Descrição',
                        'Preço',
                        'Categoria',
                        'Estoque Físico',
                        'Reservado',
                        'Disponível',
                        'Mínimo',
                        'Máximo',
                        'Status Estoque',
                        'Ativo',
                        'Imagens',
                    ];

                    const rows = data.map((p) => [
                        p.name,
                        p.description,
                        formatNumberPtBr(p.price),
                        p.category,
                        String(p.stock_on_hand),
                        String(p.stock_reserved),
                        String(p.stock_available),
                        String(p.min_stock),
                        String(p.max_stock),
                        p.stock_status,
                        p.active,
                        String(p.images),
                    ]);

                    const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

                    content = '\uFEFF' + [
                        headers.map(escapeCsv).join(delimiter),
                        ...rows.map((row) => row.map(escapeCsv).join(delimiter)),
                    ].join('\n');

                    mimeType = 'text/csv;charset=utf-8;';
                    extension = 'csv';
                    break;
                }

                case 'txt':
                    content = data
                        .map(
                            (p) =>
                                `Nome: ${p.name}\n` +
                                `Descrição: ${p.description}\n` +
                                `Preço: R$ ${p.price.toFixed(2)}\n` +
                                `Categoria: ${p.category}\n` +
                                `Estoque físico: ${p.stock_on_hand}\n` +
                                `Reservado: ${p.stock_reserved}\n` +
                                `Disponível: ${p.stock_available}\n` +
                                `Mínimo: ${p.min_stock}\n` +
                                `Máximo: ${p.max_stock}\n` +
                                `Status de estoque: ${p.stock_status}\n` +
                                `Ativo: ${p.active}\n` +
                                `Imagens: ${p.images}\n` +
                                `---`
                        )
                        .join('\n\n');

                    mimeType = 'text/plain;charset=utf-8;';
                    extension = 'txt';
                    break;

                default:
                    return;
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `produtos_${new Date().toISOString().slice(0, 10)}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Exportado como ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Erro ao exportar dados');
        }
    }, []);

    return { exportData };
};
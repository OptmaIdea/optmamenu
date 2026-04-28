import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Product } from '../types/product.types';

export type ExportFormat = 'json' | 'csv' | 'txt';

export const useExport = () => {
    const exportData = useCallback((products: Product[], format: ExportFormat = 'json') => {
        try {
            if (!products.length) {
                toast.warning('Nenhum produto para exportar');
                return;
            }

            const data = products.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                price: p.price,
                category: p.category?.name || '',
                active: p.active,
                images: p.images,
                display_on_hand: p.display_on_hand,
                display_reserved: p.display_reserved,
                display_available: p.display_available,
                global_on_hand: p.global_on_hand,
                global_reserved: p.global_reserved,
                global_available: p.global_available,
                global_min_stock: p.global_min_stock,
                global_max_stock: p.global_max_stock,
                global_status: p.global_status,
                recommended_action: p.recommended_action,
                location_stockout_count: p.location_stockout_count,
                location_critical_count: p.location_critical_count,
                possible_source_locations: p.possible_source_locations,
                min_stock: p.min_stock,
                max_stock: p.max_stock,
            }));

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

                    const globalStatusLabelMap: Record<string, string> = {
                        product_inactive: 'Produto inativo',
                        global_stockout: 'Ruptura global',
                        global_critical: 'Crítico global',
                        global_attention: 'Atenção global',
                        global_excess: 'Excesso global',
                        global_ok: 'Global OK',
                    };

                    const actionLabelMap: Record<string, string> = {
                        buy: 'Comprar',
                        transfer: 'Transferir',
                        transfer_or_redistribute: 'Transferir',
                        monitor: 'Monitorar',
                        review_excess: 'Revisar excesso',
                        ok: 'OK',
                    };

                    const headers = [
                        'Nome',
                        'Descrição',
                        'Preço',
                        'Categoria',
                        'Estoque físico global',
                        'Reservado global',
                        'Disponível global',
                        'Mínimo global',
                        'Máximo global',
                        'Status global',
                        'Ação gerencial',
                        'Locais sem estoque',
                        'Locais críticos',
                        'Origens possíveis',
                        'Ativo',
                        'Imagens',
                    ];

                    const rows = data.map((p) => [
                        p.name,
                        p.description,
                        formatNumberPtBr(Number(p.price ?? 0)),
                        p.category,
                        formatNumberPtBr(Number(p.display_on_hand ?? p.global_on_hand ?? 0)),
                        formatNumberPtBr(Number(p.display_reserved ?? p.global_reserved ?? 0)),
                        formatNumberPtBr(Number(p.display_available ?? p.global_available ?? 0)),
                        formatNumberPtBr(Number(p.global_min_stock ?? p.min_stock ?? 0)),
                        formatNumberPtBr(Number(p.global_max_stock ?? p.max_stock ?? 0)),
                        globalStatusLabelMap[p.global_status ?? ''] ?? p.global_status ?? '',
                        actionLabelMap[p.recommended_action ?? ''] ?? p.recommended_action ?? '',
                        String(p.location_stockout_count ?? 0),
                        String(p.location_critical_count ?? 0),
                        String(p.possible_source_locations ?? 0),
                        p.active ? 'Sim' : 'Não',
                        String(Array.isArray(p.images) ? p.images.length : p.images ?? 0),
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
                                `Preço: R$ ${Number(p.price ?? 0).toFixed(2)}\n` +
                                `Categoria: ${p.category}\n` +
                                `Físico global: ${p.display_on_hand ?? p.global_on_hand ?? 0}\n` +
                                `Reservado global: ${p.display_reserved ?? p.global_reserved ?? 0}\n` +
                                `Disponível global: ${p.display_available ?? p.global_available ?? 0}\n` +
                                `Mínimo global: ${p.global_min_stock ?? p.min_stock ?? 0}\n` +
                                `Máximo global: ${p.global_max_stock ?? p.max_stock ?? 0}\n` +
                                `Status global: ${p.global_status ?? ''}\n` +
                                `Ação gerencial: ${p.recommended_action ?? ''}\n` +
                                `Locais sem estoque: ${p.location_stockout_count ?? 0}\n` +
                                `Locais críticos: ${p.location_critical_count ?? 0}\n` +
                                `Origens possíveis: ${p.possible_source_locations ?? 0}\n` +
                                `Ativo: ${p.active ? 'Sim' : 'Não'}\n` +
                                `Imagens: ${Array.isArray(p.images) ? p.images.length : p.images ?? 0}\n` +
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
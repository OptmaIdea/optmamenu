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
                stock: p.stock_quantity,
                min_stock: p.min_stock,
                max_stock: p.max_stock,
                active: p.active ? 'Sim' : 'Não',
                images: p.images?.length || 0,
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
                case 'csv':
                    const headers = [
                        'Nome',
                        'Descrição',
                        'Preço',
                        'Categoria',
                        'Estoque',
                        'Mínimo',
                        'Máximo',
                        'Ativo',
                        'Imagens',
                    ];
                    const rows = data.map((p) => [
                        p.name,
                        p.description,
                        p.price.toFixed(2),
                        p.category,
                        p.stock.toString(),
                        p.min_stock.toString(),
                        p.max_stock.toString(),
                        p.active,
                        p.images.toString(),
                    ]);
                    content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                    mimeType = 'text/csv;charset=utf-8;';
                    extension = 'csv';
                    break;
                case 'txt':
                    content = data
                        .map(
                            (p) =>
                                `Nome: ${p.name}\n` +
                                `Descrição: ${p.description}\n` +
                                `Preço: R$ ${p.price.toFixed(2)}\n` +
                                `Categoria: ${p.category}\n` +
                                `Estoque: ${p.stock}\n` +
                                `Mínimo: ${p.min_stock}\n` +
                                `Máximo: ${p.max_stock}\n` +
                                `Ativo: ${p.active}\n` +
                                `Imagens: ${p.images}\n` +
                                `---`
                        )
                        .join('\n\n');
                    mimeType = 'text/plain;charset=utf-8;';
                    extension = 'txt';
                    break;
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
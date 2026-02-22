import { forwardRef } from 'react';
import type { Product } from '../types/product.types';

interface PrintableReportProps {
    products: Product[];
    title: string;
    storeName?: string;
    printedBy?: string;
    grouped?: boolean;
    groupBy?: 'category' | 'stockStatus';
}

const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
    (
        {
            products,
            title,
            storeName = 'Minha Loja',
            printedBy = 'Admin',
            grouped = false,
            groupBy = 'category',
        },
        ref
    ) => {
        const getStockStatusLabel = (product: Product) => {
            if (!product.active) return 'inativo';
            if (product.stock_quantity === 0) return 'zerado';
            if (product.stock_quantity <= product.min_stock) return 'baixo';
            if (product.stock_quantity > product.max_stock) return 'excesso';
            return 'normal';
        };

        const currentDate = new Date().toLocaleDateString('pt-BR');
        const currentTime = new Date().toLocaleTimeString('pt-BR');

        return (
            <div
                ref={ref}
                style={{
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: '10pt',
                    lineHeight: '1.4',
                    padding: 0,
                    margin: 0,
                    width: '100%',
                    backgroundColor: 'white',
                }}
            >
                {/* Cabeçalho do Relatório */}
                <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '5px' }}>
                        {storeName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>Relatório de estoque: {title}</span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '8pt',
                            color: '#666',
                        }}
                    >
                        <span>Impresso por: {printedBy}</span>
                        <span>Gerado em: {currentDate} às {currentTime}</span>
                    </div>
                </div>

                {/* Conteúdo – Lista de Produtos */}
                {!grouped ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #aaa', textAlign: 'left' }}>
                                <th style={{ padding: '6px 4px' }}>Produto</th>
                                <th style={{ padding: '6px 4px' }}>Categoria</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Estoque</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Preço</th>
                                <th style={{ padding: '6px 4px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p, idx) => (
                                <tr
                                    key={p.id}
                                    style={{
                                        backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white',
                                    }}
                                >
                                    <td style={{ padding: '6px 4px' }}>{p.name}</td>
                                    <td style={{ padding: '6px 4px' }}>{p.category?.name || '—'}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{p.stock_quantity}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                                        {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td style={{ padding: '6px 4px' }}>
                                        {!p.active
                                            ? 'inativo'
                                            : p.stock_quantity === 0
                                                ? 'zerado'
                                                : p.stock_quantity <= p.min_stock
                                                    ? 'baixo'
                                                    : p.stock_quantity > p.max_stock
                                                        ? 'excesso'
                                                        : 'normal'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    // Agrupado por categoria ou status
                    Object.entries(
                        products.reduce((acc, p) => {
                            let key = '';
                            if (groupBy === 'category') key = p.category?.name || 'Sem Categoria';
                            else if (groupBy === 'stockStatus') key = getStockStatusLabel(p);
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(p);
                            return acc;
                        }, {} as Record<string, Product[]>)
                    )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([group, items], groupIdx) => (
                            <div key={group} style={{ marginBottom: '20px' }}>
                                <h3
                                    style={{
                                        fontSize: '11pt',
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                        borderBottom: '1px dashed #999',
                                        paddingBottom: '3px',
                                    }}
                                >
                                    {group} <span style={{ fontWeight: 'normal', fontSize: '9pt' }}>({items.length})</span>
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #aaa', textAlign: 'left' }}>
                                            <th style={{ padding: '4px 4px' }}>Produto</th>
                                            <th style={{ padding: '4px 4px', textAlign: 'right' }}>Estoque</th>
                                            <th style={{ padding: '4px 4px', textAlign: 'right' }}>Preço</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((p, idx) => (
                                            <tr
                                                key={p.id}
                                                style={{
                                                    backgroundColor: (groupIdx + idx) % 2 === 0 ? '#f9f9f9' : 'white',
                                                }}
                                            >
                                                <td style={{ padding: '4px 4px' }}>{p.name}</td>
                                                <td style={{ padding: '4px 4px', textAlign: 'right' }}>{p.stock_quantity}</td>
                                                <td style={{ padding: '4px 4px', textAlign: 'right' }}>
                                                    {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                )}

                {/* Rodapé – apenas no final (não por página) */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '8pt',
                            color: '#666',
                        }}
                    >
                        <span>Relatório de estoque</span>
                        <span>Documento gerado pelo OptmaMenu. Todos os direitos reservados.</span>
                    </div>
                </div>

                {/* Estilos de impressão – A4, margens e fonte */}
                <style>{`
          @media print {
            @page {
              size: A4;
              margin: 1.25cm;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Courier New', Courier, monospace !important;
            }
          }
        `}</style>
            </div>
        );
    }
);

PrintableReport.displayName = 'PrintableReport';
export default PrintableReport;
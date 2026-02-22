import { forwardRef } from 'react';
import type { StockMovement } from '../types/inventory.types';

interface PrintableStockMovementsProps {
    movements: StockMovement[];
    title: string;
    storeName?: string;
    printedBy?: string;
    filters?: {
        startDate?: string;
        endDate?: string;
        type?: string;
    };
}

const MOVEMENT_LABELS: Record<string, { label: string }> = {
    entry: { label: 'Entrada' },
    exit: { label: 'Saída' },
    reservation: { label: 'Reserva' },
    confirmation: { label: 'Baixa (Pedido)' },
    cancellation: { label: 'Cancelamento' },
    clearance: { label: 'Zeramento' },
};

const PrintableStockMovements = forwardRef<HTMLDivElement, PrintableStockMovementsProps>(
    (
        {
            movements,
            title,
            storeName = 'Minha Loja',
            printedBy = 'Admin',
            filters,
        },
        ref
    ) => {
        const currentDate = new Date().toLocaleDateString('pt-BR');
        const currentTime = new Date().toLocaleTimeString('pt-BR');

        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        };

        const formatDateOnly = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        };

        const formatQuantity = (qty: number, type: string) => {
            const sign = type === 'entry' || type === 'cancellation' || type === 'reservation' ? '+' : '-';
            return `${sign}${Math.abs(qty)}`;
        };

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
                        <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>Relatório de Movimentações: {title}</span>
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
                    {filters && (filters.startDate || filters.endDate) && (
                        <div style={{ fontSize: '8pt', color: '#666', marginTop: '5px' }}>
                            Período: {filters.startDate ? formatDateOnly(filters.startDate) : '...'} até {filters.endDate ? formatDateOnly(filters.endDate) : '...'}
                        </div>
                    )}
                </div>

                {/* Tabela de Movimentações */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #aaa', textAlign: 'left' }}>
                            <th style={{ padding: '6px 4px' }}>Data/Hora</th>
                            <th style={{ padding: '6px 4px' }}>Produto</th>
                            <th style={{ padding: '6px 4px', textAlign: 'center' }}>Tipo</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Quantidade</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Estoque Antes</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Estoque Depois</th>
                            <th style={{ padding: '6px 4px' }}>Motivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movements.map((movement, idx) => {
                            const config = MOVEMENT_LABELS[movement.type] || { label: movement.type };
                            return (
                                <tr
                                    key={movement.id}
                                    style={{
                                        backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white',
                                    }}
                                >
                                    <td style={{ padding: '6px 4px' }}>{formatDate(movement.created_at)}</td>
                                    <td style={{ padding: '6px 4px', fontWeight: 'bold' }}>{movement.product_name || 'Produto removido'}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>{config.label}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>
                                        {formatQuantity(movement.quantity, movement.type)}
                                    </td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{movement.previous_stock}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>{movement.new_stock}</td>
                                    <td style={{ padding: '6px 4px' }}>{movement.reason || '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Rodapé */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '8pt',
                            color: '#666',
                        }}
                    >
                        <span>Relatório de movimentações de estoque</span>
                        <span>Documento gerado pelo OptmaMenu. Todos os direitos reservados.</span>
                    </div>
                </div>

                {/* Estilos de impressão */}
                <style>{`
                    @media print {
                        @page {
                            size: A4 landscape;
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

PrintableStockMovements.displayName = 'PrintableStockMovements';
export default PrintableStockMovements;

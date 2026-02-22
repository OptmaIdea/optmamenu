/**
 * Formata um valor numérico como moeda brasileira.
 */
export const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/**
 * Formata uma data ISO para o padrão brasileiro.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
};

/**
 * Retorna o status do estoque (baixo, normal, excesso) baseado em regras simples.
 */
export const getStockStatus = (physical: number, min: number, max: number): 'low' | 'normal' | 'high' => {
    if (physical <= min) return 'low';
    if (physical >= max) return 'high';
    return 'normal';
};

/**
 * Formata a quantidade com separador de milhar.
 */
export const formatQuantity = (qty: number): string => {
    return qty.toLocaleString('pt-BR');
};
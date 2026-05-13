export function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';

    const stringValue =
        value instanceof Date
            ? value.toISOString()
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);

    const normalized = stringValue.replace(/"/g, '""');

    if (/[",;\n]/.test(normalized)) {
        return `"${normalized}"`;
    }

    return normalized;
}

export function formatCsvNumberBR(value: unknown, fractionDigits = 2): string {
    if (value === null || value === undefined || value === '') return '';

    const numeric =
        typeof value === 'number'
            ? value
            : Number(String(value).replace(',', '.'));

    if (!Number.isFinite(numeric)) return '';

    return numeric.toLocaleString('pt-BR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}

export function formatCsvIntegerBR(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';

    const numeric =
        typeof value === 'number'
            ? value
            : Number(String(value).replace(',', '.'));

    if (!Number.isFinite(numeric)) return '';

    return Math.round(numeric).toLocaleString('pt-BR');
}

export function buildCsv(
    rows: Array<Record<string, unknown>>,
    headers?: string[],
    delimiter = ';',
): string {
    if (!rows.length) {
        return headers?.length ? `${headers.join(delimiter)}\n` : '';
    }

    const resolvedHeaders = headers ?? Object.keys(rows[0]);

    const headerLine = resolvedHeaders.map((header) => escapeCsvValue(header)).join(delimiter);

    const lines = rows.map((row) =>
        resolvedHeaders.map((header) => escapeCsvValue(row[header])).join(delimiter),
    );

    return [headerLine, ...lines].join('\n');
}

export function downloadCsv(filename: string, csvContent: string) {
    const blob = new Blob([`\uFEFF${csvContent}`], {
        type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
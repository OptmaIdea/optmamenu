type CsvCell = string | number | boolean | null | undefined;

interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
}

const CSV_BOM = '\uFEFF';
const DELIMITER = ';';

const escapeCsvCell = (value: CsvCell) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const downloadCsv = ({ filename, headers, rows }: CsvExportOptions) => {
  const content = [
    headers.map(escapeCsvCell).join(DELIMITER),
    ...rows.map((row) => row.map(escapeCsvCell).join(DELIMITER)),
  ].join('\n');

  const blob = new Blob([CSV_BOM + content], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

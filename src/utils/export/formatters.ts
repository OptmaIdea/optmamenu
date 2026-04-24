export const formatNumberPtBr = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const formatCurrencyPtBr = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric);
};

export const formatDatePtBr = (value: string | null | undefined) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR').format(date);
};

export const formatDateTimePtBr = (value: string | null | undefined) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

type DateInput = string | number | Date | null | undefined;

function normalizeDateString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  // Campo DATE puro do Postgres: deixe para formatDateOnlyPtBr.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  let normalized = trimmed.replace(' ', 'T');

  // Postgres às vezes retorna timestamptz como: 2026-04-29 02:47:42.783166+00
  // JS Date não é confiável com "+00" sem ":00". Normalizamos para ISO.
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');

  // Limita microssegundos a milissegundos, sem perder o fuso.
  normalized = normalized.replace(/\.(\d{3})\d+([zZ]|[+-]\d{2}:\d{2})?$/, '.$1$2');

  const hasExplicitTimezone =
    /z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);

  // Timestamp sem fuso vindo de RPC/PostgREST será tratado como horário de Brasília.
  if (!hasExplicitTimezone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    normalized = `${normalized}-03:00`;
  }

  return normalized;
}

export function toAppDate(value: DateInput): Date | null {
  if (!value) return null;

  const normalized = typeof value === 'string' ? normalizeDateString(value) : value;
  const date = normalized instanceof Date ? normalized : new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDatePtBr(value: DateInput, fallback = '—') {
  const date = toAppDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DEFAULT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimePtBr(value: DateInput, fallback = '—') {
  const date = toAppDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DEFAULT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTimeWithSecondsPtBr(value: DateInput, fallback = '—') {
  const date = toAppDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DEFAULT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatDateForExportPtBr(value: DateInput, fallback = '') {
  return formatDatePtBr(value, fallback);
}

export function formatDateTimeForExportPtBr(value: DateInput, fallback = '') {
  return formatDateTimePtBr(value, fallback);
}

export function formatDateOnlyPtBr(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return fallback;

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export function formatDateOnlyForExportPtBr(value: string | null | undefined, fallback = '') {
  return formatDateOnlyPtBr(value, fallback);
}

export function getLocalDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shortDateTimePtBr(value: DateInput, fallback = '—') {
  return formatDateTimePtBr(value, fallback);
}

export function getAppTimeZone() {
  return DEFAULT_TIME_ZONE;
}

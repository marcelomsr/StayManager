export function brl(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function numberValue(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').replace(/\./g, '').replace(',', '.');
  if (!raw.trim()) return 0;
  return Number(raw);
}

export function sumExpressionValue(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').trim();
  if (!raw) return 0;
  if (!/^[\d,+]+$/.test(raw)) return NaN;

  const parts = raw.split('+');
  if (parts.some((part) => !/^\d+(,\d*)?$/.test(part))) return NaN;

  const total = parts.reduce((sum, part) => sum + Number(part.replace(',', '.')), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function optionalNumberValue(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').replace(/\./g, '').replace(',', '.');
  if (!raw.trim()) return null;
  return Number(raw);
}

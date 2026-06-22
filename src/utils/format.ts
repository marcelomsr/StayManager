export function brl(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function numberValue(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').replace(/\./g, '').replace(',', '.');
  if (!raw.trim()) return 0;
  return Number(raw);
}

export function optionalNumberValue(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').replace(/\./g, '').replace(',', '.');
  if (!raw.trim()) return null;
  return Number(raw);
}

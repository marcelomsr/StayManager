import { MonthRef } from '../types';

export function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function currentMonthRef(): MonthRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthLabel(ref: MonthRef) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ref.year, ref.month - 1, 1));
}

export function monthBounds(ref: MonthRef) {
  const start = `${ref.year}-${pad(ref.month)}-01`;
  const endDate = new Date(ref.year, ref.month, 0);
  const end = `${ref.year}-${pad(ref.month)}-${pad(endDate.getDate())}`;
  return { start, end, days: endDate.getDate() };
}

export function addMonths(ref: MonthRef, amount: number): MonthRef {
  const date = new Date(ref.year, ref.month - 1 + amount, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function calculateNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const inUtc = Date.UTC(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
  const outUtc = Date.UTC(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());
  return Math.max(0, Math.round((outUtc - inUtc) / 86_400_000));
}

export function weekday(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(value));
}

export function isWithinNextDays(value: string, days: number) {
  const target = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return target >= start && target <= end;
}

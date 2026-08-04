import { MonthRef, Stay } from '../types';
import { calculateNights } from './date';

export function overlapNightsInMonth(stay: Stay, current: MonthRef) {
  const toLocalCalendarDay = (value: string) => {
    const date = new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  const monthStart = Date.UTC(current.year, current.month - 1, 1);
  const nextMonthStart = Date.UTC(current.year, current.month, 1);
  const stayStart = toLocalCalendarDay(stay.check_in_at);
  const stayEnd = toLocalCalendarDay(stay.check_out_at);
  const overlapStart = Math.max(stayStart, monthStart);
  const overlapEnd = Math.min(stayEnd, nextMonthStart);

  // A saída é exclusiva: 30/05 a 02/06 conta 30 e 31 em maio e 01 em junho.
  return Math.max(0, (overlapEnd - overlapStart) / 86_400_000);
}

export function amountInMonth(stay: Stay, amount: number | null | undefined, current: MonthRef) {
  const totalNights = calculateNights(stay.check_in_at, stay.check_out_at);
  if (!totalNights) return 0;
  return Number(amount ?? 0) * overlapNightsInMonth(stay, current) / totalNights;
}

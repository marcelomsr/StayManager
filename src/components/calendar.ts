import { Stay } from '../types';
import { escapeHtml } from './dom';
import { monthBounds, pad } from '../utils/date';

export function renderCalendar(year: number, month: number, stays: Stay[]) {
  const { days } = monthBounds({ year, month });
  const first = new Date(year, month - 1, 1).getDay();
  const cells: string[] = [];
  for (let i = 0; i < first; i++) cells.push('<div class="calendar-cell muted"></div>');
  for (let day = 1; day <= days; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const dayStays = stays.filter((stay) => stay.check_in_at.slice(0, 10) <= date && stay.check_out_at.slice(0, 10) > date);
    cells.push(`
      <div class="calendar-cell">
        <div class="calendar-day">${day}</div>
        ${dayStays.map((stay) => `
          <button class="calendar-event" data-stay-id="${stay.id}" style="--event:${stay.platforms?.color ?? '#d8dde8'}">
            ${escapeHtml(stay.studios?.name ?? '')} · ${escapeHtml(stay.guests_names.split('\n')[0] ?? '')}
          </button>
        `).join('')}
      </div>
    `);
  }
  return `
    <div class="calendar">
      <div class="calendar-week">Dom</div><div class="calendar-week">Seg</div><div class="calendar-week">Ter</div><div class="calendar-week">Qua</div><div class="calendar-week">Qui</div><div class="calendar-week">Sex</div><div class="calendar-week">Sáb</div>
      ${cells.join('')}
    </div>
  `;
}

import { PAYMENT_STATUS_OPTIONS, RESERVATION_STATUS_OPTIONS } from '../config';
import { renderCalendar } from '../components/calendar';
import { escapeHtml, html, qs } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listMonthStays, listStudios } from '../services/repositories';
import { navigate, state } from '../state/app-state';
import { Stay, MonthRef, Studio } from '../types';
import { addMonths, currentMonthRef, monthLabel, weekday } from '../utils/date';
import { brl } from '../utils/format';
import { amountInMonth, overlapNightsInMonth } from '../utils/stays';

let ref: MonthRef = currentMonthRef();
let stays: Stay[] = [];
let studios: Studio[] = [];
let selectedStudioId = '';

export async function renderDashboard() {
  if (!state.company) return appShell('');
  [studios, stays] = await Promise.all([
    listStudios(state.company.id),
    listMonthStays(state.company.id, ref.year, ref.month, selectedStudioId || undefined)
  ]);
  if (selectedStudioId && !studios.some((studio) => studio.id === selectedStudioId)) {
    selectedStudioId = '';
    stays = await listMonthStays(state.company.id, ref.year, ref.month);
  }
  const total = stays.reduce((sum, stay) => sum + amountInMonth(stay, stay.total_amount, ref), 0);
  const fees = stays.reduce((sum, stay) => sum + amountInMonth(stay, stay.fees_amount, ref), 0);
  const net = stays.reduce((sum, stay) => sum + amountInMonth(stay, stay.net_amount, ref), 0);
  const nights = stays
    .filter((stay) => stay.reservation_status !== 'Cancelado')
    .reduce((sum, stay) => sum + overlapNightsInMonth(stay, ref), 0);
  const taxableTotal = stays
    .filter((stay) => stay.platforms?.name !== 'Particular')
    .reduce((sum, stay) => sum + amountInMonth(stay, stay.total_amount, ref), 0);
  const tax = taxableTotal * 0.06;
  const exempt = taxableTotal * 0.32;
  const dailyAverage = nights ? net / nights : 0;

  return appShell(html`
    ${pageHeader('Dashboard', `
      <div class="month-nav">
        <select id="dashboard-studio-filter" aria-label="Filtrar por studio">
          <option value="">Todos</option>
          ${studios.map((studio) => `<option value="${studio.id}" ${studio.id === selectedStudioId ? 'selected' : ''}>${escapeHtml(studio.name)}</option>`).join('')}
        </select>
        <button id="prev-month" class="ghost">Anterior</button>
        <strong>${monthLabel(ref)}</strong>
        <button id="next-month" class="ghost">Próximo</button>
      </div>
    `)}
    <section class="cards-grid">
      ${card('Receita do mês', brl(total))}
      ${card('Taxas do mês', brl(fees))}
      ${card('Lucro líquido do mês', brl(net))}
      ${card('Imposto previsto', brl(tax))}
      ${card('Rendimentos isentos', brl(exempt))}
      ${card('Quantidade de diárias', String(nights))}
      ${card('Taxa média diária', brl(dailyAverage))}
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>Calendário</h2>
      </div>
      ${renderCalendar(ref.year, ref.month, stays)}
    </section>
    <section class="panel">
      <h2>Saídas para limpeza</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Saída</th><th>Dia da saída</th><th>Studio</th><th>Hóspedes</th><th>Status</th><th>Pagamento</th></tr></thead>
          <tbody>
            ${stays.map((stay) => `
              <tr>
                <td>${new Date(stay.check_out_at).toLocaleString('pt-BR')}</td>
                <td>${weekday(stay.check_out_at)}</td>
                <td>${escapeHtml(stay.studios?.name)}</td>
                <td>${escapeHtml(stay.guests_names)}</td>
                <td>${badge(stay.reservation_status, RESERVATION_STATUS_OPTIONS.find((item) => item.name === stay.reservation_status)?.color)}</td>
                <td>${badge(stay.payment_status, PAYMENT_STATUS_OPTIONS.find((item) => item.name === stay.payment_status)?.color)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `);
}

function card(label: string, value: string) {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function badge(label: string, color = '#d8dde8') {
  return `<span class="badge" style="--badge:${color}">${escapeHtml(label)}</span>`;
}

export function bindDashboard() {
  qs<HTMLSelectElement>('#dashboard-studio-filter')?.addEventListener('change', (event) => {
    selectedStudioId = (event.currentTarget as HTMLSelectElement).value;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  qs<HTMLButtonElement>('#prev-month')?.addEventListener('click', async () => {
    ref = addMonths(ref, -1);
    navigate('/dashboard');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  qs<HTMLButtonElement>('#next-month')?.addEventListener('click', async () => {
    ref = addMonths(ref, 1);
    navigate('/dashboard');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  document.querySelectorAll<HTMLElement>('[data-stay-id]').forEach((button) => {
    button.addEventListener('click', () => navigate(`/hospedagens?id=${button.dataset.stayId}`));
  });
}

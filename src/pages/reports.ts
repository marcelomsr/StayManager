import { escapeHtml, html, qs } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listPeriodStays, listStudios } from '../services/repositories';
import { state } from '../state/app-state';
import { MonthRef, Stay, Studio } from '../types';
import { addMonths, currentMonthRef } from '../utils/date';
import { brl } from '../utils/format';
import { amountInMonth } from '../utils/stays';

type NetValueByMonth = {
  ref: MonthRef;
  label: string;
  value: number;
};

let studios: Studio[] = [];
let selectedStudioId = '';

function shortMonthLabel(ref: MonthRef) {
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(ref.year, ref.month - 1, 1))
    .replace('.', '');
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${String(ref.year).slice(-2)}`;
}

function lastTwelveMonths() {
  const current = currentMonthRef();
  return Array.from({ length: 12 }, (_, index) => addMonths(current, index - 11));
}

function netValueByMonth(stays: Stay[], months: MonthRef[]): NetValueByMonth[] {
  return months.map((ref) => ({
    ref,
    label: shortMonthLabel(ref),
    value: stays.reduce((sum, stay) => sum + amountInMonth(stay, stay.net_amount, ref), 0)
  }));
}

function chartScaleMax(values: NetValueByMonth[]) {
  const max = Math.max(...values.map((item) => item.value), 0);
  if (max <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

function renderNetValueChart(values: NetValueByMonth[]) {
  const max = chartScaleMax(values);
  const scaleMax = max || 1;
  const midpoint = max / 2;

  return html`
    <div class="bar-chart" role="img" aria-label="Valor líquido dos últimos 12 meses">
      <div class="chart-axis" aria-hidden="true">
        <span>${brl(max)}</span>
        <span>${brl(midpoint)}</span>
        <span>${brl(0)}</span>
      </div>
      <div class="chart-plot">
        <div class="chart-grid" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="chart-bars">
          ${values.map((item) => {
            const height = item.value > 0 ? Math.max((item.value / scaleMax) * 100, 2) : 0;
            return `
              <div class="chart-bar-item">
                <span class="chart-bar-value">${brl(item.value)}</span>
                <div class="chart-bar-track">
                  <div class="chart-bar-fill" style="height:${height}%"></div>
                </div>
                <span class="chart-bar-label">${escapeHtml(item.label)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function reportSection(title: string, body: string) {
  return html`
    <section class="panel report-panel">
      <div class="section-title">
        <h2>${title}</h2>
      </div>
      ${body}
    </section>
  `;
}

export async function renderReports() {
  if (!state.company) return appShell('');

  const months = lastTwelveMonths();
  const [firstMonth] = months;
  const lastMonth = months[months.length - 1];

  [studios] = await Promise.all([
    listStudios(state.company.id)
  ]);

  if (selectedStudioId && !studios.some((studio) => studio.id === selectedStudioId)) {
    selectedStudioId = '';
  }

  const stays = await listPeriodStays(state.company.id, firstMonth, lastMonth, selectedStudioId || undefined);
  const values = netValueByMonth(stays, months);

  return appShell(html`
    ${pageHeader('Relatórios', `
      <div class="month-nav report-filter">
        <label for="reports-studio-filter">Studio</label>
        <select id="reports-studio-filter" aria-label="Filtrar por studio">
          <option value="">Todos</option>
          ${studios.map((studio) => `<option value="${studio.id}" ${studio.id === selectedStudioId ? 'selected' : ''}>${escapeHtml(studio.name)}</option>`).join('')}
        </select>
      </div>
    `)}
    <div class="reports-stack">
      ${reportSection('Valor líquido dos últimos 12 meses', renderNetValueChart(values))}
    </div>
  `);
}

export function bindReports(refresh: () => void) {
  qs<HTMLSelectElement>('#reports-studio-filter')?.addEventListener('change', (event) => {
    selectedStudioId = (event.currentTarget as HTMLSelectElement).value;
    refresh();
  });
}

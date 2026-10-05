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

type StudioSeries = {
  studio: Studio;
  values: NetValueByMonth[];
  color: string;
};

let studios: Studio[] = [];
let selectedStudioId = '';
let hiddenStudioIds = new Set<string>();

const chartColors = ['#2266cc', '#12b76a', '#f79009', '#7a5af8', '#e31b54', '#0e9384', '#667085', '#d444f1'];

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

function chartScaleMax(values: number[]) {
  const max = Math.max(...values, 0);
  if (max <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

function renderNetValueChart(values: NetValueByMonth[]) {
  const max = chartScaleMax(values.map((item) => item.value));
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

function studioSeries(stays: Stay[], months: MonthRef[]): StudioSeries[] {
  return studios.map((studio, index) => ({
    studio,
    values: netValueByMonth(stays.filter((stay) => stay.studio_id === studio.id), months),
    color: chartColors[index % chartColors.length]
  }));
}

function renderLineChart(series: StudioSeries[], months: MonthRef[]) {
  const visibleSeries = series.filter((item) => !hiddenStudioIds.has(item.studio.id));
  const max = chartScaleMax(visibleSeries.flatMap((item) => item.values.map((value) => value.value)));
  const scaleMax = max || 1;
  const midpoint = max / 2;
  const width = 1080;
  const height = 340;
  const left = 66;
  const right = 66;
  const top = 42;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index: number) => left + (months.length === 1 ? plotWidth / 2 : (plotWidth / (months.length - 1)) * index);
  const yFor = (value: number) => top + plotHeight - (value / scaleMax) * plotHeight;
  const labelGap = 15;
  const labelTop = 14;
  const labelBottom = height - bottom - 8;
  const labelYByKey = new Map<string, number>();

  months.forEach((_, monthIndex) => {
    const candidates = visibleSeries
      .map((item) => ({
        key: `${item.studio.id}:${monthIndex}`,
        baseY: yFor(item.values[monthIndex].value) - 9
      }))
      .sort((a, b) => a.baseY - b.baseY);
    const clusters: typeof candidates[] = [];

    candidates.forEach((candidate) => {
      const cluster = clusters[clusters.length - 1];
      if (cluster && candidate.baseY - cluster[cluster.length - 1].baseY < labelGap) {
        cluster.push(candidate);
      } else {
        clusters.push([candidate]);
      }
    });

    clusters.forEach((cluster) => {
      if (cluster.length === 1) {
        const [{ key, baseY }] = cluster;
        labelYByKey.set(key, Math.min(Math.max(baseY, labelTop), labelBottom));
        return;
      }

      const center = cluster.reduce((sum, item) => sum + item.baseY, 0) / cluster.length;
      let start = center - ((cluster.length - 1) * labelGap) / 2;
      start = Math.max(start, labelTop);
      const end = start + (cluster.length - 1) * labelGap;
      if (end > labelBottom) {
        start = Math.max(labelTop, start - (end - labelBottom));
      }

      cluster.forEach((item, index) => {
        labelYByKey.set(item.key, start + index * labelGap);
      });
    });
  });

  return html`
    <div class="line-chart-wrap">
      <div class="chart-axis" aria-hidden="true">
        <span>${brl(max)}</span>
        <span>${brl(midpoint)}</span>
        <span>${brl(0)}</span>
      </div>
      <div class="line-chart-scroll">
        <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Comparação de valor líquido por Studio">
          <g class="line-chart-grid" aria-hidden="true">
            <line x1="${left}" y1="${top}" x2="${width - right}" y2="${top}"></line>
            <line x1="${left}" y1="${top + plotHeight / 2}" x2="${width - right}" y2="${top + plotHeight / 2}"></line>
            <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"></line>
          </g>
          ${visibleSeries.map((item) => {
            const points = item.values.map((value, index) => `${xFor(index)},${yFor(value.value)}`).join(' ');
            return `
              <polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
              ${item.values.map((value, index) => `
                <circle cx="${xFor(index)}" cy="${yFor(value.value)}" r="4" fill="${item.color}">
                  <title>${escapeHtml(item.studio.name)} - ${escapeHtml(value.label)}: ${brl(value.value)}</title>
                </circle>
                <text class="line-chart-point-value" x="${xFor(index)}" y="${labelYByKey.get(`${item.studio.id}:${index}`) ?? yFor(value.value) - 9}" text-anchor="middle" fill="${item.color}">${brl(value.value)}</text>
              `).join('')}
            `;
          }).join('')}
          <g class="line-chart-labels" aria-hidden="true">
            ${months.map((ref, index) => `<text x="${xFor(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(shortMonthLabel(ref))}</text>`).join('')}
          </g>
        </svg>
      </div>
    </div>
  `;
}

function studioFilter() {
  return html`
    <div class="report-control">
      <label for="reports-studio-filter">Studio</label>
      <select id="reports-studio-filter" aria-label="Filtrar por studio">
        <option value="">Todos</option>
        ${studios.map((studio) => `<option value="${studio.id}" ${studio.id === selectedStudioId ? 'selected' : ''}>${escapeHtml(studio.name)}</option>`).join('')}
      </select>
    </div>
  `;
}

function studioLegend(series: StudioSeries[]) {
  return html`
    <div class="chart-legend" aria-label="Alternar studios no gráfico">
      ${series.map((item) => {
        const active = !hiddenStudioIds.has(item.studio.id);
        return `
          <button class="legend-item ${active ? 'active' : ''}" type="button" data-studio-toggle="${item.studio.id}" aria-pressed="${active}">
            <span class="legend-swatch" style="--series-color:${item.color}"></span>
            ${escapeHtml(item.studio.name)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function reportSection(title: string, body: string, meta = '') {
  return html`
    <section class="panel report-panel">
      <div class="section-title">
        <h2>${title}</h2>
      </div>
      ${meta}
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
  hiddenStudioIds = new Set([...hiddenStudioIds].filter((id) => studios.some((studio) => studio.id === id)));

  const stays = await listPeriodStays(state.company.id, firstMonth, lastMonth);
  const filteredStays = selectedStudioId ? stays.filter((stay) => stay.studio_id === selectedStudioId) : stays;
  const values = netValueByMonth(filteredStays, months);
  const series = studioSeries(stays, months);

  return appShell(html`
    ${pageHeader('Relatórios')}
    <div class="reports-stack">
      ${reportSection('Valor líquido — últimos 12 meses', renderNetValueChart(values), studioFilter())}
      ${reportSection('Comparação de valor líquido por Studio', renderLineChart(series, months), `
        <p class="report-hint">Clique nos Studios na legenda para mostrar/ocultar cada linha.</p>
        ${studioLegend(series)}
      `)}
    </div>
  `);
}

export function bindReports(refresh: () => void) {
  qs<HTMLSelectElement>('#reports-studio-filter')?.addEventListener('change', (event) => {
    selectedStudioId = (event.currentTarget as HTMLSelectElement).value;
    refresh();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-studio-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const studioId = button.dataset.studioToggle;
      if (!studioId) return;
      if (hiddenStudioIds.has(studioId)) {
        hiddenStudioIds.delete(studioId);
      } else {
        hiddenStudioIds.add(studioId);
      }
      refresh();
    });
  });
}

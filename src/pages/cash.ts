import { CASH_DESCRIPTIONS } from '../config';
import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listCashEntries, saveCashEntry } from '../services/repositories';
import { state } from '../state/app-state';
import { CashEntry, MonthRef } from '../types';
import { addMonths, currentMonthRef, monthLabel } from '../utils/date';
import { brl, numberValue } from '../utils/format';

let ref: MonthRef = currentMonthRef();
let entries: CashEntry[] = [];

export async function renderCash() {
  if (!state.company) return appShell('');
  entries = await listCashEntries(state.company.id, ref.year, ref.month);
  const entradas = entries.filter((item) => item.kind === 'entrada').reduce((sum, item) => sum + Number(item.amount), 0);
  const saidas = entries.filter((item) => item.kind === 'saida').reduce((sum, item) => sum + Number(item.amount), 0);
  return appShell(`
    ${pageHeader('Entradas e Saídas R$', `<div class="month-nav"><button id="prev-month" class="ghost">Anterior</button><strong>${monthLabel(ref)}</strong><button id="next-month" class="ghost">Próximo</button></div>`)}
    <section class="cards-grid">
      <article class="metric-card"><span>Entradas</span><strong>${brl(entradas)}</strong></article>
      <article class="metric-card"><span>Saídas</span><strong>${brl(saidas)}</strong></article>
      <article class="metric-card"><span>Saldo do mês</span><strong>${brl(entradas - saidas)}</strong></article>
    </section>
    <section class="split">
      <form id="cash-form" class="panel form-grid">
        <label>Tipo <select name="kind"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
        <label>Data <input type="date" name="entry_date" required /></label>
        <label>Descrição <input name="description" list="cash-descriptions" required /></label>
        <datalist id="cash-descriptions">${CASH_DESCRIPTIONS.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist>
        <label>Valor <input name="amount" inputmode="decimal" required /></label>
        <button class="primary">Salvar</button>
      </form>
      <section class="panel table-wrap">
        <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>${entries.map((entry) => `<tr><td>${new Date(entry.entry_date).toLocaleDateString('pt-BR')}</td><td>${entry.kind}</td><td>${escapeHtml(entry.description)}</td><td>${brl(entry.amount)}</td></tr>`).join('')}</tbody></table>
      </section>
    </section>
  `);
}

export function bindCash(refresh: () => void) {
  qs<HTMLButtonElement>('#prev-month')?.addEventListener('click', () => { ref = addMonths(ref, -1); refresh(); });
  qs<HTMLButtonElement>('#next-month')?.addEventListener('click', () => { ref = addMonths(ref, 1); refresh(); });
  qs<HTMLFormElement>('#cash-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    await saveCashEntry(state.company!.id, {
      kind: data.get('kind') as 'entrada' | 'saida',
      entry_date: String(data.get('entry_date')),
      description: String(data.get('description')),
      amount: numberValue(data.get('amount'))
    });
    toast('Lançamento salvo.');
    refresh();
  });
}

import { CASH_DESCRIPTIONS } from '../config';
import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listCashEntries, saveCashEntry, deleteCashEntry } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { CashEntry, MonthRef } from '../types';
import { addMonths, currentMonthRef, monthLabel } from '../utils/date';
import { brl, numberValue } from '../utils/format';

const formatDate = (value: string) => {
  if (!value) return '';
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

const capitalizeKind = (kind: string) => {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
};

let ref: MonthRef = currentMonthRef();
let entries: CashEntry[] = [];

export async function renderCash() {
  if (!state.company) return appShell('');
  entries = await listCashEntries(state.company.id, ref.year, ref.month);
  const entradas = entries.filter((item) => item.kind === 'entrada').reduce((sum, item) => sum + Number(item.amount), 0);
  const saidas = entries.filter((item) => item.kind === 'saida').reduce((sum, item) => sum + Number(item.amount), 0);
  const entradasEntries = entries.filter((item) => item.kind === 'entrada');
  const saidasEntries = entries.filter((item) => item.kind === 'saida');

  const renderTable = (tableEntries: CashEntry[]) =>
    `<table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
     <tbody>${tableEntries.map((entry) => `<tr><td>${formatDate(entry.entry_date)}</td><td>${escapeHtml(entry.description)}</td><td>${brl(entry.amount)}</td><td class="row-actions"><button data-edit="${entry.id}">Editar</button><button class="danger" data-delete="${entry.id}">Excluir</button></td></tr>`).join('')}</tbody></table>`;

  return appShell(`
    ${pageHeader('Entradas e Saídas R$', `<div class="month-nav"><button id="prev-month" class="ghost">Anterior</button><strong>${monthLabel(ref)}</strong><button id="next-month" class="ghost">Próximo</button></div>`)}
    <section class="cards-grid">
      <article class="metric-card"><span>Entradas</span><strong>${brl(entradas)}</strong></article>
      <article class="metric-card"><span>Saídas</span><strong>${brl(saidas)}</strong></article>
      <article class="metric-card"><span>Saldo do mês</span><strong>${brl(entradas - saidas)}</strong></article>
    </section>
    <section class="split">
      <form id="cash-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>Tipo <select name="kind"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
        <label>Data <input type="date" name="entry_date" required /></label>
        <label>Descrição <input name="description" list="cash-descriptions" required /></label>
        <datalist id="cash-descriptions">${CASH_DESCRIPTIONS.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist>
        <label>Valor <input name="amount" inputmode="decimal" required /></label>
        <button id="cash-submit" class="primary">Salvar</button>
      </form>
      <div class="stacked-panels">
        <section class="panel table-wrap">
          <h2>Entradas</h2>
          ${renderTable(entradasEntries)}
        </section>
        <section class="panel table-wrap">
          <h2>Saídas</h2>
          ${renderTable(saidasEntries)}
        </section>
      </div>
    </section>
  `);
}

export function bindCash(refresh: () => void) {
  qs<HTMLButtonElement>('#prev-month')?.addEventListener('click', () => { ref = addMonths(ref, -1); refresh(); });
  qs<HTMLButtonElement>('#next-month')?.addEventListener('click', () => { ref = addMonths(ref, 1); refresh(); });
  const form = qs<HTMLFormElement>('#cash-form')!;
  const submitButton = qs<HTMLButtonElement>('#cash-submit');

  qs<HTMLFormElement>('#cash-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const data = new FormData(event.currentTarget as HTMLFormElement);
    await saveCashEntry(state.company!.id, {
      id: String(data.get('id') || '') || undefined,
      kind: data.get('kind') as 'entrada' | 'saida',
      entry_date: String(data.get('entry_date')),
      description: String(data.get('description')),
      amount: numberValue(data.get('amount'))
    });
    toast(data.get('id') ? 'Lançamento atualizado.' : 'Lançamento salvo.');
    refresh();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = entries.find((item) => item.id === button.dataset.edit);
      if (!entry) return;
      const entryDate = entry.entry_date.split('T')[0];
      (form.elements.namedItem('id') as HTMLInputElement).value = entry.id;
      (form.elements.namedItem('kind') as HTMLSelectElement).value = entry.kind;
      (form.elements.namedItem('entry_date') as HTMLInputElement).value = entryDate;
      (form.elements.namedItem('description') as HTMLInputElement).value = entry.description;
      (form.elements.namedItem('amount') as HTMLInputElement).value = String(entry.amount);
      if (submitButton) submitButton.textContent = 'Salvar alteração';
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!button.dataset.delete) return;
      try {
        await deleteCashEntry(state.company!.id, button.dataset.delete);
        toast('Lançamento excluído.');
        refresh();
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Erro ao excluir lançamento.', 'error');
      }
    });
  });
}

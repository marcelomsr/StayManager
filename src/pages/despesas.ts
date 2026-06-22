import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listExpenseEntries, listExpenseTypes, listMonthStays, listStudios, saveExpenseEntry, saveExpenseType } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { ExpenseEntry, ExpenseType, MonthRef, Studio } from '../types';
import { addMonths, currentMonthRef, monthBounds, monthLabel, pad } from '../utils/date';
import { brl, numberValue } from '../utils/format';

let ref: MonthRef = currentMonthRef();
let entries: ExpenseEntry[] = [];
let types: ExpenseType[] = [];
let studios: Studio[] = [];

export async function renderDespesas() {
  if (!state.company) return appShell('');
  [entries, types, studios] = await Promise.all([
    listExpenseEntries(state.company.id, ref.year, ref.month),
    listExpenseTypes(state.company.id),
    listStudios(state.company.id)
  ]);
  const stays = await listMonthStays(state.company.id, ref.year, ref.month);
  const totalExpenses = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const revenue = stays.reduce((sum, stay) => sum + Number(stay.net_amount ?? 0), 0);
  const days = monthBounds(ref).days;
  const dailyGoal = totalExpenses / days;

  return appShell(`
    ${pageHeader('Despesas', `<div class="month-nav"><button id="prev-month" class="ghost">Anterior</button><strong>${monthLabel(ref)}</strong><button id="next-month" class="ghost">Próximo</button></div>`)}
    <section class="cards-grid">
      <article class="metric-card"><span>Gastos do mês</span><strong>${brl(totalExpenses)}</strong></article>
      <article class="metric-card"><span>Faturamento líquido rateado</span><strong>${brl(revenue)}</strong></article>
      <article class="metric-card"><span>Média para se pagar</span><strong>${brl(dailyGoal)}</strong></article>
    </section>
    <section class="split">
      <form id="expense-type-form" class="panel form-grid">
        <h2>Tipo de gasto</h2>
        <input type="hidden" name="id" />
        <label>Nome <input name="name" required /></label>
        <div class="checkbox-list">${studios.map((studio) => `<label class="check"><input type="checkbox" name="studio_ids" value="${studio.id}" /> ${escapeHtml(studio.name)}</label>`).join('')}</div>
        <button class="primary">Salvar tipo</button>
      </form>
      <form id="expense-entry-form" class="panel form-grid">
        <h2>Lançamento mensal</h2>
        <label>Studio <select name="studio_id">${studios.map((studio) => `<option value="${studio.id}">${escapeHtml(studio.name)}</option>`).join('')}</select></label>
        <label>Tipo <select name="expense_type_id">${types.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join('')}</select></label>
        <label>Valor <input name="amount" inputmode="decimal" required /></label>
        <label>Observação <textarea name="notes"></textarea></label>
        <button class="primary">Lançar gasto</button>
      </form>
    </section>
    <section class="panel table-wrap">
      <table><thead><tr><th>Studio</th><th>Tipo</th><th>Valor</th><th>Observação</th></tr></thead>
      <tbody>${entries.map((entry) => `<tr><td>${escapeHtml(entry.studios?.name)}</td><td>${escapeHtml(entry.expense_types?.name)}</td><td>${brl(entry.amount)}</td><td>${escapeHtml(entry.notes)}</td></tr>`).join('')}</tbody></table>
    </section>
  `);
}

export function bindDespesas(refresh: () => void) {
  qs<HTMLButtonElement>('#prev-month')?.addEventListener('click', () => { ref = addMonths(ref, -1); refresh(); });
  qs<HTMLButtonElement>('#next-month')?.addEventListener('click', () => { ref = addMonths(ref, 1); refresh(); });
  qs<HTMLFormElement>('#expense-type-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    await saveExpenseType(state.company!.id, { id: String(data.get('id') || '') || undefined, name: String(data.get('name')), active: true }, data.getAll('studio_ids').map(String));
    toast('Tipo de gasto salvo.');
    refresh();
  });
  qs<HTMLFormElement>('#expense-entry-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    await saveExpenseEntry(state.company!.id, {
      studio_id: String(data.get('studio_id')),
      expense_type_id: String(data.get('expense_type_id')),
      reference_month: `${ref.year}-${pad(ref.month)}-01`,
      amount: numberValue(data.get('amount')),
      notes: String(data.get('notes') || '') || null
    });
    toast('Despesa lançada.');
    refresh();
  });
}

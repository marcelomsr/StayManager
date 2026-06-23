import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listExpenseEntries, listExpenseTypes, listMonthStays, listStudios, saveExpenseEntry, saveExpenseType, deleteExpenseEntry } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { ExpenseEntry, ExpenseType, Id, MonthRef, Studio } from '../types';
import { addMonths, currentMonthRef, monthBounds, monthLabel, pad } from '../utils/date';
import { brl, numberValue } from '../utils/format';

let ref: MonthRef = currentMonthRef();
let entries: ExpenseEntry[] = [];
let types: ExpenseType[] = [];
let studios: Studio[] = [];

const filterTypesByStudio = (studioId: Id) =>
  types.filter((type) => type.studio_ids?.includes(studioId));

const renderExpenseTypeOptions = (studioId: Id) =>
  filterTypesByStudio(studioId)
    .map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`)
    .join('');

const EXPENSE_PAYMENT_STATUS_OPTIONS = [
  { name: 'Não pago', color: '#ff8f8f' },
  { name: 'Pago', color: '#8ec5ff' }
] as const;

const badge = (label: string) => {
  const option = EXPENSE_PAYMENT_STATUS_OPTIONS.find((item) => item.name === label);
  const color = option?.color ?? '#d8dde8';
  return `<span class="badge" style="--badge:${color}">${escapeHtml(label)}</span>`;
};

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
  const defaultStudioId = studios[0]?.id ?? '';

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
        <input type="hidden" name="id" />
        <label>Studio <select id="expense-entry-studio" name="studio_id">${studios.map((studio) => `<option value="${studio.id}">${escapeHtml(studio.name)}</option>`).join('')}</select></label>
        <label>Tipo <select id="expense-entry-type" name="expense_type_id">${renderExpenseTypeOptions(defaultStudioId)}</select></label>
        <label>Pagamento <select name="payment_status">${EXPENSE_PAYMENT_STATUS_OPTIONS.map((item) => `<option value="${item.name}">${item.name}</option>`).join('')}</select></label>
        <label>Valor <input name="amount" inputmode="decimal" required /></label>
        <label>Observação <textarea name="notes"></textarea></label>
        <button id="expense-entry-submit" class="primary">Lançar gasto</button>
      </form>
    </section>
    <section class="panel table-wrap">
      <table><thead><tr><th>Studio</th><th>Tipo</th><th>Pagamento</th><th>Valor</th><th>Observação</th><th></th></tr></thead>
      <tbody>${entries.map((entry) => `<tr class="${entry.payment_status === 'Pago' ? 'paid' : 'unpaid'}"><td>${escapeHtml(entry.studios?.name)}</td><td>${escapeHtml(entry.expense_types?.name)}</td><td>${badge(entry.payment_status)}</td><td>${brl(entry.amount)}</td><td>${escapeHtml(entry.notes)}</td><td class="row-actions"><button data-edit="${entry.id}">Editar</button><button class="danger" data-delete="${entry.id}">Excluir</button></td></tr>`).join('')}</tbody></table>
    </section>
  `);
}

export function bindDespesas(refresh: () => void) {
  qs<HTMLButtonElement>('#prev-month')?.addEventListener('click', () => { ref = addMonths(ref, -1); refresh(); });
  qs<HTMLButtonElement>('#next-month')?.addEventListener('click', () => { ref = addMonths(ref, 1); refresh(); });
  const form = qs<HTMLFormElement>('#expense-entry-form')!;
  const studioSelect = qs<HTMLSelectElement>('#expense-entry-studio');
  const expenseTypeSelect = qs<HTMLSelectElement>('#expense-entry-type');
  const submitButton = qs<HTMLButtonElement>('#expense-entry-submit');

  const syncExpenseTypeOptions = (studioId: Id) => {
    if (!expenseTypeSelect) return;
    const currentValue = expenseTypeSelect.value;
    expenseTypeSelect.innerHTML = renderExpenseTypeOptions(studioId);
    if (currentValue && Array.from(expenseTypeSelect.options).some((option) => option.value === currentValue)) {
      expenseTypeSelect.value = currentValue;
    }
  };

  studioSelect?.addEventListener('change', () => {
    syncExpenseTypeOptions(studioSelect.value);
  });

  syncExpenseTypeOptions(studioSelect?.value ?? '');

  qs<HTMLFormElement>('#expense-type-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const studioIds = data.getAll('studio_ids').map(String).filter(Boolean);
    if (!studioIds.length) {
      toast('Selecione ao menos um studio para o tipo de gasto.', 'error');
      return;
    }
    await saveExpenseType(
      state.company!.id,
      { id: String(data.get('id') || '') || undefined, name: String(data.get('name')), active: true },
      studioIds
    );
    toast('Tipo de gasto salvo.');
    refresh();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const data = new FormData(form);
    const studioId = String(data.get('studio_id'));
    const expenseTypeId = String(data.get('expense_type_id'));
    const validTypes = filterTypesByStudio(studioId).map((type) => type.id);
    if (!validTypes.includes(expenseTypeId)) {
      toast('Tipo de gasto inválido para o studio selecionado.', 'error');
      return;
    }

    try {
      await saveExpenseEntry(state.company!.id, {
        id: String(data.get('id') || '') || undefined,
        studio_id: studioId,
        expense_type_id: expenseTypeId,
        payment_status: String(data.get('payment_status') || 'Não pago'),
        reference_month: `${ref.year}-${pad(ref.month)}-01`,
        amount: numberValue(data.get('amount')),
        notes: String(data.get('notes') || '') || null
      });

      toast(data.get('id') ? 'Despesa atualizada.' : 'Despesa lançada.');
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao salvar despesa.', 'error');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const entry = entries.find((item) => item.id === button.dataset.edit)!;
    if (!entry) return;

    (form.elements.namedItem('id') as HTMLInputElement).value = entry.id;
    studioSelect!.value = entry.studio_id;
    syncExpenseTypeOptions(entry.studio_id);
    expenseTypeSelect!.value = entry.expense_type_id;
    (form.elements.namedItem('payment_status') as HTMLSelectElement).value = entry.payment_status ?? 'Não pago';
    (form.elements.namedItem('amount') as HTMLInputElement).value = String(entry.amount);
    (form.elements.namedItem('notes') as HTMLTextAreaElement).value = entry.notes ?? '';
    submitButton!.textContent = 'Salvar alteração';
  }));

  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await deleteExpenseEntry(state.company!.id, button.dataset.delete!);
      toast('Despesa excluída.');
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao excluir despesa.', 'error');
    }
  }));
}

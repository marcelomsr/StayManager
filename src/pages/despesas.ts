import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { cloneExpenseEntries, listExpenseEntries, listExpenseTypes, listMonthStays, listStudios, saveExpenseEntry, saveExpenseType, deleteExpenseEntry, updateExpenseEntryInline } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { ExpenseEntry, ExpenseType, Id, MonthRef, Studio, Stay } from '../types';
import { addMonths, currentMonthRef, monthBounds, monthLabel, pad } from '../utils/date';
import { brl, sumExpressionValue } from '../utils/format';
import { cycleInlineField, editableBadge } from '../utils/inline-grid';

let ref: MonthRef = currentMonthRef();
let selectedStudioId: Id = '';
let entries: ExpenseEntry[] = [];
let types: ExpenseType[] = [];
let studios: Studio[] = [];
const updatingInlineFields = new Set<string>();

const filterTypesByStudio = (studioId: Id) =>
  types.filter((type) => type.studio_ids?.includes(studioId));

const renderExpenseTypeOptions = (studioId: Id) =>
  filterTypesByStudio(studioId)
    .map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`)
    .join('');

const monthInputValue = (value: MonthRef) => `${value.year}-${pad(value.month)}`;

const monthRefFromInput = (value: string): MonthRef | null => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
};

const toDateOnly = (value: string) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

const calculateNightsBetween = (start: Date, end: Date) => {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
};

const proratedNetAmountForMonth = (stay: Stay, ref: MonthRef) => {
  const totalNights = calculateNightsBetween(toDateOnly(stay.check_in_at), toDateOnly(stay.check_out_at));
  if (!totalNights || !stay.net_amount) return 0;

  const monthStart = new Date(Date.UTC(ref.year, ref.month - 1, 1));
  const monthEndExclusive = new Date(Date.UTC(ref.year, ref.month, 1));
  const overlapStart = new Date(Math.max(toDateOnly(stay.check_in_at).getTime(), monthStart.getTime()));
  const overlapEnd = new Date(Math.min(toDateOnly(stay.check_out_at).getTime(), monthEndExclusive.getTime()));
  const overlapNights = calculateNightsBetween(overlapStart, overlapEnd);

  return (stay.net_amount * overlapNights) / totalNights;
};

const EXPENSE_PAYMENT_STATUS_OPTIONS = [
  { name: 'Não pago', color: '#ff8f8f' },
  { name: 'Pago', color: '#8ec5ff' }
] as const;

const paymentColor = (value: string) => EXPENSE_PAYMENT_STATUS_OPTIONS.find((item) => item.name === value)?.color;

const editablePaymentBadge = (entry: ExpenseEntry) =>
  editableBadge({
    id: entry.id,
    field: 'payment_status',
    value: entry.payment_status,
    color: paymentColor(entry.payment_status),
    isUpdating: updatingInlineFields.has(`${entry.id}:payment_status`)
  });

const renderExpenseEntryRow = (entry: ExpenseEntry) => `
  <tr class="${entry.payment_status === 'Pago' ? 'paid' : 'unpaid'}" data-expense-entry-row="${entry.id}">
    <td>${escapeHtml(entry.studios?.name)}</td>
    <td>${escapeHtml(entry.expense_types?.name)}</td>
    <td>${editablePaymentBadge(entry)}</td>
    <td>${brl(entry.amount)}</td>
    <td>${escapeHtml(entry.notes)}</td>
    <td class="row-actions"><button data-edit="${entry.id}">Editar</button><button class="danger" data-delete="${entry.id}">Excluir</button></td>
  </tr>`;

export async function renderDespesas() {
  if (!state.company) return appShell('');
  [entries, types, studios] = await Promise.all([
    listExpenseEntries(state.company.id, ref.year, ref.month, selectedStudioId),
    listExpenseTypes(state.company.id),
    listStudios(state.company.id)
  ]);
  const stays = await listMonthStays(state.company.id, ref.year, ref.month, selectedStudioId);
  const totalExpenses = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const revenue = stays.reduce((sum, stay) => sum + proratedNetAmountForMonth(stay, ref), 0);
  const days = monthBounds(ref).days;
  const dailyGoal = totalExpenses / days;
  const defaultStudioId = studios[0]?.id ?? '';

  return appShell(`
    ${pageHeader('Despesas', `<div class="month-nav"><button id="prev-month" class="ghost">Anterior</button><strong>${monthLabel(ref)}</strong><button id="next-month" class="ghost">Próximo</button></div>`)}
    <section class="cards-grid">
      <article class="metric-card">
        <span>Studio</span>
        <strong>
          <select id="expense-studio-filter">
            <option value="">Todos</option>
            ${studios.map((studio) => `<option value="${studio.id}" ${studio.id === selectedStudioId ? 'selected' : ''}>${escapeHtml(studio.name)}</option>`).join('')}
          </select>
        </strong>
      </article>
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
        <label>Valor <input name="amount" inputmode="text" required /></label>
        <label>Observação <textarea name="notes"></textarea></label>
        <button id="expense-entry-submit" class="primary">Lançar gasto</button>
      </form>
    </section>
    <section class="panel table-wrap expenses-table">
      <table><thead><tr><th>Studio</th><th>Tipo</th><th>Pagamento</th><th>Valor</th><th>Observação</th><th></th></tr></thead>
      <tbody>${entries.map(renderExpenseEntryRow).join('')}</tbody></table>
    </section>
    <section class="panel">
      <form id="expense-clone-form" class="form-grid">
        <h2>Clonar mês</h2>
        <label>Mês de origem <input type="month" name="source_month" value="${monthInputValue(addMonths(ref, -1))}" required /></label>
        <label>Mês de destino <input type="month" name="target_month" value="${monthInputValue(ref)}" required /></label>
        <button class="primary">Clonar mês</button>
      </form>
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
  const studioFilter = qs<HTMLSelectElement>('#expense-studio-filter');
  const table = qs<HTMLElement>('.expenses-table table');

  const updateExpenseEntryInList = (entry: ExpenseEntry) => {
    entries = entries.map((item) => item.id === entry.id ? entry : item);
  };

  const replaceExpenseEntryRow = (entry: ExpenseEntry) => {
    const row = qs<HTMLTableRowElement>(`[data-expense-entry-row="${entry.id}"]`);
    if (row) row.outerHTML = renderExpenseEntryRow(entry);
  };

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

  studioFilter?.addEventListener('change', () => {
    selectedStudioId = studioFilter.value;
    refresh();
  });

  syncExpenseTypeOptions(studioSelect?.value ?? '');

  const amountInput = form.elements.namedItem('amount') as HTMLInputElement;
  amountInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 && !/[\d,+]/.test(event.key)) {
      event.preventDefault();
    }
  });

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

  qs<HTMLFormElement>('#expense-clone-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }

    const data = new FormData(event.currentTarget as HTMLFormElement);
    const source = monthRefFromInput(String(data.get('source_month') || ''));
    const target = monthRefFromInput(String(data.get('target_month') || ''));
    if (!source || !target) {
      toast('Informe o mês de origem e o mês de destino.', 'error');
      return;
    }

    if (source.year === target.year && source.month === target.month) {
      toast('Selecione meses diferentes para clonar.', 'error');
      return;
    }

    if (!window.confirm(`Clonar as despesas de ${monthLabel(source)} para ${monthLabel(target)}?`)) {
      return;
    }

    try {
      const result = await cloneExpenseEntries(state.company!.id, source, target);
      if (result.duplicateCount > 0) {
        toast('Já existem despesas iguais no mês de destino. Nenhuma despesa foi clonada.', 'error');
        return;
      }
      if (result.clonedCount === 0) {
        toast('Não há despesas no mês de origem para clonar.', 'error');
        return;
      }
      toast(`${result.clonedCount} despesa${result.clonedCount === 1 ? '' : 's'} clonada${result.clonedCount === 1 ? '' : 's'}.`);
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao clonar despesas.', 'error');
    }
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

    const amount = sumExpressionValue(data.get('amount'));
    if (Number.isNaN(amount)) {
      toast('Informe o valor usando apenas numeros, virgula decimal e +.', 'error');
      return;
    }

    try {
      await saveExpenseEntry(state.company!.id, {
        id: String(data.get('id') || '') || undefined,
        studio_id: studioId,
        expense_type_id: expenseTypeId,
        payment_status: String(data.get('payment_status') || 'Não pago'),
        reference_month: `${ref.year}-${pad(ref.month)}-01`,
        amount,
        notes: String(data.get('notes') || '') || null
      });

      toast(data.get('id') ? 'Despesa atualizada.' : 'Despesa lançada.');
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao salvar despesa.', 'error');
    }
  });

  table?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;

    const editButton = target.closest<HTMLButtonElement>('[data-edit]');
    if (editButton && table.contains(editButton)) {
      const entry = entries.find((item) => item.id === editButton.dataset.edit)!;
      if (!entry) return;

      (form.elements.namedItem('id') as HTMLInputElement).value = entry.id;
      studioSelect!.value = entry.studio_id;
      syncExpenseTypeOptions(entry.studio_id);
      expenseTypeSelect!.value = entry.expense_type_id;
      (form.elements.namedItem('payment_status') as HTMLSelectElement).value = entry.payment_status ?? 'Não pago';
      (form.elements.namedItem('amount') as HTMLInputElement).value = Number(entry.amount).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false
      });
      (form.elements.namedItem('notes') as HTMLTextAreaElement).value = entry.notes ?? '';
      submitButton!.textContent = 'Salvar alteração';
      return;
    }

    const deleteButton = target.closest<HTMLButtonElement>('[data-delete]');
    if (deleteButton && table.contains(deleteButton)) {
      try {
        await deleteExpenseEntry(state.company!.id, deleteButton.dataset.delete!);
        toast('Despesa excluída.');
        refresh();
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Erro ao excluir despesa.', 'error');
      }
      return;
    }

    const cycleButton = target.closest<HTMLButtonElement>('[data-cycle-field]');
    if (!cycleButton || !table.contains(cycleButton)) return;
    const field = cycleButton.dataset.cycleField;
    const entry = entries.find((item) => item.id === cycleButton.dataset.inlineId);
    if (!entry || field !== 'payment_status') return;
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }

    await cycleInlineField({
      item: entry,
      field,
      options: EXPENSE_PAYMENT_STATUS_OPTIONS,
      updatingFields: updatingInlineFields,
      updateItem: updateExpenseEntryInList,
      replaceRow: replaceExpenseEntryRow,
      persist: (previousEntry, values) => updateExpenseEntryInline(state.company!.id, previousEntry, values),
      onError: (error) => toast(error instanceof Error ? error.message : 'Erro ao salvar despesa.', 'error')
    });
  });
}

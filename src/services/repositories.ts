import { supabase } from './supabase';
import { CashEntry, CompanyUser, ExpenseEntry, ExpenseType, Id, Note, Platform, Stay, Studio } from '../types';
import { monthBounds, pad } from '../utils/date';
import { hasAccessToCompany, state } from '../state/app-state';

function companyRequired(companyId?: Id | null) {
  if (!companyId) throw new Error('Selecione uma empresa no Perfil para continuar.');
  if (!hasAccessToCompany(companyId)) throw new Error('Você não tem acesso a esta empresa.');
  return companyId;
}

export async function listPlatforms(companyId: Id) {
  const { data, error } = await supabase.from('platforms').select('*').eq('company_id', companyId).eq('active', true).order('name');
  if (error) throw error;
  return data as Platform[];
}

export async function listStudios(companyId: Id) {
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return data as Studio[];
}

export async function saveStudio(companyId: Id, values: Partial<Studio>) {
  const payload = { ...values, company_id: companyRequired(companyId) };
  const { error } = values.id ? await supabase.from('studios').update(payload).eq('id', values.id) : await supabase.from('studios').insert(payload);
  if (error) throw error;
}

export async function softDelete(table: string, id: Id) {
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString(), active: false }).eq('id', id);
  if (error) throw error;
}

export async function listStays(companyId: Id, filters: Record<string, string> = {}) {
  let query = supabase
    .from('stays')
    .select('*,studios(*),platforms(*)')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('check_in_at', { ascending: false });

  if (filters.studio_id) query = query.eq('studio_id', filters.studio_id);
  if (filters.platform_id) query = query.eq('platform_id', filters.platform_id);
  if (filters.reservation_status) query = query.eq('reservation_status', filters.reservation_status);
  if (filters.payment_status) query = query.eq('payment_status', filters.payment_status);
  if (filters.start) query = query.gte('check_in_at', `${filters.start}T00:00:00`);
  if (filters.end) query = query.lte('check_in_at', `${filters.end}T23:59:59`);
  if (filters.q) query = query.ilike('guests_names', `%${filters.q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as Stay[];
}

export async function listMonthStays(companyId: Id, year: number, month: number, studioId?: Id) {
  const monthStart = new Date(year, month - 1, 1).toISOString();
  const nextMonthStart = new Date(year, month, 1).toISOString();
  let query = supabase
    .from('stays')
    .select('*,studios(*),platforms(*)')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .lt('check_in_at', nextMonthStart)
    .gt('check_out_at', monthStart)
    .order('check_in_at');

  if (studioId) query = query.eq('studio_id', studioId);

  const { data, error } = await query;
  if (error) throw error;
  return data as Stay[];
}

export async function hasStayConflict(companyId: Id, studioId: Id, checkIn: string, checkOut: string, stayId?: Id) {
  const isoCheckIn = new Date(checkIn).toISOString();
  const isoCheckOut = new Date(checkOut).toISOString();

  let query = supabase
    .from('stays')
    .select('id')
    .eq('company_id', companyId)
    .eq('studio_id', studioId)
    .is('deleted_at', null)
    .neq('reservation_status', 'Cancelado') // Desconsidera os registros com status Cancelado
    .lt('check_in_at', isoCheckOut)
    .gt('check_out_at', isoCheckIn)
    .limit(1);
    
  if (stayId) query = query.neq('id', stayId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function saveStay(companyId: Id, values: Partial<Stay>) {
  const payload = { ...values, company_id: companyRequired(companyId) };
  if (payload.reservation_status !== 'Cancelado') {
    const conflict = await hasStayConflict(companyId, payload.studio_id!, payload.check_in_at!, payload.check_out_at!, payload.id);
    if (conflict) throw new Error('Já existe uma hospedagem com período sobreposto para este studio.');
  }
  const { error } = values.id ? await supabase.from('stays').update(payload).eq('id', values.id) : await supabase.from('stays').insert(payload);
  if (error) throw error;
}

export async function listExpenseTypes(companyId: Id) {
  const { data, error } = await supabase.rpc('expense_types_with_studios', { p_company_id: companyId });
  if (error) throw error;
  return data as ExpenseType[];
}

export async function saveExpenseType(companyId: Id, values: Partial<ExpenseType>, studioIds: Id[]) {
  if (!studioIds.length) {
    throw new Error('Selecione ao menos um studio para o tipo de gasto.');
  }

  const { data, error } = await supabase
    .from('expense_types')
    .upsert({ id: values.id, company_id: companyId, name: values.name, active: values.active ?? true }, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw error;
  const expenseTypeId = data.id as Id;
  await supabase.from('expense_type_studios').delete().eq('expense_type_id', expenseTypeId);
  const { error: linkError } = await supabase.from('expense_type_studios').insert(studioIds.map((studio_id) => ({ expense_type_id: expenseTypeId, studio_id })));
  if (linkError) throw linkError;
}

export async function listExpenseEntries(companyId: Id, year: number, month: number, studioId?: Id) {
  const reference = `${year}-${pad(month)}-01`;
  let query = supabase
    .from('expense_entries')
    .select('*,expense_types(*),studios(*)')
    .eq('company_id', companyId)
    .eq('reference_month', reference)
    .order('created_at', { ascending: false });

  if (studioId) query = query.eq('studio_id', studioId);

  const { data, error } = await query;
  if (error) throw error;
  return data as ExpenseEntry[];
}

export async function saveExpenseEntry(companyId: Id, values: Partial<ExpenseEntry>) {
  const payload = { ...values, company_id: companyRequired(companyId) };
  const referenceMonth = String(payload.reference_month || '');
  const studioId = String(payload.studio_id || '');
  const expenseTypeId = String(payload.expense_type_id || '');

  if (!referenceMonth || !studioId || !expenseTypeId) {
    throw new Error('Os campos studio, tipo e mês são obrigatórios.');
  }

  const duplicateQuery = supabase
    .from('expense_entries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('studio_id', studioId)
    .eq('expense_type_id', expenseTypeId)
    .eq('reference_month', referenceMonth);

  if (values.id) {
    duplicateQuery.neq('id', values.id);
  }

  const { count, error: countError } = await duplicateQuery;
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('Já existe uma despesa deste tipo para o mesmo studio e mês.');
  }

  const { error } = values.id
    ? await supabase.from('expense_entries').update(payload).eq('id', values.id)
    : await supabase.from('expense_entries').insert(payload);
  if (error) throw error;
}

export async function deleteExpenseEntry(companyId: Id, expenseEntryId: Id) {
  companyRequired(companyId);
  const { data, error } = await supabase
    .from('expense_entries')
    .delete()
    .eq('company_id', companyId)
    .eq('id', expenseEntryId)
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('Despesa não encontrada.');
}

export async function listCashEntries(companyId: Id, year?: number, month?: number) {
  let query = supabase.from('cash_entries').select('*').eq('company_id', companyId).order('entry_date', { ascending: false });
  if (year && month) {
    const { start, end } = monthBounds({ year, month });
    query = query.gte('entry_date', start).lte('entry_date', end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as CashEntry[];
}

export async function saveCashEntry(companyId: Id, values: Partial<CashEntry>) {
  const payload = { ...values, company_id: companyId };
  const { error } = values.id ? await supabase.from('cash_entries').update(payload).eq('id', values.id) : await supabase.from('cash_entries').insert(payload);
  if (error) throw error;
}

export async function deleteCashEntry(companyId: Id, cashEntryId: Id) {
  const { data, error } = await supabase
    .from('cash_entries')
    .delete()
    .eq('company_id', companyId)
    .eq('id', cashEntryId)
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('Lançamento não encontrado.');
}

export async function listNotes(companyId: Id) {
  const { data, error } = await supabase.from('notes').select('*').eq('company_id', companyId).is('deleted_at', null).order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function saveNote(companyId: Id, values: Partial<Note>) {
  const payload = { ...values, company_id: companyId };
  const { error } = values.id ? await supabase.from('notes').update(payload).eq('id', values.id) : await supabase.from('notes').insert(payload);
  if (error) throw error;
}

export async function listCompanyUsers(companyId: Id) {
  const { data, error } = await supabase.from('company_users').select('*').eq('company_id', companyId).order('email');
  if (error) throw error;
  return data as CompanyUser[];
}

export async function saveCompanyUser(companyId: Id, values: Partial<CompanyUser>) {
  const payload = { ...values, company_id: companyId };
  const { error } = values.id ? await supabase.from('company_users').update(payload).eq('id', values.id) : await supabase.from('company_users').insert(payload);
  if (error) throw error;
}

export async function listCompaniesAdmin() {
  if (!state.user?.is_super_admin) {
    throw new Error('Você não tem permissão para acessar esta funcionalidade.');
  }
  const { data, error } = await supabase.from('companies').select('*').is('deleted_at', null).order('name');
  if (error) throw error;
  return data;
}

export async function saveCompany(values: { id?: Id; name: string; active: boolean }) {
  if (!state.user?.is_super_admin) {
    throw new Error('Você não tem permissão para acessar esta funcionalidade.');
  }
  const { error } = values.id ? await supabase.from('companies').update(values).eq('id', values.id) : await supabase.from('companies').insert(values);
  if (error) throw error;
}

export async function hasCompanyData(companyId: Id) {
  if (!state.user?.is_super_admin) {
    throw new Error('Você não tem permissão para acessar esta funcionalidade.');
  }
  try {
    // Verificar em cada tabela se há dados vinculados
    const [studios, platforms, stays, expenseTypes, expenseEntries, cashEntries, notes, companyUsers] = await Promise.all([
      supabase.from('studios').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
      supabase.from('platforms').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('stays').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
      supabase.from('expense_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
      supabase.from('expense_entries').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('cash_entries').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('notes').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null),
      supabase.from('company_users').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    ]);

    const totalCount =
      (studios.count || 0) +
      (platforms.count || 0) +
      (stays.count || 0) +
      (expenseTypes.count || 0) +
      (expenseEntries.count || 0) +
      (cashEntries.count || 0) +
      (notes.count || 0) +
      (companyUsers.count || 0);

    return totalCount > 0;
  } catch (error) {
    console.error('Erro ao verificar dados da empresa:', error);
    return true; // Se houver erro, assume que tem dados para segurança
  }
}

export async function deleteCompany(companyId: Id) {
  if (!state.user?.is_super_admin) {
    throw new Error('Você não tem permissão para acessar esta funcionalidade.');
  }
  const { error } = await supabase.from('companies').update({ deleted_at: new Date().toISOString(), active: false }).eq('id', companyId);
  if (error) throw error;
}

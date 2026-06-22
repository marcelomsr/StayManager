import { Company, AppUser } from '../types';
import { supabase } from '../services/supabase';
import { getSessionUser } from '../services/auth';

type Listener = () => void;

export const state: {
  route: string;
  user: AppUser | null;
  companies: Company[];
  company: Company | null;
  loading: boolean;
} = {
  route: location.hash.replace('#', '') || '/dashboard',
  user: null,
  companies: [],
  company: null,
  loading: true
};

const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit() {
  listeners.forEach((listener) => listener());
}

export function navigate(route: string) {
  location.hash = route;
}

window.addEventListener('hashchange', () => {
  state.route = location.hash.replace('#', '') || '/dashboard';
  emit();
});

export async function loadSessionContext() {
  state.loading = true;
  emit();
  const googleUser = getSessionUser();
  if (!googleUser) {
    state.user = null;
    state.companies = [];
    state.company = null;
    state.loading = false;
    emit();
    return;
  }

  const email = googleUser.email.toLowerCase();
  const isSuperAdmin = email === 'marcelosr6@gmail.com';

  state.user = {
    id: googleUser.id,
    email,
    full_name: googleUser.name ?? null,
    is_super_admin: isSuperAdmin
  } as AppUser;

  await supabase
    .from('app_users')
    .upsert({
      email,
      full_name: googleUser.name ?? null,
      is_super_admin: isSuperAdmin
    }, { onConflict: 'email' });

  let companyIds: string[] | null = null;
  if (!isSuperAdmin) {
    const { data: linkedCompanies } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('email', email);
    companyIds = (linkedCompanies ?? []).map((item) => item.company_id as string);
  }

  let companiesQuery = supabase
    .from('companies')
    .select('id,name,active,deleted_at')
    .is('deleted_at', null)
    .eq('active', true)
    .order('name');

  if (companyIds && companyIds.length > 0) {
    companiesQuery = companiesQuery.in('id', companyIds);
  }

  if (companyIds && companyIds.length === 0) {
    state.companies = [];
    state.company = null;
    state.loading = false;
    emit();
    return;
  }

  const { data: companies } = await companiesQuery;

  state.companies = (companies ?? []) as Company[];
  const storedCompanyId = sessionStorage.getItem('staymanager.company_id');
  state.company = state.companies.find((company) => company.id === storedCompanyId) ?? state.companies[0] ?? null;
  if (state.company) sessionStorage.setItem('staymanager.company_id', state.company.id);
  state.loading = false;
  emit();
}

export function setCompany(companyId: string) {
  const company = state.companies.find((item) => item.id === companyId) ?? null;
  state.company = company;
  if (company) sessionStorage.setItem('staymanager.company_id', company.id);
  emit();
}

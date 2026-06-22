import { escapeHtml } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { setCompany, state } from '../state/app-state';

export function renderProfile() {
  return appShell(`
    ${pageHeader('Perfil')}
    <section class="panel profile-panel">
      <h2>${escapeHtml(state.user?.email)}</h2>
      <p>Empresa atual</p>
      <select id="profile-company">${state.companies.map((company) => `<option value="${company.id}" ${state.company?.id === company.id ? 'selected' : ''}>${escapeHtml(company.name)}</option>`).join('')}</select>
      <p class="muted-text">A empresa selecionada fica salva nesta sessão até você alterar novamente.</p>
    </section>
  `);
}

export function bindProfile() {
  document.getElementById('profile-company')?.addEventListener('change', (event) => setCompany((event.target as HTMLSelectElement).value));
}

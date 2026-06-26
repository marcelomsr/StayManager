import { state, navigate, setCompany } from '../state/app-state';
import { signOut } from '../services/auth';
import { escapeHtml, html } from './dom';

const routes = [
  ['/dashboard', 'Dashboard'],
  ['/hospedagens', 'Hospedagens'],
  ['/studios', 'Studios'],
  ['/despesas', 'Despesas'],
  ['/entradas-saidas', 'Entradas e Saídas R$'],
  ['/anotacoes', 'Anotações'],
  ['/empresas', 'Empresas'],
  ['/usuarios', 'Usuários'],
  ['/perfil', 'Perfil']
];

export function appShell(content: string) {
  // Filtrar rotas baseado em permissões
  const visibleRoutes = routes.filter(([route]) => {
    const adminRoutes = ['/empresas', '/usuarios'];
    if (adminRoutes.includes(route) && !state.user?.is_super_admin) {
      return false;
    }
    return true;
  });
  
  return html`
    <aside class="sidebar">
      <div class="brand">StayManager</div>
      <nav>
        ${visibleRoutes.map(([route, label]) => `<button class="${state.route === route ? 'active' : ''}" data-route="${route}">${label}</button>`).join('')}
      </nav>
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <strong>${escapeHtml(state.company?.name ?? 'Nenhuma empresa selecionada')}</strong>
          <span>${escapeHtml(state.user?.email ?? '')}</span>
        </div>
        <div class="top-actions">
          <select id="company-switcher" ${state.companies.length ? '' : 'disabled'}>
            ${state.companies.map((company) => `<option value="${company.id}" ${state.company?.id === company.id ? 'selected' : ''}>${escapeHtml(company.name)}${!company.active ? ' (inativo)' : ''}</option>`).join('')}
          </select>
          <button class="ghost" id="logout">Sair</button>
        </div>
      </header>
      ${content}
    </main>
  `;
}

export function bindLayout() {
  document.querySelectorAll<HTMLElement>('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route!));
  });
  document.getElementById('logout')?.addEventListener('click', () => signOut());
  document.getElementById('company-switcher')?.addEventListener('change', (event) => setCompany((event.target as HTMLSelectElement).value));
}

export function pageHeader(title: string, action = '') {
  return `<section class="page-header"><h1>${title}</h1>${action}</section>`;
}

export function requireCompany() {
  // SE houver empresa OU se a rota atual for a de empresas, não bloqueia a tela
  if (state.company || state.route === '/empresas') return '';
  
  return appShell(`
    <section class="empty-state">
      <h1>Selecione uma empresa</h1>
      <p>Seu usuário ainda não possui empresa vinculada. Um administrador precisa liberar o acesso.</p>
    </section>
  `);
}
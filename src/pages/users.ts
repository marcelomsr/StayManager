import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listCompanyUsers, saveCompanyUser } from '../services/repositories';
import { state } from '../state/app-state';
import { CompanyUser } from '../types';

let users: CompanyUser[] = [];

export async function renderUsers() {
  if (!state.company) return appShell('');
  users = await listCompanyUsers(state.company.id);
  return appShell(`
    ${pageHeader('Usuários')}
    <section class="split">
      <form id="user-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>E-mail <input name="email" type="email" required /></label>
        <label class="check"><input type="checkbox" name="is_admin" /> Admin</label>
        <button class="primary">Vincular usuário</button>
      </form>
      <section class="panel table-wrap"><table><thead><tr><th>E-mail</th><th>Admin</th></tr></thead><tbody>
        ${users.map((user) => `<tr><td>${escapeHtml(user.email)}</td><td>${user.is_admin ? 'Sim' : 'Não'}</td></tr>`).join('')}
      </tbody></table></section>
    </section>
  `);
}

export function bindUsers(refresh: () => void) {
  qs<HTMLFormElement>('#user-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    await saveCompanyUser(state.company!.id, { id: String(data.get('id') || '') || undefined, email: String(data.get('email')).toLowerCase(), is_admin: data.has('is_admin') });
    toast('Usuário vinculado.');
    refresh();
  });
}

import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listCompaniesAdmin, saveCompany, softDelete } from '../services/repositories';
import { Company } from '../types';

let companies: Company[] = [];

export async function renderCompanies() {
  companies = (await listCompaniesAdmin()) as Company[];
  return appShell(`
    ${pageHeader('Empresas')}
    <section class="split">
      <form id="company-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>Nome <input name="name" required /></label>
        <label class="check"><input type="checkbox" name="active" checked /> Ativa</label>
        <button class="primary">Salvar empresa</button>
      </form>
      <section class="panel table-wrap"><table><thead><tr><th>Nome</th><th>Ativa</th><th></th></tr></thead><tbody>
        ${companies.map((company) => `<tr><td>${escapeHtml(company.name)}</td><td>${company.active ? 'Sim' : 'Não'}</td><td class="row-actions"><button data-edit="${company.id}">Editar</button><button class="danger" data-delete="${company.id}">Excluir</button></td></tr>`).join('')}
      </tbody></table></section>
    </section>
  `);
}

export function bindCompanies(refresh: () => void) {
  const form = qs<HTMLFormElement>('#company-form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await saveCompany({ id: String(data.get('id') || '') || undefined, name: String(data.get('name')), active: data.has('active') });
    toast('Empresa salva.');
    refresh();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const company = companies.find((item) => item.id === button.dataset.edit)!;
    (form.elements.namedItem('id') as HTMLInputElement).value = company.id;
    (form.elements.namedItem('name') as HTMLInputElement).value = company.name;
    (form.elements.namedItem('active') as HTMLInputElement).checked = company.active;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    await softDelete('companies', button.dataset.delete!);
    refresh();
  }));
}

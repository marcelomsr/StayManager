import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listCompaniesAdmin, saveCompany, softDelete, hasCompanyData, deleteCompany } from '../services/repositories';
import { Company } from '../types';
import { state, emit } from '../state/app-state';

let companies: Company[] = [];

export async function renderCompanies() {
  companies = (await listCompaniesAdmin()) as Company[] || [];
  return appShell(`
    ${pageHeader('Empresas')}
    <section class="split">
      <form id="company-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>Nome <input name="name" required /></label>
        <label class="check"><input type="checkbox" name="active" checked /> Ativa</label>
        <button class="primary">Salvar empresa</button>
        <button type="button" id="cancel-company" class="ghost hidden">Cancelar</button>
      </form>
      <section class="panel table-wrap"><table><thead><tr><th>Nome</th><th>Ativa</th><th></th></tr></thead><tbody>
        ${companies.map((company) => `<tr><td>${escapeHtml(company.name)}</td><td>${company.active ? 'Sim' : 'Não'}</td><td class="row-actions"><button data-edit="${company.id}">Editar</button><button class="danger" data-delete="${company.id}">Excluir</button></td></tr>`).join('')}
      </tbody></table></section>
    </section>
  `);
}

export function bindCompanies(refresh: () => void) {
  const form = qs<HTMLFormElement>('#company-form')!;
  const cancelBtn = qs<HTMLButtonElement>('#cancel-company');
  
  const resetForm = () => {
    form.reset();
    (form.elements.namedItem('id') as HTMLInputElement).value = '';
    cancelBtn?.classList.add('hidden');
    const submitBtn = form.querySelector('button.primary');
    if (submitBtn) submitBtn.textContent = 'Salvar empresa';
  };

  cancelBtn?.addEventListener('click', resetForm);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const companyId = String(data.get('id') || '') || undefined;
    const isActive = data.has('active');
    
    const company = companies.find((c) => c.id === companyId);
    if (companyId && state.company?.id === companyId && company?.active && !isActive) {
      toast('Você não pode desativar a empresa atual.', 'error');
      return;
    }
    
    try {
      const companyData = { id: companyId, name: String(data.get('name')), active: isActive };
      await saveCompany(companyData);
      
      const updatedCompanies = await listCompaniesAdmin() || [];
      state.companies = updatedCompanies as Company[];
      
      if (!state.company && state.companies.length > 0) {
        state.company = state.companies[0];
      } else if (companyId && state.company?.id === companyId) {
        state.company = state.companies.find((c) => c.id === companyId) ?? state.company;
      }
      
      emit();
      toast('Empresa salva.');
      resetForm();
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao salvar empresa.', 'error');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const company = companies.find((item) => item.id === button.dataset.edit)!;
    if (!company) return;
    (form.elements.namedItem('id') as HTMLInputElement).value = company.id;
    (form.elements.namedItem('name') as HTMLInputElement).value = company.name;
    (form.elements.namedItem('active') as HTMLInputElement).checked = company.active;
    
    cancelBtn?.classList.remove('hidden');
    const submitBtn = form.querySelector('button.primary');
    if (submitBtn) submitBtn.textContent = 'Salvar alteration';
  }));

  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    const deletedId = button.dataset.delete!;
    
    if (state.company?.id === deletedId) {
      toast('Você não pode excluir a empresa atual.', 'error');
      return;
    }
    
    const hasData = await hasCompanyData(deletedId);
    if (hasData) {
      toast('Não é possível excluir uma empresa com dados vinculados.', 'error');
      return;
    }
    
    try {
      await deleteCompany(deletedId);
      
      state.companies = state.companies.filter((c) => c.id !== deletedId);
      if (state.company?.id === deletedId) {
        state.company = state.companies[0] ?? null;
      }
      emit();
      resetForm();
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao excluir empresa.', 'error');
    }
  }));
}
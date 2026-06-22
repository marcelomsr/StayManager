import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listStudios, saveStudio, softDelete } from '../services/repositories';
import { state } from '../state/app-state';
import { Studio } from '../types';

let studios: Studio[] = [];

export async function renderStudios() {
  if (!state.company) return appShell('');
  studios = await listStudios(state.company.id);
  return appShell(`
    ${pageHeader('Studios')}
    <section class="split">
      <form id="studio-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>Nome <input name="name" required /></label>
        <label class="check"><input name="has_garage" type="checkbox" /> Possui garagem</label>
        <label class="check"><input name="active" type="checkbox" checked /> Ativo</label>
        <button class="primary">Salvar studio</button>
      </form>
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Garagem</th><th>Ativo</th><th></th></tr></thead>
          <tbody>${studios.map((studio) => `
            <tr>
              <td>${escapeHtml(studio.name)}</td><td>${studio.has_garage ? 'Sim' : 'Não'}</td><td>${studio.active ? 'Sim' : 'Não'}</td>
              <td class="row-actions"><button data-edit="${studio.id}">Editar</button><button class="danger" data-delete="${studio.id}">Excluir</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </section>
    </section>
  `);
}

export function bindStudios(refresh: () => void) {
  const form = qs<HTMLFormElement>('#studio-form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await saveStudio(state.company!.id, {
      id: String(data.get('id') || '') || undefined,
      name: String(data.get('name')),
      has_garage: data.has('has_garage'),
      active: data.has('active')
    });
    toast('Studio salvo.');
    refresh();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const studio = studios.find((item) => item.id === button.dataset.edit)!;
    (form.elements.namedItem('id') as HTMLInputElement).value = studio.id;
    (form.elements.namedItem('name') as HTMLInputElement).value = studio.name;
    (form.elements.namedItem('has_garage') as HTMLInputElement).checked = studio.has_garage;
    (form.elements.namedItem('active') as HTMLInputElement).checked = studio.active;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    await softDelete('studios', button.dataset.delete!);
    refresh();
  }));
}

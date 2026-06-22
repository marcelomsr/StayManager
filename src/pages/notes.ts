import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listNotes, saveNote, softDelete } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { Note } from '../types';

let notes: Note[] = [];

export async function renderNotes() {
  if (!state.company) return appShell('');
  notes = await listNotes(state.company.id);
  return appShell(`
    ${pageHeader('Anotações')}
    <section class="split">
      <form id="note-form" class="panel form-grid">
        <input type="hidden" name="id" />
        <label>Título <input name="title" required /></label>
        <label>Anotação <textarea name="body" rows="10" required></textarea></label>
        <button class="primary">Salvar anotação</button>
      </form>
      <section class="notes-grid">${notes.map((note) => `
        <article class="note-card"><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><button data-edit="${note.id}">Editar</button><button class="danger" data-delete="${note.id}">Excluir</button></article>
      `).join('')}</section>
    </section>
  `);
}

export function bindNotes(refresh: () => void) {
  const form = qs<HTMLFormElement>('#note-form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Validar se a empresa está ativa
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    const data = new FormData(form);
    await saveNote(state.company!.id, { id: String(data.get('id') || '') || undefined, title: String(data.get('title')), body: String(data.get('body')), active: true });
    toast('Anotação salva.');
    refresh();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const note = notes.find((item) => item.id === button.dataset.edit)!;
    (form.elements.namedItem('id') as HTMLInputElement).value = note.id;
    (form.elements.namedItem('title') as HTMLInputElement).value = note.title;
    (form.elements.namedItem('body') as HTMLTextAreaElement).value = note.body;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    await softDelete('notes', button.dataset.delete!);
    refresh();
  }));
}

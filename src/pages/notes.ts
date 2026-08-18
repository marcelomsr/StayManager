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
        <article class="note-card"><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><div class="note-actions"><button data-copy="${note.id}">Copiar</button><button data-edit="${note.id}">Editar</button><button class="danger" data-delete="${note.id}">Excluir</button></div></article>
      `).join('')}</section>
    </section>
  `);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose clipboard but block it in this context.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Copy failed');
  }
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
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    const note = notes.find((item) => item.id === button.dataset.copy);
    if (!note) return;

    try {
      await copyText(note.body);
      const originalText = button.textContent || 'Copiar';
      button.textContent = 'Copiado!';
      button.disabled = true;
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1600);
    } catch {
      toast('Não foi possível copiar a anotação.', 'error');
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    await softDelete('notes', button.dataset.delete!);
    refresh();
  }));
}

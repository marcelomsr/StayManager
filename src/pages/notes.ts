import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listNotes, saveNote, saveNotesOrder, softDelete } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { Note } from '../types';
import { bindNoteSorting } from '../utils/note-sorting';

let notes: Note[] = [];

type NoteEditor = {
  note: Note;
  card: HTMLElement;
  persisted: boolean;
  savedTitle: string;
  savedBody: string;
  timer?: number;
  saving?: Promise<boolean>;
  deleting: boolean;
};

const pendingEditors = new Set<NoteEditor>();
window.addEventListener('beforeunload', (event) => {
  if (!pendingEditors.size) return;
  event.preventDefault();
  event.returnValue = '';
});

function noteCard(note: Note, editable: boolean) {
  return `
    <article class="note-card" data-note-id="${escapeHtml(note.id)}" aria-label="Anotação">
      <div class="note-card-toolbar">
        <button type="button" class="note-drag-handle" aria-label="Mover anotação" aria-describedby="notes-sort-help" aria-pressed="false" title="Arraste para mover ou use as setas do teclado" ${editable ? '' : 'disabled'}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>
        </button>
        <span class="note-save-status" role="status" aria-live="polite">Salvo</span>
        <button type="button" class="note-save-retry" hidden>Tentar novamente</button>
      </div>
      <input class="note-title" aria-label="Título da anotação" placeholder="Título" value="${escapeHtml(note.title)}" ${editable ? '' : 'readonly'} />
      <textarea class="note-body" aria-label="Texto da anotação" placeholder="Escreva sua anotação…" rows="5" ${editable ? '' : 'readonly'}>${escapeHtml(note.body)}</textarea>
      <div class="note-actions">
        <button type="button" data-copy>Copiar</button>
        <button type="button" class="danger" data-delete ${editable ? '' : 'disabled'}>Excluir</button>
      </div>
    </article>`;
}

export async function renderNotes() {
  if (!state.company) return appShell('');
  notes = await listNotes(state.company.id);
  const editable = isCompanyActive();
  return appShell(`
    ${pageHeader('Anotações')}
    <section class="notes-board" aria-label="Quadro de anotações">
      <p class="notes-help" id="notes-sort-help">Edite diretamente nos cards. As alterações são salvas automaticamente. Arraste pela alça para organizar ou selecione a alça e use as setas do teclado.</p>
      <p class="notes-order-status" role="status" aria-live="polite"></p>
      <button type="button" class="notes-order-retry" hidden>Tentar salvar a ordem novamente</button>
      <div class="notes-grid">${notes.map((note) => noteCard(note, editable)).join('')}</div>
      <p class="notes-empty" ${notes.length ? 'hidden' : ''}>Nenhuma anotação ainda. Toque em + para começar.</p>
    </section>
    <button type="button" id="add-note" class="primary notes-add" aria-label="Adicionar anotação" title="Adicionar anotação" ${editable ? '' : 'disabled'}>
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  `);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Alguns navegadores expõem a API, mas bloqueiam o acesso neste contexto.
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
  if (!copied) throw new Error('Copy failed');
}

export function bindNotes() {
  const grid = qs<HTMLElement>('.notes-grid');
  if (!grid || !state.company) return;
  // As operações pendentes continuam vinculadas à empresa original ao trocar de tela.
  const companyId = state.company.id;
  const emptyState = qs<HTMLElement>('.notes-empty')!;
  const editors: NoteEditor[] = [];
  const orderStatus = qs<HTMLElement>('.notes-order-status')!;
  const orderRetry = qs<HTMLButtonElement>('.notes-order-retry')!;
  let orderRevision = 0;
  let savedOrderRevision = 0;
  let orderSaving: Promise<void> | undefined;
  let draftCounter = 0;

  const resizeBody = (body: HTMLTextAreaElement) => {
    body.style.height = 'auto';
    body.style.height = `${body.scrollHeight + body.offsetHeight - body.clientHeight}px`;
  };
  let boardWidth = grid.clientWidth;
  const resizeObserver = new ResizeObserver(() => {
    if (!grid.isConnected) {
      resizeObserver.disconnect();
      return;
    }
    if (grid.clientWidth === boardWidth) return;
    boardWidth = grid.clientWidth;
    grid.querySelectorAll<HTMLTextAreaElement>('.note-body').forEach(resizeBody);
  });
  resizeObserver.observe(grid);

  const status = (editor: NoteEditor, message: string, failed = false) => {
    qs<HTMLElement>('.note-save-status', editor.card)!.textContent = message;
    qs<HTMLButtonElement>('.note-save-retry', editor.card)!.hidden = !failed;
    editor.card.classList.toggle('has-save-error', failed);
  };

  const persist = (editor: NoteEditor): Promise<boolean> => {
    window.clearTimeout(editor.timer);
    if (editor.saving) return editor.saving;
    editor.saving = Promise.resolve().then(async () => {
      try {
        while (!editor.persisted || editor.note.title !== editor.savedTitle || editor.note.body !== editor.savedBody) {
          const { title, body, position } = editor.note;
          status(editor, 'Salvando…');
          const saved = await saveNote(companyId, {
            ...(editor.persisted ? { id: editor.note.id } : { position }),
            title, body, active: true
          });
          editor.note.id = saved.id;
          editor.card.dataset.noteId = saved.id;
          editor.persisted = true;
          editor.savedTitle = title;
          editor.savedBody = body;
        }
        pendingEditors.delete(editor);
        status(editor, 'Salvo');
        return true;
      } catch {
        status(editor, 'Não foi possível salvar', true);
        return false;
      } finally {
        editor.saving = undefined;
      }
    });
    return editor.saving;
  };

  // Serializa as mudanças de ordem, incluindo cards cuja criação ainda está pendente.
  const persistOrder = (): Promise<void> => {
    if (orderSaving) return orderSaving;
    orderSaving = Promise.resolve().then(async () => {
      try {
        while (savedOrderRevision !== orderRevision) {
          const revision = orderRevision;
          const ordered = [...editors];
          orderStatus.textContent = 'Salvando ordem…';
          orderRetry.hidden = true;
          for (const editor of ordered) {
            if (editor.deleting) continue;
            if (!editor.persisted && !await persist(editor)) throw new Error('Anotação pendente.');
          }
          // Uma exclusão ou novo arraste durante a criação exige outra fotografia da ordem.
          if (revision !== orderRevision) continue;
          try {
            await saveNotesOrder(companyId, ordered.filter((editor) => !editor.deleting).map((editor) => editor.note.id));
          } catch (error) {
            if (revision !== orderRevision) continue;
            throw error;
          }
          savedOrderRevision = revision;
        }
        orderStatus.textContent = 'Ordem salva.';
      } catch {
        orderStatus.textContent = 'Não foi possível salvar a ordem.';
        orderRetry.hidden = false;
      } finally {
        orderSaving = undefined;
      }
    });
    return orderSaving;
  };

  const syncOrder = () => {
    editors.sort((a, b) => Array.from(grid.children).indexOf(a.card) - Array.from(grid.children).indexOf(b.card));
    editors.forEach((editor, index) => { editor.note.position = index; });
    orderRevision++;
    void persistOrder();
  };

  const attachCard = (note: Note, card: HTMLElement, persisted: boolean) => {
    const editor: NoteEditor = { note, card, persisted, savedTitle: note.title, savedBody: note.body, deleting: false };
    editors.push(editor);
    const title = qs<HTMLInputElement>('.note-title', card)!;
    const body = qs<HTMLTextAreaElement>('.note-body', card)!;
    resizeBody(body);
    const changed = () => {
      if (!isCompanyActive() || editor.deleting) return;
      note.title = title.value;
      note.body = body.value;
      resizeBody(body);
      pendingEditors.add(editor);
      status(editor, 'Alterações pendentes…');
      window.clearTimeout(editor.timer);
      editor.timer = window.setTimeout(() => void persist(editor), 600);
    };
    title.addEventListener('input', changed);
    body.addEventListener('input', changed);
    for (const field of [title, body]) {
      field.addEventListener('blur', () => {
        if (pendingEditors.has(editor) && !editor.deleting) void persist(editor);
      });
    }
    qs<HTMLButtonElement>('.note-save-retry', card)!.addEventListener('click', () => {
      void persist(editor).then((saved) => { if (saved && orderRevision !== savedOrderRevision) void persistOrder(); });
    });
    qs<HTMLButtonElement>('[data-copy]', card)!.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      try {
        await copyText(body.value);
        button.textContent = 'Copiado!';
        button.disabled = true;
        window.setTimeout(() => { button.textContent = 'Copiar'; button.disabled = false; }, 1600);
      } catch {
        toast('Não foi possível copiar a anotação.', 'error');
      }
    });
    qs<HTMLButtonElement>('[data-delete]', card)!.addEventListener('click', async () => {
      if (!isCompanyActive() || editor.deleting) return;
      editor.deleting = true;
      window.clearTimeout(editor.timer);
      card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button').forEach((field) => { field.disabled = true; });
      try {
        // Espera a criação/edição em andamento para não ressuscitar uma nota excluída.
        if (editor.saving) await editor.saving;
        if (editor.persisted) await softDelete('notes', note.id);
        pendingEditors.delete(editor);
        editors.splice(editors.indexOf(editor), 1);
        card.remove();
        emptyState.hidden = editors.length > 0;
        syncOrder();
      } catch {
        editor.deleting = false;
        card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button').forEach((field) => { field.disabled = false; });
        toast('Não foi possível excluir a anotação. Tente novamente.', 'error');
      }
    });
    return editor;
  };

  grid.querySelectorAll<HTMLElement>('.note-card').forEach((card, index) => attachCard(notes[index], card, true));
  bindNoteSorting(grid, syncOrder);
  orderRetry.addEventListener('click', () => void persistOrder());
  qs<HTMLButtonElement>('#add-note')!.addEventListener('click', () => {
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    const note: Note = {
      id: `draft-${++draftCounter}`, company_id: companyId, title: '', body: '',
      position: Math.min(0, ...editors.map((editor) => editor.note.position)) - 1,
      active: true, deleted_at: null
    };
    grid.insertAdjacentHTML('afterbegin', noteCard(note, true));
    const card = grid.firstElementChild as HTMLElement;
    const editor = attachCard(note, card, false);
    pendingEditors.add(editor);
    emptyState.hidden = true;
    qs<HTMLInputElement>('.note-title', card)!.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    syncOrder();
  });
}

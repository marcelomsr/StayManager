/** Arraste pela alça: Pointer Events atende mouse, caneta e toque. */
export function bindNoteSorting(grid: HTMLElement, onReorder: () => void) {
  let dragging = false;

  grid.addEventListener('keydown', (event) => {
    const handle = (event.target as Element).closest<HTMLButtonElement>('.note-drag-handle');
    if (!handle || handle.disabled || dragging) return;
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1
      : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    const card = handle.closest<HTMLElement>('.note-card')!;
    const target = direction < 0 ? card.previousElementSibling : card.nextElementSibling;
    if (!target?.matches('.note-card')) return;
    if (direction < 0) grid.insertBefore(card, target);
    else target.after(card);
    handle.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest' });
    onReorder();
  });

  grid.addEventListener('pointerdown', (event) => {
    const handle = (event.target as Element).closest<HTMLButtonElement>('.note-drag-handle');
    if (!handle || handle.disabled || dragging || !event.isPrimary || event.button !== 0) return;
    const card = handle.closest<HTMLElement>('.note-card')!;
    const originalOrder = Array.from(grid.children);
    const bounds = card.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    let pointerX = event.clientX;
    let pointerY = event.clientY;
    let preview: HTMLElement | null = null;
    let frame = 0;
    let lastTarget: Element | null = null;
    handle.setPointerCapture(event.pointerId);

    const moveCard = () => {
      if (!preview) return;
      preview.style.transform = `translate(${pointerX - offsetX}px, ${pointerY - offsetY}px)`;
      const target = document.elementFromPoint(pointerX, pointerY)?.closest<HTMLElement>('.note-card');
      if (!target || target === card || target === lastTarget || target.parentElement !== grid) return;
      lastTarget = target;
      const children = Array.from(grid.children);
      if (children.indexOf(card) < children.indexOf(target)) target.after(card);
      else grid.insertBefore(card, target);
      handle.setPointerCapture(event.pointerId);
    };

    const tick = () => {
      if (!grid.isConnected) {
        finish(true);
        return;
      }
      const edge = 80;
      const viewportHeight = window.innerHeight;
      const delta = pointerY < edge ? -Math.ceil((edge - Math.max(0, pointerY)) / 6)
        : pointerY > viewportHeight - edge ? Math.ceil((Math.min(viewportHeight, pointerY) - viewportHeight + edge) / 6) : 0;
      if (delta) window.scrollBy(0, delta);
      moveCard();
      frame = requestAnimationFrame(tick);
    };

    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      pointerX = next.clientX;
      pointerY = next.clientY;
      if (!preview && Math.hypot(pointerX - event.clientX, pointerY - event.clientY) < 6) return;
      next.preventDefault();
      if (!preview) {
        dragging = true;
        // Captura os valores atuais dos campos, inclusive alterações ainda não salvas.
        preview = card.cloneNode(true) as HTMLElement;
        preview.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field, index) => {
          field.value = card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')[index].value;
          field.removeAttribute('id');
        });
        preview.classList.add('note-drag-preview');
        preview.setAttribute('aria-hidden', 'true');
        preview.inert = true;
        preview.style.width = `${bounds.width}px`;
        preview.style.height = `${bounds.height}px`;
        document.body.appendChild(preview);
        card.classList.add('is-dragging');
        handle.setAttribute('aria-pressed', 'true');
        frame = requestAnimationFrame(tick);
      }
      moveCard();
    };

    const finish = (cancelled: boolean) => {
      cancelAnimationFrame(frame);
      preview?.remove();
      card.classList.remove('is-dragging');
      handle.setAttribute('aria-pressed', 'false');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      document.removeEventListener('keydown', keydown);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      dragging = false;
      if (!preview) return;
      if (cancelled) originalOrder.forEach((element) => grid.appendChild(element));
      else if (originalOrder.some((element, index) => grid.children[index] !== element)) onReorder();
      handle.focus({ preventScroll: true });
    };
    const up = (next: PointerEvent) => { if (next.pointerId === event.pointerId) finish(false); };
    const cancel = () => finish(true);
    const keydown = (next: KeyboardEvent) => {
      if (next.key === 'Escape') {
        next.preventDefault();
        finish(true);
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    document.addEventListener('keydown', keydown);
  });
}

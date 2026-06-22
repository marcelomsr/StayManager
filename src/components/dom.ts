export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((result, item, index) => result + item + (values[index] ?? ''), '');
}

export function qs<T extends Element>(selector: string, parent: ParentNode = document) {
  return parent.querySelector(selector) as T | null;
}

export function qsa<T extends Element>(selector: string, parent: ParentNode = document) {
  return Array.from(parent.querySelectorAll(selector)) as T[];
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toast(message: string, kind: 'info' | 'error' = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), 3200);
}

import { escapeHtml } from '../components/dom';

export type InlineGridOption = {
  name: string;
  color?: string;
};

type InlineCycleParams<T extends { id: string }, K extends keyof T & string> = {
  item: T;
  field: K;
  options: readonly InlineGridOption[];
  updatingFields: Set<string>;
  updateItem: (item: T) => void;
  replaceRow: (item: T) => void;
  persist: (previousItem: T, values: Pick<Partial<T>, K>) => Promise<T>;
  onError: (error: unknown) => void;
};

export const nextOptionName = (currentValue: string, options: readonly InlineGridOption[]) => {
  const currentIndex = options.findIndex((item) => item.name === currentValue);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;
  return options[nextIndex]?.name ?? currentValue;
};

export function badge(label: string, color = '#d8dde8') {
  return `<span class="badge" style="--badge:${color}">${escapeHtml(label)}</span>`;
}

export function editableBadge(params: {
  id: string;
  field: string;
  value: string;
  color?: string;
  isUpdating: boolean;
}) {
  const { id, field, value, color, isUpdating } = params;
  return `<button type="button" class="badge-button" data-cycle-field="${field}" data-inline-id="${id}" ${isUpdating ? 'disabled aria-busy="true"' : ''}>${badge(value, color)}</button>`;
}

export async function cycleInlineField<T extends { id: string }, K extends keyof T & string>({
  item,
  field,
  options,
  updatingFields,
  updateItem,
  replaceRow,
  persist,
  onError
}: InlineCycleParams<T, K>) {
  const key = `${item.id}:${field}`;
  if (updatingFields.has(key)) return;

  const previousItem = { ...item };
  const nextValue = nextOptionName(String(item[field]), options);
  const optimisticItem = { ...item, [field]: nextValue };
  const values = { [field]: nextValue } as Pick<Partial<T>, K>;

  updatingFields.add(key);
  updateItem(optimisticItem);
  replaceRow(optimisticItem);

  try {
    const updatedItem = await persist(previousItem, values);
    updatingFields.delete(key);
    updateItem(updatedItem);
    replaceRow(updatedItem);
  } catch (error) {
    updatingFields.delete(key);
    updateItem(previousItem);
    replaceRow(previousItem);
    onError(error);
  }
}

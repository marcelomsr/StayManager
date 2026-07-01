import { PAYMENT_STATUS_OPTIONS, RESERVATION_STATUS_OPTIONS } from '../config';
import { escapeHtml, qs, toast } from '../components/dom';
import { appShell, pageHeader } from '../components/layout';
import { listPlatforms, listStays, listStudios, saveStay, softDelete } from '../services/repositories';
import { state, isCompanyActive } from '../state/app-state';
import { Platform, Stay, Studio } from '../types';
import { calculateNights, isWithinNextDays, pad, toDateInput, toDateTimeInput, weekday } from '../utils/date';
import { brl, numberValue, optionalNumberValue } from '../utils/format';

let stays: Stay[] = [];
let studios: Studio[] = [];
let platforms: Platform[] = [];

// Função auxiliar local para formatar valores numéricos no padrão pt-BR para os inputs
const formatarMoedaInput = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
};

// Função auxiliar para converter string pt-BR (195,67) em número JS válido (195.67)
const converterStringParaNumero = (valor: any): number => {
  if (!valor) return 0;
  const texto = String(valor).trim();
  if (texto.includes(',')) {
    return Number(texto.replace(/\./g, '').replace(',', '.'));
  }
  return Number(texto) || 0;
};

const formatDateTime = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  const datePart = date.toLocaleDateString('pt-BR');
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
};

const localDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shortWeekday = (value: string) => weekday(value).replace(/-feira$/, '');

// Função auxiliar para anexar o fuso horário local e evitar perda de horas
const formatarISOComFusoLocal = (dateTimeStr: string): string => {
  if (!dateTimeStr) return '';
  // Se já tiver fuso ou formato completo, não mexe
  if (dateTimeStr.includes('Z') || (dateTimeStr.includes('+') && dateTimeStr.length > 16)) return dateTimeStr;
  
  // Garante que a string tenha os segundos (:00) antes do fuso
  let baseDateTime = dateTimeStr;
  if (baseDateTime.length === 16) {
    baseDateTime += ':00';
  }
  
  const date = new Date(dateTimeStr);
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  
  return baseDateTime + dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
};

export async function renderHospedagens() {
  if (!state.company) return appShell('');
  const params = new URLSearchParams(state.route.split('?')[1] ?? '');
  const filters = Object.fromEntries(params.entries());
  if (!filters.start) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filters.start = localDateInput(sevenDaysAgo);
  }
  if (!filters.end) {
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    filters.end = localDateInput(tenDaysFromNow);
  }
  [studios, platforms, stays] = await Promise.all([listStudios(state.company.id), listPlatforms(state.company.id), listStays(state.company.id, filters)]);
  const edit = stays.find((stay) => stay.id === params.get('id'));
  return appShell(`
    ${pageHeader('Hospedagens')}
    <section class="panel">
      <form id="stay-filters" class="filters">
        <select name="studio_id"><option value="">Studio</option>${studios.map((item) => `<option value="${item.id}" ${filters.studio_id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
        <select name="platform_id"><option value="">Plataforma</option>${platforms.map((item) => `<option value="${item.id}" ${filters.platform_id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
        <select name="reservation_status"><option value="">Status reserva</option>${RESERVATION_STATUS_OPTIONS.map((item) => `<option ${filters.reservation_status === item.name ? 'selected' : ''}>${item.name}</option>`).join('')}</select>
        <select name="payment_status"><option value="">Pagamento</option>${PAYMENT_STATUS_OPTIONS.map((item) => `<option ${filters.payment_status === item.name ? 'selected' : ''}>${item.name}</option>`).join('')}</select>
        <input type="date" name="start" value="${filters.start ?? ''}" />
        <input type="date" name="end" value="${filters.end ?? ''}" />
        <input name="q" placeholder="Hóspede" value="${escapeHtml(filters.q ?? '')}" />
        <button>Filtrar</button>
      </form>
    </section>
    <section class="split wide-left">
      ${stayForm(edit)}
      <section class="panel table-wrap stays-table">
        <table>
          <thead><tr><th>Entrada</th><th>Saída</th><th>Dia da saída</th><th>Studio</th><th>Hóspedes</th><th>Diárias</th><th>Plataforma</th><th>Status</th><th>Pagamento</th><th>Total</th><th>Taxas</th><th>Líquido</th><th>Diária</th><th></th></tr></thead>
          <tbody>${stays.map((stay) => `
            <tr class="${isWithinNextDays(stay.check_in_at, 7) ? 'upcoming' : ''}">
              <td>${formatDateTime(stay.check_in_at)}</td>
              <td>${formatDateTime(stay.check_out_at)}</td>
              <td>${shortWeekday(stay.check_out_at)}</td>
              <td><span class="stay-studio-cell">${escapeHtml(stay.studios?.name)}${stay.car_info?.trim() ? `<button type="button" class="car-info-button" data-car="${stay.id}" aria-label="Ver informações do veículo" title="Ver informações do veículo">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 11 6.5 7h11l1.5 4m-14 0h14a2 2 0 0 1 2 2v4h-2v2h-2v-2H7v2H5v-2H3v-4a2 2 0 0 1 2-2Zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>
              </button>` : ''}</span></td>
              <td>${escapeHtml(stay.guests_names)}</td>
              <td>${stay.nights_count}</td>
              <td>${badge(stay.platforms?.name ?? '', stay.platforms?.color)}</td>
              <td>${badge(stay.reservation_status, RESERVATION_STATUS_OPTIONS.find((item) => item.name === stay.reservation_status)?.color)}</td>
              <td>${badge(stay.payment_status, PAYMENT_STATUS_OPTIONS.find((item) => item.name === stay.payment_status)?.color)}</td>
              <td>${brl(stay.total_amount)}</td>
              <td>${brl(stay.fees_amount)}</td>
              <td>${brl(stay.net_amount)}</td>
              <td>${brl(stay.daily_amount)}</td>
              <td class="row-actions"><div><button data-edit="${stay.id}">Editar</button><button class="danger" data-delete="${stay.id}">Excluir</button></div></td>
            </tr>`).join('')}</tbody>
        </table>
      </section>
    </section>
    <dialog id="car-info-dialog" class="car-info-dialog">
      <h2>Informações do veículo</h2>
      <p id="car-info-content"></p>
      <p id="car-info-plate-error" class="car-info-plate-error" hidden>Não foi possível identificar a placa.</p>
      <form method="dialog">
        <button type="button" id="copy-car-plate">Copiar placa</button>
        <button>Fechar</button>
      </form>
    </dialog>
  `);
}

function stayForm(stay?: Stay) {
  const studio = studios.find((item) => item.id === stay?.studio_id);
  const activeStudios = studios.filter((item) => item.active);
  const studioOptions = stay
    ? [...activeStudios, ...(studio && !studio.active ? [studio] : [])]
    : activeStudios;

  const defaultCheckInTime = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    return `${yyyy}-${mm}-${dd}T14:00`;
  };

  const defaultCheckOutTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = pad(tomorrow.getMonth() + 1);
    const dd = pad(tomorrow.getDate());
    return `${yyyy}-${mm}-${dd}T11:00`;
  };

  const checkInValue = stay ? toDateTimeInput(stay.check_in_at) : defaultCheckInTime();
  const checkOutValue = stay ? toDateTimeInput(stay.check_out_at) : defaultCheckOutTime();
  const reservationDateValue = stay ? toDateInput(stay.reservation_date) : localDateInput(new Date());
  const nightsValue = stay ? stay.nights_count : 1;

  // CONDICIONAL: Verifica se a hospedagem atual está com status cancelado para liberar a edição visual logo de início
  const isCancelado = stay?.reservation_status === 'Cancelado';
  const readonlyAttr = isCancelado ? '' : 'readonly';
  const backgroundStyle = isCancelado ? '' : 'background-color: #f1f3f5; cursor: not-allowed;';

  return `
    <form id="stay-form" class="panel form-grid">
      <h2>${stay ? 'Editar hospedagem' : 'Nova hospedagem'}</h2>
      <input type="hidden" name="id" value="${stay?.id ?? ''}" />
      <label>Studio <select name="studio_id" required>${studioOptions.map((item) => `<option value="${item.id}" ${stay?.studio_id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}${!item.active ? ' (inativo)' : ''}</option>`).join('')}</select></label>
      <label>Entrada <input type="datetime-local" name="check_in_at" value="${checkInValue}" required /></label>
      <label>Saída <input type="datetime-local" name="check_out_at" value="${checkOutValue}" required /></label>
      <label>Hóspedes <textarea name="guests_names" required>${escapeHtml(stay?.guests_names)}</textarea></label>
      <label>Qtd. hóspedes <input type="number" min="1" name="guests_count" value="${stay?.guests_count ?? 1}" /></label>
      <label>Data reserva <input type="date" name="reservation_date" value="${reservationDateValue}" required /></label>
      <label>Qtd. diárias <input type="number" min="0" name="nights_count" value="${nightsValue}" /></label>
      <label>Plataforma <select name="platform_id" required>${platforms.map((item) => `<option value="${item.id}" ${stay?.platform_id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
      <label>Status reserva <select name="reservation_status">${RESERVATION_STATUS_OPTIONS.map((item) => `<option ${stay?.reservation_status === item.name ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label>
      <label>Observação <textarea name="notes">${escapeHtml(stay?.notes)}</textarea></label>
      <label class="garage-field ${studio?.has_garage ? '' : 'hidden'}">Informações do carro <input type="text" name="car_info" value="${escapeHtml(stay?.car_info)}" /></label>
      <label>Valor total <input name="total_amount" inputmode="decimal" value="${formatarMoedaInput(stay?.total_amount ?? 0)}" /></label>
      <label>Taxas <input name="fees_amount" inputmode="decimal" value="${formatarMoedaInput(stay?.fees_amount ?? 0)}" /></label>
      <label>Valor líquido <input name="net_amount" inputmode="decimal" value="${formatarMoedaInput(stay?.net_amount)}" ${readonlyAttr} style="${backgroundStyle}" /></label>
      <label>Valor diária <input name="daily_amount" inputmode="decimal" value="${formatarMoedaInput(stay?.daily_amount)}" readonly style="background-color: #f1f3f5; cursor: not-allowed;" /></label>
      <label>Status pagamento <select name="payment_status">${PAYMENT_STATUS_OPTIONS.map((item) => `<option ${stay?.payment_status === item.name ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label>
      <div style="display: flex; gap: 8px;">
        <button class="primary">${stay ? 'Salvar alteração' : 'Salvar hospedagem'}</button>
        ${stay ? '<button type="button" id="cancel-edit" class="ghost">Cancelar</button>' : ''}
      </div>
    </form>`;
}

function badge(label: string, color = '#d8dde8') {
  return `<span class="badge" style="--badge:${color}">${escapeHtml(label)}</span>`;
}

export function bindHospedagens(refresh: () => void) {
  const filterForm = qs<HTMLFormElement>('#stay-filters');
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(filterForm).forEach((value, key) => {
      if (String(value)) params.set(key, String(value));
    });
    location.hash = `/hospedagens?${params.toString()}`;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    const params = new URLSearchParams(state.route.split('?')[1] ?? '');
    params.set('id', button.dataset.edit!);
    location.hash = `/hospedagens?${params.toString()}`;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await softDelete('stays', button.dataset.delete!);
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao excluir hospedagem.', 'error');
    }
  }));
  const carInfoDialog = qs<HTMLDialogElement>('#car-info-dialog');
  const carInfoContent = qs<HTMLElement>('#car-info-content');
  const copyCarPlateButton = qs<HTMLButtonElement>('#copy-car-plate');
  const carInfoPlateError = qs<HTMLElement>('#car-info-plate-error');
  let currentCarPlate: string | null = null;

  document.querySelectorAll<HTMLButtonElement>('[data-car]').forEach((button) => button.addEventListener('click', () => {
    const stay = stays.find((item) => item.id === button.dataset.car);
    if (!stay?.car_info || !carInfoDialog || !carInfoContent || !copyCarPlateButton || !carInfoPlateError) return;
    const carInfoParts = stay.car_info.split(' - ');
    currentCarPlate = carInfoParts.length >= 3 ? carInfoParts[1].trim() || null : null;
    carInfoContent.textContent = stay.car_info;
    copyCarPlateButton.textContent = currentCarPlate ? `Copiar placa ${currentCarPlate}` : 'Copiar placa';
    copyCarPlateButton.disabled = !currentCarPlate;
    carInfoPlateError.hidden = Boolean(currentCarPlate);
    carInfoDialog.showModal();
  }));
  copyCarPlateButton?.addEventListener('click', async () => {
    if (!currentCarPlate) return;
    try {
      await navigator.clipboard.writeText(currentCarPlate);
      toast('Placa copiada.');
    } catch {
      toast('Não foi possível copiar a placa.', 'error');
    }
  });

  qs<HTMLButtonElement>('#cancel-edit')?.addEventListener('click', () => {
    location.hash = '/hospedagens';
  });

  const form = qs<HTMLFormElement>('#stay-form');
  if (!form) return;

  const recalc = () => {
    const checkIn = (form.check_in_at as HTMLInputElement).value;
    const checkOut = (form.check_out_at as HTMLInputElement).value;
    const statusReserva = (form.reservation_status as HTMLSelectElement).value;
    const nights = calculateNights(checkIn, checkOut);
    
    if (!(form.nights_count as HTMLInputElement).dataset.manual) {
      (form.nights_count as HTMLInputElement).value = String(nights);
    }
    
    const total = converterStringParaNumero((form.total_amount as HTMLInputElement).value);
    const fees = converterStringParaNumero((form.fees_amount as HTMLInputElement).value);
    
    // REGRA DE CÁLCULO AUTO: Só calcula o líquido automaticamente se o status NÃO for Cancelado, ou se for cancelado e o campo estiver vazio
    const netInput = form.net_amount as HTMLInputElement;
    if (statusReserva !== 'Cancelado' || !netInput.value) {
      const net = total - fees;
      netInput.value = formatarMoedaInput(net);
    }
    
    const netFinal = converterStringParaNumero(netInput.value);
    const nightsInputVal = (form.nights_count as HTMLInputElement).value;
    const currentNights = nightsInputVal !== '' ? Number(nightsInputVal) : NaN;
    
    if (currentNights > 0 && !isNaN(netFinal)) {
      (form.daily_amount as HTMLInputElement).value = formatarMoedaInput(netFinal / currentNights);
    } else {
      (form.daily_amount as HTMLInputElement).value = '';
    }
  };
  
  ['check_in_at', 'check_out_at', 'total_amount', 'fees_amount', 'nights_count'].forEach((name) => form[name].addEventListener('input', recalc));
  form.nights_count.addEventListener('input', () => (form.nights_count.dataset.manual = 'true'));
  
  // OUVINTE DINÂMICO: Se mudar o select de status em tempo real, bloqueia ou desbloqueia o campo líquido
  form.reservation_status.addEventListener('change', () => {
    const status = form.reservation_status.value;
    const netInput = form.net_amount as HTMLInputElement;
    if (status === 'Cancelado') {
      netInput.removeAttribute('readonly');
      netInput.style.backgroundColor = '';
      netInput.style.cursor = '';
    } else {
      netInput.setAttribute('readonly', 'true');
      netInput.style.backgroundColor = '#f1f3f5';
      netInput.style.cursor = 'not-allowed';
      recalc(); // Refaz o cálculo matemático padrão se voltar para outro status
    }
  });

  form.studio_id.addEventListener('change', () => {
    const studio = studios.find((item) => item.id === form.studio_id.value);
    qs<HTMLElement>('.garage-field', form)?.classList.toggle('hidden', !studio?.has_garage);
  });

  // Permitir digitação de vírgula e travar o ponto
  ['total_amount', 'fees_amount', 'net_amount'].forEach((name) => {
    const inputElement = form[name] as HTMLInputElement;
    if (inputElement) {
      inputElement.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === '.') {
          event.preventDefault();
        }
      });
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    if (!isCompanyActive()) {
      toast('Não é possível cadastrar em uma empresa inativa.', 'error');
      return;
    }
    
    recalc();
    const data = new FormData(form);
    
    const checkIn = String(data.get('check_in_at'));
    const checkOut = String(data.get('check_out_at'));
    if (checkOut.slice(0, 10) <= checkIn.slice(0, 10)) {
      toast('A data de saída deve ser posterior à data de entrada (dias diferentes).', 'error');
      return;
    }

    const nightsCount = Number(data.get('nights_count') || 0);
    const reservationStatus = String(data.get('reservation_status'));
    if (nightsCount === 0 && reservationStatus !== 'Cancelado') {
      toast('Uma hospedagem com 0 diárias deve ter o status Cancelado.', 'error');
      return;
    }

    const reservationDate = String(data.get('reservation_date') || '');
    if (!reservationDate) {
      toast('A data de reserva é obrigatória.', 'error');
      return;
    }

    const total_amount = converterStringParaNumero((form.total_amount as HTMLInputElement).value);
    const fees_amount = converterStringParaNumero((form.fees_amount as HTMLInputElement).value);
    
    // Captura o valor líquido de forma dinâmica (seja calculado ou digitado no caso do Cancelado)
    const net_amount = converterStringParaNumero((form.net_amount as HTMLInputElement).value);
    const daily_amount = nightsCount > 0 ? (net_amount / nightsCount) : null;

    try {
      await saveStay(state.company!.id, {
        id: String(data.get('id') || '') || undefined,
        studio_id: String(data.get('studio_id')),
        platform_id: String(data.get('platform_id')),
        check_in_at: formatarISOComFusoLocal(checkIn),
        check_out_at: formatarISOComFusoLocal(checkOut),
        guests_names: String(data.get('guests_names')),
        guests_count: Number(data.get('guests_count') || 1),
        reservation_date: reservationDate,
        nights_count: nightsCount,
        reservation_status: reservationStatus,
        notes: String(data.get('notes') || '') || null,
        car_info: String(data.get('car_info') || '') || null,
        total_amount: total_amount,
        fees_amount: fees_amount,
        net_amount: net_amount,
        daily_amount: daily_amount,
        payment_status: String(data.get('payment_status'))
      });
      
      toast('Hospedagem salva.');
      
      form.reset();
      delete (form.nights_count as HTMLInputElement).dataset.manual;
      location.hash = '/hospedagens';
      refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao salvar hospedagem.', 'error');
    }
  });
}

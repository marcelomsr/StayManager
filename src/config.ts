export const APP_TIMEZONE = 'America/Sao_Paulo';

export const PLATFORM_OPTIONS = [
  { name: 'Airbnb', color: '#f8a6c8' },
  { name: 'Booking', color: '#8ed8ff' },
  { name: 'Particular', color: '#d8b8ff' }
] as const;

export const RESERVATION_STATUS_OPTIONS = [
  { name: 'Reservado', color: '#1f4f9a' },
  { name: 'Autorizado', color: '#8752d9' },
  { name: 'Instruído', color: '#c6a8ff' },
  { name: 'Em andamento', color: '#ffe08a' },
  { name: 'Concluído', color: '#9fe6b1' },
  { name: 'Cancelado', color: '#ff8f8f' }
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { name: 'A receber', color: '#ff8f8f' },
  { name: 'Recebido', color: '#8ec5ff' }
] as const;

export const CASH_DESCRIPTIONS = [
  'Gasolina para o carro',
  'Gasolina para a moto',
  'Lavadora e secadora',
  'Produtos de limpeza'
];

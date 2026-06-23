export type Id = string;

export type AppUser = {
  id: Id;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
};

export type Company = {
  id: Id;
  name: string;
  active: boolean;
  deleted_at: string | null;
};

export type CompanyUser = {
  id: Id;
  company_id: Id;
  user_id: Id | null;
  email: string;
  is_admin: boolean;
};

export type Studio = {
  id: Id;
  company_id: Id;
  name: string;
  has_garage: boolean;
  active: boolean;
  deleted_at: string | null;
};

export type Platform = {
  id: Id;
  company_id: Id;
  name: string;
  color: string;
  active: boolean;
};

export type Stay = {
  id: Id;
  company_id: Id;
  studio_id: Id;
  platform_id: Id;
  check_in_at: string;
  check_out_at: string;
  guests_names: string;
  guests_count: number;
  reservation_date: string | null;
  nights_count: number;
  reservation_status: string;
  notes: string | null;
  car_info: string | null;
  total_amount: number;
  fees_amount: number;
  net_amount: number | null;
  daily_amount: number | null;
  payment_status: string;
  active: boolean;
  deleted_at: string | null;
  studios?: Studio;
  platforms?: Platform;
};

export type ExpenseType = {
  id: Id;
  company_id: Id;
  name: string;
  active: boolean;
  deleted_at: string | null;
  studio_ids?: Id[];
};

export type ExpenseEntry = {
  id: Id;
  company_id: Id;
  studio_id: Id;
  expense_type_id: Id;
  reference_month: string;
  payment_status: string;
  amount: number;
  notes: string | null;
  expense_types?: ExpenseType;
  studios?: Studio;
};

export type CashEntry = {
  id: Id;
  company_id: Id;
  kind: 'entrada' | 'saida';
  entry_date: string;
  description: string;
  amount: number;
};

export type Note = {
  id: Id;
  company_id: Id;
  title: string;
  body: string;
  active: boolean;
  deleted_at: string | null;
};

export type MonthRef = {
  year: number;
  month: number;
};

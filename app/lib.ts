export type Role = 'admin' | 'staff' | 'client';
export type PayFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly';
export type LoanType = 'personal' | 'business' | 'emergency' | 'refinancing' | 'other';
export type LoanCategory = 'cash' | 'vehicle' | 'home' | 'health' | 'education' | 'business' | 'other';
export type LoanPlanMode = 'contract_total' | 'monthly_split' | 'fixed_installment' | 'dual_stream';
export type InstallmentKind = 'monthly' | 'weekly';
export type PenaltyMode = 'none' | 'fixed_once' | 'percent_once' | 'fixed_daily' | 'percent_daily';
export type Page = 'home' | 'clients' | 'new-client' | 'client-detail' | 'loans' | 'new-loan' | 'loan-detail' | 'payments' | 'calendar' | 'collections' | 'reports' | 'dashboard' | 'team' | 'settings' | 'client-home';
export type PaymentMethod = 'cash' | 'pix' | 'transfer';
export type RiskLevel = 'Baixo risco' | 'Médio risco' | 'Alto risco';
export type InstallmentStatus = 'Pendente' | 'Aguardando' | 'Pago' | 'Atrasado';

export interface Reference {
  name: string;
  phone: string;
  relation: string;
  hasWhatsapp: boolean;
  validated: boolean;
}
export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: string;
}
export interface Client {
  id: string;
  name: string;
  cpf: string;
  rg: string;
  phone: string;
  address: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  income: number;
  photo?: string;
  location?: GeoLocation | null;
  locationConsent: boolean;
  accessPin: string;
  references: Reference[];
  documents: string[];
  signature?: string;
  createdAt: string;
  active: boolean;
}
export interface AccessAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  clientId?: string;
  active: boolean;
}
export interface Installment {
  id: string; number: number; dueDate: string; principal: number; interest: number;
  amount: number; paidAmount: number; status: InstallmentStatus; paidAt?: string; receiptName?: string;
  paymentMethod?: PaymentMethod; kind?: InstallmentKind;
}
export interface PaymentRecord {
  paidAmount: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  receiptName?: string;
}
export interface Loan {
  id: string; clientId: string; contractNumber: string; principal: number; rate: number;
  interestMode: 'total' | 'balance'; weeks: number; firstDueDate: string; frequency?: PayFrequency;
  feeType: 'fixed' | 'percent'; feeValue: number; lateInterest: number; status: 'Ativo' | 'Quitado' | 'Renegociado';
  installments: Installment[]; createdAt: string; originalLoanId?: string;
  loanType?: LoanType; category?: LoanCategory; planMode?: LoanPlanMode; termMonths?: number;
  fixedInstallment?: number; weeklyInterest?: number; weeklyAmount?: number; weeklyWeekday?: number;
  paymentWeekdays?: number[]; penaltyMode?: PenaltyMode; penaltyValue?: number;
  startDate?: string; endDate?: string; monthlyDueDay?: number;
}
export interface TeamMember { id: string; name: string; email: string; active: boolean; permissions: string[] }
export interface AppSettings { companyName: string; document: string; phone: string; pixKey: string; defaultRate: number; defaultWeeks: number; defaultFrequency: PayFrequency; feeType: 'fixed' | 'percent'; feeValue: number; lateInterest: number; reminderDays: number }

const today = new Date();
const dateAt = (days: number) => {
  const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

export const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
export const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const daysLate = (dueDate: string) => Math.max(0, Math.floor((new Date().setHours(0,0,0,0) - new Date(`${dueDate}T00:00:00`).getTime()) / 86400000));

export function digitsOnly(value: string) {
  return (value || '').replace(/\D/g, '');
}

export function brPhoneDigits(phone: string) {
  const digits = digitsOnly(phone);
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function whatsappHref(phone: string) {
  return `https://wa.me/${brPhoneDigits(phone)}`;
}

export function callHref(phone: string) {
  return `tel:+${brPhoneDigits(phone)}`;
}

export function referenceHref(ref: Pick<Reference, 'phone' | 'hasWhatsapp'>) {
  return ref.hasWhatsapp ? whatsappHref(ref.phone) : callHref(ref.phone);
}

export function formatAddress(parts: Pick<Client, 'street' | 'number' | 'complement' | 'neighborhood' | 'city' | 'state' | 'zip'>) {
  const line = [parts.street, parts.number].filter(Boolean).join(', ');
  const extra = [parts.complement, parts.neighborhood].filter(Boolean).join(' — ');
  const city = [parts.city, parts.state].filter(Boolean).join('/');
  return [line, extra, city, parts.zip ? `CEP ${parts.zip}` : ''].filter(Boolean).join(' • ');
}

export function mapEmbedUrl(location: GeoLocation) {
  const delta = 0.012;
  const { lat, lng } = location;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function mapOpenUrl(location: GeoLocation) {
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`;
}

const IDB_NAME = 'lucas-empred';
const IDB_STORE = 'kv';

function openPersistDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openPersistDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : undefined;
    } catch {
      return undefined;
    }
  }
}

export async function persistSet<T>(key: string, value: T) {
  try {
    const db = await openPersistDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB may be blocked; fall through to localStorage */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded for large photos is expected; IndexedDB remains source of truth */
  }
}

export function compressImage(file: File, maxSize = 720, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a foto'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = () => reject(new Error('Imagem inválida'));
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseIsoDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = next.getDay();
  next.setDate(next.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return next;
}

export function weekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthCells(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function loanFrequency(loan: Pick<Loan, 'frequency'>): PayFrequency {
  if (loan.frequency === 'daily' || loan.frequency === 'fortnightly' || loan.frequency === 'monthly') return loan.frequency;
  return 'weekly';
}

export function frequencyLabel(frequency: PayFrequency) {
  if (frequency === 'daily') return 'Diário';
  if (frequency === 'fortnightly') return 'Quinzenal';
  if (frequency === 'monthly') return 'Mensal';
  return 'Semanal';
}

export function periodLabel(loan: Pick<Loan, 'weeks' | 'frequency' | 'termMonths'>) {
  if (loan.termMonths) return loan.termMonths === 1 ? '1 mês' : `${loan.termMonths} meses`;
  const count = Math.max(1, loan.weeks);
  if (loanFrequency(loan) === 'monthly') return count === 1 ? '1 mês' : `${count} meses`;
  if (loanFrequency(loan) === 'daily') return count === 1 ? '1 diária' : `${count} diárias`;
  if (loanFrequency(loan) === 'fortnightly') return count === 1 ? '1 quinzena' : `${count} quinzenas`;
  return count === 1 ? '1 semana' : `${count} semanas`;
}

export function loanTypeLabel(value?: LoanType) {
  return ({ personal:'Empréstimo pessoal', business:'Capital de giro', emergency:'Emergência', refinancing:'Renegociação', other:'Outro' } as Record<LoanType,string>)[value || 'personal'];
}

export function loanCategoryLabel(value?: LoanCategory) {
  return ({ cash:'Dinheiro / PIX', vehicle:'Veículo', home:'Casa e reforma', health:'Saúde', education:'Educação', business:'Negócio', other:'Outros' } as Record<LoanCategory,string>)[value || 'cash'];
}

export function planModeLabel(value?: LoanPlanMode) {
  if (value === 'monthly_split') return 'Total mensal dividido no calendário';
  if (value === 'fixed_installment') return 'Parcela fixa por vencimento';
  if (value === 'dual_stream') return 'Parcela mensal + pagamento semanal';
  return 'Total do contrato em parcelas';
}

export function liveStatus(item: Installment): InstallmentStatus {
  if (item.status === 'Pago' || item.status === 'Aguardando') return item.status;
  if (daysLate(item.dueDate) > 0) return 'Atrasado';
  return item.status;
}

export function roundCents(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function splitEqual(total: number, count: number) {
  const n = Math.max(1, Number(count) || 1);
  const cents = Math.round(roundCents(total) * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, index) => (base + (index === n - 1 ? remainder : 0)) / 100);
}

export function rateFromInterest(principal: number, interest: number) {
  if (!principal) return 0;
  return roundCents((interest / principal) * 100);
}

export function formatRate(rate: number) {
  return rate.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function generateInstallments(input: Pick<Loan, 'principal' | 'rate' | 'interestMode' | 'weeks' | 'firstDueDate'> & { frequency?: PayFrequency; interestAmount?: number }): Installment[] {
  const count = Math.max(1, Number(input.weeks));
  const frequency = input.frequency || 'weekly';
  const principalTotal = Math.max(0, roundCents(input.principal));
  const totalInterest = input.interestAmount != null
    ? Math.max(0, roundCents(input.interestAmount))
    : Math.max(0, roundCents(principalTotal * (input.rate / 100)));
  const total = roundCents(principalTotal + totalInterest);
  const amounts = splitEqual(total, count);
  const principals = splitEqual(principalTotal, count);
  return amounts.map((amount, index) => {
    const due = parseIsoDate(input.firstDueDate);
    if (frequency === 'monthly') due.setMonth(due.getMonth() + index);
    else if (frequency === 'fortnightly') due.setDate(due.getDate() + index * 15);
    else if (frequency === 'daily') due.setDate(due.getDate() + index);
    else due.setDate(due.getDate() + index * 7);
    const principal = principals[index];
    const interest = roundCents(amount - principal);
    return {
      id: uid('parc'), number: index + 1, dueDate: toIsoDate(due), principal,
      interest, amount, paidAmount: 0, status: 'Pendente' as InstallmentStatus,
    };
  });
}

export interface FlexibleScheduleInput {
  principal: number;
  rate: number;
  firstDueDate: string;
  frequency: PayFrequency;
  planMode: LoanPlanMode;
  installmentCount: number;
  termMonths: number;
  fixedInstallment: number;
  paymentWeekdays?: number[];
}

function addMonthsClamped(date: Date, months: number) {
  const wantedDay = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(wantedDay, lastDay));
  return next;
}

function nextScheduleDate(date: Date, frequency: PayFrequency, weekdays: number[]) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (frequency === 'monthly') return addMonthsClamped(next, 1);
  next.setDate(next.getDate() + (frequency === 'fortnightly' ? 15 : frequency === 'weekly' ? 7 : 1));
  if (frequency === 'daily') {
    const allowed = weekdays.length ? weekdays : [1,2,3,4,5,6];
    while (!allowed.includes(next.getDay())) next.setDate(next.getDate() + 1);
  }
  return next;
}

function scheduleDates(input: FlexibleScheduleInput) {
  const weekdays = input.paymentWeekdays?.length ? input.paymentWeekdays : [1,2,3,4,5,6];
  let cursor = parseIsoDate(input.firstDueDate);
  if (input.frequency === 'daily') {
    while (!weekdays.includes(cursor.getDay())) cursor.setDate(cursor.getDate() + 1);
  }
  if (input.planMode === 'contract_total') {
    const count = Math.max(1, Math.min(1000, Number(input.installmentCount) || 1));
    return Array.from({ length: count }, (_, index) => {
      if (!index) return new Date(cursor);
      cursor = nextScheduleDate(cursor, input.frequency, weekdays);
      return new Date(cursor);
    });
  }
  const months = Math.max(1, Math.min(60, Number(input.termMonths) || 1));
  const lastMonth = new Date(cursor.getFullYear(), cursor.getMonth() + months, 0, 23, 59, 59);
  const dates: Date[] = [];
  while (cursor <= lastMonth && dates.length < 1000) {
    dates.push(new Date(cursor));
    cursor = nextScheduleDate(cursor, input.frequency, weekdays);
  }
  return dates;
}

export function generateFlexibleInstallments(input: FlexibleScheduleInput): Installment[] {
  const dates = scheduleDates(input);
  if (!dates.length) return [];
  const principal = Math.max(0, roundCents(input.principal));

  if (input.planMode === 'contract_total') {
    const interest = roundCents(principal * (Math.max(0, input.rate) / 100));
    const amounts = splitEqual(principal + interest, dates.length);
    const principals = splitEqual(principal, dates.length);
    return dates.map((due, index) => ({
      id: uid('parc'), number:index + 1, dueDate:toIsoDate(due), principal:principals[index],
      interest:roundCents(amounts[index] - principals[index]), amount:amounts[index], paidAmount:0, status:'Pendente',
    }));
  }

  const monthKeys = [...new Set(dates.map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}`))];
  const principalsByMonth = splitEqual(principal, Math.max(1, input.termMonths));
  let number = 0;
  const result: Installment[] = [];
  monthKeys.forEach((monthKey, monthIndex) => {
    const monthDates = dates.filter(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}` === monthKey);
    const monthPrincipal = principalsByMonth[monthIndex] || 0;
    const monthTotal = input.planMode === 'fixed_installment'
      ? roundCents(Math.max(0, input.fixedInstallment) * monthDates.length)
      : roundCents(monthPrincipal + principal * (Math.max(0, input.rate) / 100));
    const amounts = input.planMode === 'fixed_installment'
      ? monthDates.map(() => roundCents(Math.max(0, input.fixedInstallment)))
      : splitEqual(monthTotal, monthDates.length);
    const monthPrincipalUsed = Math.min(monthPrincipal, monthTotal);
    const principalParts = splitEqual(monthPrincipalUsed, monthDates.length);
    monthDates.forEach((due, index) => {
      number += 1;
      result.push({ id:uid('parc'), number, dueDate:toIsoDate(due), principal:principalParts[index],
        interest:roundCents(amounts[index] - principalParts[index]), amount:amounts[index], paidAmount:0, status:'Pendente' });
    });
  });
  if (input.planMode === 'fixed_installment') {
    const total = roundCents(result.reduce((sum, item) => sum + item.amount, 0));
    const principalParts = splitEqual(Math.min(principal, total), result.length);
    return result.map((item, index) => ({ ...item, principal:principalParts[index], interest:roundCents(item.amount - principalParts[index]) }));
  }
  return result;
}

export function tenthOfNextMonth(from = new Date()) {
  return toIsoDate(new Date(from.getFullYear(), from.getMonth() + 1, 10));
}

export function generateWeeklyInterestInstallments(input: {
  principal: number;
  weeklyInterest: number;
  firstDueDate: string;
  termMonths: number;
}): Installment[] {
  const dates = scheduleDates({
    principal: input.principal,
    rate: 0,
    firstDueDate: input.firstDueDate,
    frequency: 'weekly',
    planMode: 'monthly_split',
    installmentCount: 1,
    termMonths: input.termMonths,
    fixedInstallment: 0,
  });
  if (!dates.length) return [];
  const weeklyInterest = Math.max(0, roundCents(input.weeklyInterest));
  const principals = splitEqual(Math.max(0, roundCents(input.principal)), dates.length);
  return dates.map((due, index) => {
    const principal = principals[index];
    return {
      id: uid('parc'),
      number: index + 1,
      dueDate: toIsoDate(due),
      principal,
      interest: weeklyInterest,
      amount: roundCents(principal + weeklyInterest),
      paidAmount: 0,
      status: 'Pendente' as const,
    };
  });
}

export const WEEKDAY_OPTIONS = [
  { id: 1, short: 'Seg', label: 'Segunda-feira' },
  { id: 2, short: 'Ter', label: 'Terça-feira' },
  { id: 3, short: 'Qua', label: 'Quarta-feira' },
  { id: 4, short: 'Qui', label: 'Quinta-feira' },
  { id: 5, short: 'Sex', label: 'Sexta-feira' },
  { id: 6, short: 'Sáb', label: 'Sábado' },
  { id: 0, short: 'Dom', label: 'Domingo' },
] as const;

export function weekdayLabel(day?: number) {
  return WEEKDAY_OPTIONS.find(item => item.id === day)?.label || '—';
}

export function installmentKindLabel(kind?: InstallmentKind) {
  if (kind === 'monthly') return 'Mensal';
  if (kind === 'weekly') return 'Semanal';
  return 'Parcela';
}

export function isDualScheduleLoan(loan: Pick<Loan, 'planMode' | 'installments'>) {
  return loan.planMode === 'dual_stream' || loan.installments.some(item => item.kind === 'monthly' || item.kind === 'weekly');
}

function dueOnDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(1, day), lastDay), 12, 0, 0);
}

export function contractEndDate(startDate: string, termMonths: number) {
  return toIsoDate(addMonthsClamped(parseIsoDate(startDate), Math.max(1, termMonths)));
}

function nextWeekdayAfter(start: Date, weekday: number) {
  const cursor = addDays(start, 1);
  while (cursor.getDay() !== weekday) cursor.setDate(cursor.getDate() + 1);
  return cursor;
}

export interface DualScheduleInput {
  principal: number;
  startDate: string;
  termMonths: number;
  monthlyDueDay: number;
  weeklyAmount: number;
  weeklyWeekday: number;
}

export function generateDualSchedule(input: DualScheduleInput): Installment[] {
  const principal = Math.max(0, roundCents(input.principal));
  const months = Math.max(1, Math.min(60, Number(input.termMonths) || 1));
  const dueDay = Math.max(1, Math.min(31, Number(input.monthlyDueDay) || 1));
  const weeklyAmount = Math.max(0, roundCents(input.weeklyAmount));
  const weekday = ((Number(input.weeklyWeekday) % 7) + 7) % 7;
  const start = parseIsoDate(input.startDate);
  const contractEnd = contractEndDate(input.startDate, months);
  const principals = splitEqual(principal, months);

  const monthly: Installment[] = [];
  for (let index = 0; index < months; index += 1) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + 1 + index, 1, 12, 0, 0);
    const due = dueOnDay(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
    monthly.push({
      id: uid('parc'),
      number: 0,
      dueDate: toIsoDate(due),
      principal: principals[index],
      interest: 0,
      amount: principals[index],
      paidAmount: 0,
      status: 'Pendente',
      kind: 'monthly',
    });
  }

  const weekly: Installment[] = [];
  let cursor = nextWeekdayAfter(start, weekday);
  while (toIsoDate(cursor) <= contractEnd) {
    weekly.push({
      id: uid('parc'),
      number: 0,
      dueDate: toIsoDate(cursor),
      principal: 0,
      interest: weeklyAmount,
      amount: weeklyAmount,
      paidAmount: 0,
      status: 'Pendente',
      kind: 'weekly',
    });
    cursor = addDays(cursor, 7);
  }

  return [...monthly, ...weekly]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.kind === 'monthly' ? -1 : 1))
    .map((item, index) => ({ ...item, number: index + 1 }));
}

export function displayEndDate(startDate: string, termMonths: number, installments: Installment[]) {
  const contract = contractEndDate(startDate, termMonths);
  return installments.reduce((max, item) => item.dueDate > max ? item.dueDate : max, contract);
}

export function dualScheduleSummary(loan: Pick<Loan, 'principal' | 'startDate' | 'termMonths' | 'monthlyDueDay' | 'weeklyAmount' | 'weeklyWeekday' | 'endDate' | 'installments'>) {
  const monthly = loan.installments.filter(item => item.kind === 'monthly');
  const weekly = loan.installments.filter(item => item.kind === 'weekly');
  const live = loan.installments.map(item => ({ ...item, status: liveStatus(item) }));
  const paid = live.filter(item => item.status === 'Pago');
  const pending = live.filter(item => item.status !== 'Pago');
  const late = live.filter(item => item.status === 'Atrasado');
  const next = pending.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number)[0];
  const monthlyTotal = roundCents(monthly.reduce((sum, item) => sum + item.amount, 0));
  const weeklyTotal = roundCents(weekly.reduce((sum, item) => sum + item.amount, 0));
  const paidTotal = roundCents(paid.reduce((sum, item) => sum + item.paidAmount, 0));
  const pendingTotal = roundCents(pending.reduce((sum, item) => sum + item.amount, 0));
  return {
    monthlyCount: monthly.length,
    weeklyCount: weekly.length,
    monthlyAmount: monthly[0]?.amount || 0,
    monthlyTotal,
    weeklyTotal,
    grandTotal: roundCents(monthlyTotal + weeklyTotal),
    paidTotal,
    pendingTotal,
    lateCount: late.length,
    lateTotal: roundCents(late.reduce((sum, item) => sum + item.amount, 0)),
    nextDue: next,
    startDate: loan.startDate || loan.installments[0]?.dueDate || '',
    endDate: loan.endDate || displayEndDate(loan.startDate || '', loan.termMonths || monthly.length || 1, loan.installments),
  };
}

export function groupInstallmentsByDate(installments: Installment[]) {
  const dates = [...new Set(installments.map(item => item.dueDate))].sort();
  return dates.map(date => {
    const rows = installments.filter(item => item.dueDate === date);
    return {
      date,
      rows,
      total: roundCents(rows.reduce((sum, item) => sum + item.amount, 0)),
    };
  });
}

export function installmentMonthKey(value: string) {
  return value.slice(0, 7);
}

export function monthLabel(value: string) {
  const date = new Date(`${value}-01T12:00:00`);
  const label = new Intl.DateTimeFormat('pt-BR', { month:'long', year:'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function paymentMethodLabel(method?: PaymentMethod) {
  if (method === 'cash') return 'Dinheiro';
  if (method === 'transfer') return 'Transferência';
  if (method === 'pix') return 'PIX';
  return 'Não informado';
}

export function applyInstallmentPayment(loan: Loan, installmentId: string, payment: PaymentRecord): Loan {
  const installments = loan.installments.map(item => item.id === installmentId ? {
    ...item,
    status: 'Pago' as const,
    paidAmount: payment.paidAmount,
    paidAt: payment.paidAt,
    paymentMethod: payment.paymentMethod,
    receiptName: payment.receiptName || item.receiptName,
  } : item);
  const allPaid = installments.every(item => item.status === 'Pago');
  return {
    ...loan,
    installments,
    status: loan.status === 'Ativo' && allPaid ? 'Quitado' : loan.status,
  };
}

export function payableAmount(loan: Loan, installment: Installment) {
  const lateDays = daysLate(installment.dueDate);
  if (!lateDays || installment.status === 'Pago') return installment.amount;
  if (loan.penaltyMode) {
    const value = Math.max(0, loan.penaltyValue || 0);
    if (loan.penaltyMode === 'none') return installment.amount;
    if (loan.penaltyMode === 'fixed_daily') return roundCents(installment.amount + value * lateDays);
    if (loan.penaltyMode === 'percent_daily') return roundCents(installment.amount + installment.amount * (value / 100) * lateDays);
    if (loan.penaltyMode === 'fixed_once') return roundCents(installment.amount + value);
    return roundCents(installment.amount + installment.amount * (value / 100));
  }
  const fee = loan.feeType === 'fixed' ? loan.feeValue : installment.amount * (loan.feeValue / 100);
  const mora = installment.amount * (loan.lateInterest / 100) * lateDays;
  return installment.amount + fee + mora;
}

export function loanBalance(loan: Loan) {
  return loan.installments.filter(item => item.status !== 'Pago').reduce((sum, item) => sum + payableAmount(loan, item), 0);
}

export function riskFor(client: Client, loans: Loan[], requested = 0): { score: number; level: RiskLevel; reasons: string[] } {
  let score = 78;
  const reasons: string[] = [];
  const clientLoans = loans.filter(loan => loan.clientId === client.id);
  const all = clientLoans.flatMap(loan => loan.installments);
  const paid = all.filter(item => item.status === 'Pago').length;
  const late = all.filter(item => item.status === 'Atrasado').length;
  const active = clientLoans.filter(loan => loan.status === 'Ativo').length;
  if (paid >= 3) { score += 10; reasons.push('Bom histórico de pagamentos'); }
  if (late) { score -= Math.min(24, late * 8); reasons.push(`${late} parcela(s) em atraso`); }
  if (active > 1) { score -= 12; reasons.push('Mais de um empréstimo ativo'); }
  if (client.references.filter(ref => ref.validated).length >= 2) { score += 7; reasons.push('Referências validadas'); }
  else { score -= 8; reasons.push('Referências ainda não validadas'); }
  if (requested && client.income) {
    const ratio = requested / client.income;
    if (ratio > 3) { score -= 18; reasons.push('Valor solicitado alto para a renda'); }
    else if (ratio <= 1.5) { score += 5; reasons.push('Valor compatível com a renda'); }
  }
  score = Math.max(0, Math.min(100, score));
  return { score, level: score >= 72 ? 'Baixo risco' : score >= 48 ? 'Médio risco' : 'Alto risco', reasons };
}

export function isClientActive(client: Pick<Client, 'active'>) {
  return client.active !== false;
}

function clientSeed(partial: Omit<Client, 'address' | 'locationConsent' | 'accessPin' | 'active'> & Partial<Pick<Client, 'location' | 'locationConsent' | 'accessPin' | 'active'>>): Client {
  const address = formatAddress(partial);
  return {
    locationConsent: Boolean(partial.location),
    accessPin: digitsOnly(partial.phone).slice(-4) || '2026',
    active: true,
    ...partial,
    address,
  };
}

export const seedClients: Client[] = [
  clientSeed({ id:'cli-mariana', name:'Mariana Alves', cpf:'124.658.930-18', rg:'32.456.890-2', phone:'(11) 99842-3170', zip:'01310-100', street:'Rua das Flores', number:'142', complement:'Apto 12', neighborhood:'Centro', city:'São Paulo', state:'SP', income:4200, location:{ lat:-23.5614, lng:-46.6558, capturedAt:dateAt(-180) }, references:[{name:'Paulo Alves',phone:'(11) 99120-8812',relation:'Irmão',hasWhatsapp:true,validated:true},{name:'Carla Mendes',phone:'(11) 98811-2010',relation:'Amiga',hasWhatsapp:true,validated:true},{name:'Sônia Prado',phone:'(11) 3221-4400',relation:'Vizinha',hasWhatsapp:false,validated:true}], documents:['RG-frente.pdf','comprovante-renda.pdf'], createdAt:dateAt(-180) }),
  clientSeed({ id:'cli-rafael', name:'Rafael Santos', cpf:'284.110.750-06', rg:'41.928.113-8', phone:'(11) 98211-4309', zip:'03045-000', street:'Av. Brasil', number:'880', complement:'', neighborhood:'Jardim Novo', city:'São Paulo', state:'SP', income:3100, references:[{name:'Márcia Santos',phone:'(11) 98810-1220',relation:'Mãe',hasWhatsapp:true,validated:true},{name:'Diego Rocha',phone:'(11) 97710-1042',relation:'Colega',hasWhatsapp:true,validated:false},{name:'Oficina Central',phone:'(11) 3208-7711',relation:'Trabalho',hasWhatsapp:false,validated:false}], documents:['CNH.pdf'], createdAt:dateAt(-120) }),
  clientSeed({ id:'cli-joao', name:'João Lima', cpf:'533.806.120-91', rg:'26.760.119-1', phone:'(11) 97510-2988', zip:'04210-030', street:'Rua Ipê', number:'51', complement:'Casa', neighborhood:'Vila Nova', city:'São Paulo', state:'SP', income:2600, references:[{name:'Ana Lima',phone:'(11) 98112-9181',relation:'Esposa',hasWhatsapp:true,validated:true},{name:'Luiz Freitas',phone:'(11) 98021-3093',relation:'Primo',hasWhatsapp:true,validated:true},{name:'Mercado Lima',phone:'(11) 2274-9090',relation:'Comércio',hasWhatsapp:false,validated:true}], documents:['RG.pdf'], createdAt:dateAt(-90) }),
  clientSeed({ id:'cli-bianca', name:'Bianca Souza', cpf:'736.102.980-40', rg:'38.441.872-6', phone:'(11) 99942-6110', zip:'01311-000', street:'Alameda Santos', number:'71', complement:'Cj. 84', neighborhood:'Bela Vista', city:'São Paulo', state:'SP', income:5800, location:{ lat:-23.5701, lng:-46.6453, capturedAt:dateAt(-55) }, references:[{name:'Roberta Souza',phone:'(11) 99101-8183',relation:'Irmã',hasWhatsapp:true,validated:true},{name:'Felipe Nunes',phone:'(11) 98617-3002',relation:'Amigo',hasWhatsapp:true,validated:true},{name:'Studio Belle',phone:'(11) 3251-8088',relation:'Trabalho',hasWhatsapp:false,validated:true}], documents:['documento.pdf','holerite.pdf'], createdAt:dateAt(-55) }),
];

export const seedAccounts: AccessAccount[] = [
  { id:'acc-admin', name:'Lucas Silva', email:'admin@lucasempred.com.br', password:'Lucas2026', role:'admin', active:true },
  { id:'acc-staff', name:'Camila Rocha', email:'camila@lucasempred.com.br', password:'Equipe2026', role:'staff', active:true },
  ...seedClients.map(client => ({
    id:`acc-${client.id}`,
    name: client.name,
    email: digitsOnly(client.cpf),
    password: client.accessPin,
    role: 'client' as Role,
    clientId: client.id,
    active: true,
  })),
];

function seededLoan(id: string, clientId: string, principal: number, rate: number, weeks: number, firstDue: string, paidCount: number, lateIndex = -1): Loan {
  const base: Loan = { id, clientId, contractNumber:`LE-2026-${id.slice(-3).toUpperCase()}`, principal, rate, interestMode:'total', weeks, firstDueDate:firstDue, frequency:'weekly', feeType:'percent', feeValue:2, lateInterest:.033, status:'Ativo', installments:[], createdAt:dateAt(-70) };
  base.installments = generateInstallments(base).map((item, index) => index < paidCount ? {...item,status:'Pago',paidAmount:item.amount,paidAt:dateAt(-14 + index * 7)} : index === lateIndex ? {...item,status:'Atrasado'} : item);
  return base;
}

export const seedLoans: Loan[] = [
  seededLoan('emp-101','cli-mariana',5000,18,16,dateAt(-49),7),
  seededLoan('emp-102','cli-rafael',3500,20,14,dateAt(-70),8,8),
  seededLoan('emp-103','cli-joao',2800,20,12,dateAt(-42),5,5),
  seededLoan('emp-104','cli-bianca',7000,16,20,dateAt(-28),4),
];

export const seedTeam: TeamMember[] = [
  { id:'team-1', name:'Camila Rocha', email:'camila@lucasempred.com.br', active:true, permissions:['Cadastrar clientes','Registrar pagamentos'] },
  { id:'team-2', name:'Daniel Costa', email:'daniel@lucasempred.com.br', active:true, permissions:['Cadastrar clientes','Criar empréstimos','Registrar pagamentos'] },
];

export const defaultSettings: AppSettings = { companyName:'Lucas EMPRED', document:'48.271.930/0001-40', phone:'(11) 99999-2026', pixKey:'financeiro@lucasempred.com.br', defaultRate:20, defaultWeeks:12, defaultFrequency:'weekly', feeType:'percent', feeValue:2, lateInterest:.033, reminderDays:2 };

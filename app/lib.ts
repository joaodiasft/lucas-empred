export type Role = 'admin' | 'staff' | 'client';
export type Page = 'home' | 'clients' | 'new-client' | 'client-detail' | 'loans' | 'new-loan' | 'loan-detail' | 'payments' | 'dashboard' | 'team' | 'settings' | 'client-home';
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
}
export interface Loan {
  id: string; clientId: string; contractNumber: string; principal: number; rate: number;
  interestMode: 'total' | 'balance'; weeks: number; firstDueDate: string;
  feeType: 'fixed' | 'percent'; feeValue: number; lateInterest: number; status: 'Ativo' | 'Quitado' | 'Renegociado';
  installments: Installment[]; createdAt: string; originalLoanId?: string;
}
export interface TeamMember { id: string; name: string; email: string; active: boolean; permissions: string[] }
export interface AppSettings { companyName: string; document: string; phone: string; pixKey: string; defaultRate: number; defaultWeeks: number; feeType: 'fixed' | 'percent'; feeValue: number; lateInterest: number; reminderDays: number }

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

export function generateInstallments(input: Pick<Loan, 'principal' | 'rate' | 'interestMode' | 'weeks' | 'firstDueDate'>): Installment[] {
  const weeks = Math.max(1, Number(input.weeks));
  const principalPart = input.principal / weeks;
  let balance = input.principal;
  const totalInterest = input.principal * (input.rate / 100);
  return Array.from({ length: weeks }, (_, index) => {
    const due = new Date(`${input.firstDueDate}T12:00:00`);
    due.setDate(due.getDate() + index * 7);
    const interest = input.interestMode === 'total' ? totalInterest / weeks : balance * (input.rate / 100) / weeks;
    const principal = index === weeks - 1 ? balance : principalPart;
    balance -= principal;
    return {
      id: uid('parc'), number: index + 1, dueDate: due.toISOString().slice(0, 10), principal,
      interest, amount: principal + interest, paidAmount: 0, status: 'Pendente' as InstallmentStatus,
    };
  });
}

export function payableAmount(loan: Loan, installment: Installment) {
  const lateDays = daysLate(installment.dueDate);
  if (!lateDays || installment.status === 'Pago') return installment.amount;
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

function clientSeed(partial: Omit<Client, 'address' | 'locationConsent' | 'accessPin'> & Partial<Pick<Client, 'location' | 'locationConsent' | 'accessPin'>>): Client {
  const address = formatAddress(partial);
  return {
    locationConsent: Boolean(partial.location),
    accessPin: digitsOnly(partial.phone).slice(-4) || '2026',
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
  const base: Loan = { id, clientId, contractNumber:`LE-2026-${id.slice(-3).toUpperCase()}`, principal, rate, interestMode:'total', weeks, firstDueDate:firstDue, feeType:'percent', feeValue:2, lateInterest:.033, status:'Ativo', installments:[], createdAt:dateAt(-70) };
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

export const defaultSettings: AppSettings = { companyName:'Lucas EMPRED', document:'48.271.930/0001-40', phone:'(11) 99999-2026', pixKey:'financeiro@lucasempred.com.br', defaultRate:20, defaultWeeks:12, feeType:'percent', feeValue:2, lateInterest:.033, reminderDays:2 };

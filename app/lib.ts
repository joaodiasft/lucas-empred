export type Role = 'admin' | 'staff' | 'client';
export type Page = 'home' | 'clients' | 'new-client' | 'client-detail' | 'loans' | 'new-loan' | 'loan-detail' | 'payments' | 'dashboard' | 'team' | 'settings' | 'client-home';
export type RiskLevel = 'Baixo risco' | 'Médio risco' | 'Alto risco';
export type InstallmentStatus = 'Pendente' | 'Aguardando' | 'Pago' | 'Atrasado';

export interface Reference { name: string; phone: string; validated: boolean }
export interface Client {
  id: string; name: string; cpf: string; rg: string; phone: string; address: string;
  income: number; references: Reference[]; documents: string[]; signature?: string; createdAt: string;
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

export const seedClients: Client[] = [
  { id:'cli-mariana', name:'Mariana Alves', cpf:'124.658.930-18', rg:'32.456.890-2', phone:'(11) 99842-3170', address:'Rua das Flores, 142 — Centro', income:4200, references:[{name:'Paulo Alves',phone:'(11) 99120-8812',validated:true},{name:'Carla Mendes',phone:'(11) 98811-2010',validated:true}], documents:['RG-frente.pdf','comprovante-renda.pdf'], createdAt:dateAt(-180) },
  { id:'cli-rafael', name:'Rafael Santos', cpf:'284.110.750-06', rg:'41.928.113-8', phone:'(11) 98211-4309', address:'Av. Brasil, 880 — Jardim Novo', income:3100, references:[{name:'Márcia Santos',phone:'(11) 98810-1220',validated:true},{name:'Diego Rocha',phone:'(11) 97710-1042',validated:false}], documents:['CNH.pdf'], createdAt:dateAt(-120) },
  { id:'cli-joao', name:'João Lima', cpf:'533.806.120-91', rg:'26.760.119-1', phone:'(11) 97510-2988', address:'Rua Ipê, 51 — Vila Nova', income:2600, references:[{name:'Ana Lima',phone:'(11) 98112-9181',validated:true},{name:'Luiz Freitas',phone:'(11) 98021-3093',validated:true}], documents:['RG.pdf'], createdAt:dateAt(-90) },
  { id:'cli-bianca', name:'Bianca Souza', cpf:'736.102.980-40', rg:'38.441.872-6', phone:'(11) 99942-6110', address:'Al. Santos, 71 — Bela Vista', income:5800, references:[{name:'Roberta Souza',phone:'(11) 99101-8183',validated:true},{name:'Felipe Nunes',phone:'(11) 98617-3002',validated:true}], documents:['documento.pdf','holerite.pdf'], createdAt:dateAt(-55) },
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

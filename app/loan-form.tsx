'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, RiskBadge } from './components';
import { PaymentScheduleTable } from './loan-schedule';
import {
  AppSettings, Client, DEFAULT_WEEKLY_WEEKDAY, Loan, PenaltyMode, currency, dualScheduleSummary, formatRate,
  generateOpenWeeklyInstallments, rateFromInterest, riskFor, roundCents, toIsoDate, uid,
} from './lib';

const penalties: { id: PenaltyMode; title: string; text: string }[] = [
  { id: 'none', title: 'Sem multa', text: 'A parcela atrasada fica no valor combinado.' },
  { id: 'fixed_daily', title: 'Valor por dia', text: 'Soma um valor em reais a cada dia de atraso.' },
  { id: 'percent_daily', title: 'Percentual por dia', text: 'Aplica um % da parcela a cada dia de atraso.' },
  { id: 'fixed_once', title: 'Valor único', text: 'Cobra uma vez, mesmo que o atraso aumente.' },
];

function todayIso() {
  return toIsoDate(new Date());
}

export function NewLoanView({
  clients, loans, settings, prefilledClient, onSave, onCancel,
}: {
  clients: Client[];
  loans: Loan[];
  settings: AppSettings;
  prefilledClient?: string;
  onSave: (loan: Loan) => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(prefilledClient || clients[0]?.id || '');
  const [principal, setPrincipal] = useState(1000);
  const [startDate, setStartDate] = useState(todayIso);
  const [weeklyAmount, setWeeklyAmount] = useState(80);
  const weeklyWeekday = DEFAULT_WEEKLY_WEEKDAY;
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>('fixed_daily');
  const [penaltyValue, setPenaltyValue] = useState(settings.feeType === 'fixed' ? Math.max(1, settings.feeValue) : 5);

  const preview = useMemo(
    () => generateOpenWeeklyInstallments({ weeklyAmount, weeklyWeekday, startDate }),
    [weeklyAmount, weeklyWeekday, startDate],
  );
  const summary = dualScheduleSummary({
    principal, startDate, weeklyAmount, weeklyWeekday, installments: preview, planMode: 'open_weekly',
  });
  const rate = rateFromInterest(principal, weeklyAmount);
  const client = clients.find(item => item.id === clientId);
  const risk = client ? riskFor(client, loans, principal) : null;
  const sampleLate = weeklyAmount && penaltyMode !== 'none'
    ? penaltyMode === 'percent_daily'
      ? roundCents(weeklyAmount + weeklyAmount * (penaltyValue / 100) * 5)
      : penaltyMode === 'fixed_once'
        ? roundCents(weeklyAmount + penaltyValue)
        : roundCents(weeklyAmount + penaltyValue * 5)
    : weeklyAmount;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!clientId || !preview.length) return;
    const id = uid('emp');
    onSave({
      id,
      clientId,
      contractNumber: `LE-${new Date().getFullYear()}-${id.slice(-4).toUpperCase()}`,
      principal,
      rate,
      interestMode: 'total',
      weeks: summary.weeklyCount,
      firstDueDate: preview[0]?.dueDate || startDate,
      frequency: 'weekly',
      loanType: 'personal',
      category: 'cash',
      planMode: 'open_weekly',
      weeklyInterest: weeklyAmount,
      weeklyAmount,
      weeklyWeekday,
      paymentWeekdays: [weeklyWeekday],
      startDate,
      penaltyMode,
      penaltyValue: penaltyMode === 'none' ? 0 : penaltyValue,
      feeType: penaltyMode.includes('percent') ? 'percent' : 'fixed',
      feeValue: penaltyMode === 'none' ? 0 : penaltyValue,
      lateInterest: penaltyMode === 'percent_daily' ? penaltyValue : 0,
      status: 'Ativo',
      installments: preview,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <>
      <PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Empréstimo semanal, com vencimento toda terça-feira. Sem prazo fixo: a pessoa vai pagando enquanto o contrato estiver ativo." />
      <form className="form-card loan-form" onSubmit={submit}>
        <SectionTitle number="1" title="Cliente, valor e pagamento semanal" text="O vencimento é toda terça-feira. Não tem prazo em meses nem em semanas. Novas terças entram sozinhas enquanto o empréstimo estiver ativo." />

        <div className="form-grid">
          <FieldBlock className="span-2" title="Cliente" hint="Quem recebe o empréstimo.">
            <select value={clientId} onChange={event => setClientId(event.target.value)} required>
              {clients.map(item => <option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock title="Valor emprestado" hint="O que você entrega ao cliente.">
            <MoneyInput value={principal} onChange={value => setPrincipal(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock title="Data de início" hint="A primeira cobrança é na próxima terça depois desta data.">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
          </FieldBlock>
          <FieldBlock title="Pagamento semanal" hint="Valor fixo de toda terça-feira.">
            <MoneyInput value={weeklyAmount} onChange={value => setWeeklyAmount(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock className="span-2" title="Dia da semana do semanal" hint="Vencimento já definido: toda terça-feira.">
            <div className="weekday-picker only-tuesday">
              <button type="button" className="active" aria-pressed="true">Ter</button>
            </div>
          </FieldBlock>
        </div>

        {risk && (
          <div className={`risk-preview ${risk.level === 'Baixo risco' ? 'low' : risk.level === 'Médio risco' ? 'medium' : 'high'}`}>
            <RiskBadge level={risk.level} score={risk.score} />
            <div>
              <b>Análise para {client?.name}</b>
              <p>{risk.reasons.join(' • ')}</p>
            </div>
          </div>
        )}

        <div className="loan-live-summary dual">
          <span><small>Valor emprestado</small><b>{currency(principal)}</b><em>Registrado no contrato</em></span>
          <span><small>Início</small><b>{startDate.split('-').reverse().join('/')}</b><em>Informado</em></span>
          <span><small>Encerramento</small><b>Em aberto</b><em>Conforme os pagamentos</em></span>
          <span><small>Pagamento semanal</small><b>{currency(weeklyAmount)}</b><em>Toda terça-feira</em></span>
          <span><small>Próximas terças</small><b>{summary.weeklyCount}</b><em>O calendário segue sozinho</em></span>
          <span><small>Já previsto nesta tela</small><b>{currency(summary.weeklyTotal)}</b><em>{formatRate(rate)}% da primeira semana</em></span>
          <span><small>Próximo vencimento</small><b>{summary.nextDue ? summary.nextDue.dueDate.split('-').reverse().join('/') : '—'}</b><em>{currency(weeklyAmount)}</em></span>
          <span className="highlight"><small>Como funciona</small><b>Sem prazo</b><em>Continua enquanto estiver ativo</em></span>
        </div>

        <SectionTitle number="2" title="Juros por atraso" text="Só entra se a parcela da semana vencer sem pagamento." />
        <div className="penalty-options compact">
          {penalties.map(option => (
            <button type="button" key={option.id} className={penaltyMode === option.id ? 'active' : ''} onClick={() => setPenaltyMode(option.id)}>
              <span>{penaltyMode === option.id ? '✓' : ''}</span>
              <b>{option.title}</b>
              <small>{option.text}</small>
            </button>
          ))}
        </div>
        {penaltyMode !== 'none' && (
          <div className="penalty-config">
            <FieldBlock
              title={penaltyMode.includes('percent') ? 'Multa por dia (%)' : penaltyMode === 'fixed_once' ? 'Multa única (R$)' : 'Multa por dia (R$)'}
              hint={penaltyMode.includes('daily') ? 'Conta cada dia completo de atraso.' : 'Cobra uma vez na parcela atrasada.'}
            >
              {penaltyMode.includes('percent')
                ? <input type="number" min="0" step="0.01" value={penaltyValue} onChange={event => setPenaltyValue(Number(event.target.value))} />
                : <MoneyInput value={penaltyValue} onChange={setPenaltyValue} />}
            </FieldBlock>
            <div className="penalty-example">
              <small>Exemplo com 5 dias de atraso</small>
              <b>{currency(sampleLate)}</b>
              <p>Uma semana de {currency(weeklyAmount)} passa para este valor.</p>
            </div>
          </div>
        )}

        <SectionTitle number="3" title="Próximos vencimentos" text="A tabela mostra as próximas terças. Enquanto o empréstimo estiver ativo, novas terças entram sozinhas." />
        <PaymentScheduleTable installments={preview} />

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button className="primary-button" disabled={!clientId || !preview.length}>Aprovar e criar contrato</button>
        </div>
      </form>
    </>
  );
}

function SectionTitle({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="form-section-title">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

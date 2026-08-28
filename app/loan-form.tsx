'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, RiskBadge } from './components';
import { PaymentScheduleTable } from './loan-schedule';
import {
  AppSettings, Client, Loan, PenaltyMode, WEEKDAY_OPTIONS, contractEndDate, currency, displayEndDate,
  dualScheduleSummary, formatRate, generateDualSchedule, rateFromInterest, riskFor, roundCents, toIsoDate, uid, weekdayLabel,
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
  const [termMonths, setTermMonths] = useState(10);
  const [startDate, setStartDate] = useState(todayIso);
  const [monthlyDueDay, setMonthlyDueDay] = useState(10);
  const [weeklyAmount, setWeeklyAmount] = useState(80);
  const [weeklyWeekday, setWeeklyWeekday] = useState(1);
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>('fixed_daily');
  const [penaltyValue, setPenaltyValue] = useState(settings.feeType === 'fixed' ? Math.max(1, settings.feeValue) : 5);

  const preview = useMemo(
    () => generateDualSchedule({ principal, startDate, termMonths, monthlyDueDay, weeklyAmount, weeklyWeekday }),
    [principal, startDate, termMonths, monthlyDueDay, weeklyAmount, weeklyWeekday],
  );
  const summary = dualScheduleSummary({
    principal, startDate, termMonths, monthlyDueDay, weeklyAmount, weeklyWeekday,
    endDate: displayEndDate(startDate, termMonths, preview),
    installments: preview,
  });
  const contractEnd = contractEndDate(startDate, termMonths);
  const rate = rateFromInterest(principal, summary.weeklyTotal);
  const client = clients.find(item => item.id === clientId);
  const risk = client ? riskFor(client, loans, principal) : null;
  const sampleBase = summary.monthlyAmount || weeklyAmount;
  const sampleLate = sampleBase && penaltyMode !== 'none'
    ? penaltyMode === 'percent_daily'
      ? roundCents(sampleBase + sampleBase * (penaltyValue / 100) * 5)
      : penaltyMode === 'fixed_once'
        ? roundCents(sampleBase + penaltyValue)
        : roundCents(sampleBase + penaltyValue * 5)
    : sampleBase;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!clientId || !preview.length) return;
    const id = uid('emp');
    const endDate = displayEndDate(startDate, termMonths, preview);
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
      planMode: 'dual_stream',
      termMonths,
      weeklyInterest: weeklyAmount,
      weeklyAmount,
      weeklyWeekday,
      paymentWeekdays: [weeklyWeekday],
      startDate,
      endDate,
      monthlyDueDay,
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
      <PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Informe o valor, os meses, o dia da parcela mensal e o pagamento semanal. O calendário monta as duas listas." />
      <form className="form-card loan-form" onSubmit={submit}>
        <SectionTitle number="1" title="Cliente, valor e prazos" text="A parcela mensal divide o valor emprestado. O semanal é fixo e corre o calendário real até o encerramento." />

        <div className="form-grid">
          <FieldBlock className="span-2" title="Cliente" hint="Quem recebe o empréstimo.">
            <select value={clientId} onChange={event => setClientId(event.target.value)} required>
              {clients.map(item => <option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock title="Valor emprestado" hint="Dividido igualmente pelos meses.">
            <MoneyInput value={principal} onChange={value => setPrincipal(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock title="Prazo em meses" hint={`${termMonths} ${termMonths === 1 ? 'mês' : 'meses'} de parcela mensal.`}>
            <input type="number" min="1" max="60" value={termMonths} onChange={event => setTermMonths(Math.max(1, Number(event.target.value) || 1))} />
          </FieldBlock>
          <FieldBlock title="Data de início" hint="Você informa. O encerramento é esta data mais o prazo.">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
          </FieldBlock>
          <FieldBlock title="Dia do vencimento mensal" hint="A primeira parcela cai neste dia do mês seguinte.">
            <input type="number" min="1" max="31" value={monthlyDueDay} onChange={event => setMonthlyDueDay(Math.max(1, Math.min(31, Number(event.target.value) || 1)))} />
          </FieldBlock>
          <FieldBlock title="Pagamento semanal" hint="Valor fixo em todo o período ativo.">
            <MoneyInput value={weeklyAmount} onChange={value => setWeeklyAmount(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock className="span-2" title="Dia da semana do semanal" hint="A primeira cobrança é na próxima ocorrência depois do início.">
            <div className="weekday-picker">
              {WEEKDAY_OPTIONS.map(day => (
                <button type="button" key={day.id} className={weeklyWeekday === day.id ? 'active' : ''} onClick={() => setWeeklyWeekday(day.id)}>
                  {day.short}
                </button>
              ))}
            </div>
          </FieldBlock>
        </div>

        <div className="monthly-formula">
          <span><small>Emprestado</small><b>{currency(principal)}</b></span>
          <i>÷</i>
          <span><small>Meses</small><b>{termMonths}</b></span>
          <i>=</i>
          <span className="highlight"><small>Parcela mensal</small><b>{currency(summary.monthlyAmount)}</b></span>
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
          <span><small>Início</small><b>{startDate.split('-').reverse().join('/')}</b><em>Informado</em></span>
          <span><small>Encerramento</small><b>{summary.endDate.split('-').reverse().join('/')}</b><em>Contrato {contractEnd.split('-').reverse().join('/')}</em></span>
          <span><small>Parcela mensal</small><b>{currency(summary.monthlyAmount)}</b><em>Todo dia {monthlyDueDay}</em></span>
          <span><small>Pagamento semanal</small><b>{currency(weeklyAmount)}</b><em>{weekdayLabel(weeklyWeekday)}</em></span>
          <span><small>Semanais no período</small><b>{summary.weeklyCount}</b><em>Pelas datas reais</em></span>
          <span><small>Total das mensais</small><b>{currency(summary.monthlyTotal)}</b><em>Valor emprestado</em></span>
          <span><small>Total dos semanais</small><b>{currency(summary.weeklyTotal)}</b><em>{formatRate(rate)}% sobre o emprestado</em></span>
          <span className="highlight"><small>Total geral previsto</small><b>{currency(summary.grandTotal)}</b><em>Sem atraso</em></span>
        </div>

        <SectionTitle number="2" title="Juros por atraso" text="Só entra se a parcela vencer sem pagamento. Vale para mensal e semanal." />
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
              <p>Uma parcela de {currency(sampleBase)} passa para este valor.</p>
            </div>
          </div>
        )}

        <SectionTitle number="3" title="Tabela cronológica" text="Mensal e semanal aparecem separados. No mesmo dia, o sistema mostra o total devido." />
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

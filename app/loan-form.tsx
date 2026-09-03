'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, RiskBadge } from './components';
import {
  AppSettings, Client, DEFAULT_WEEKLY_WEEKDAY, Loan, PenaltyMode, currency, dailyFromWeekly, dualScheduleSummary,
  formatRate, generateOpenWeeklyInstallments, interestBreakdown, rateFromInterest, riskFor, roundCents, toIsoDate, uid,
  weeklyFromDaily,
} from './lib';

const penalties: { id: PenaltyMode; title: string; text: string }[] = [
  { id: 'none', title: 'Sem multa', text: 'A parcela atrasada fica no valor combinado.' },
  { id: 'fixed_daily', title: 'Valor por dia', text: 'Soma um valor em reais a cada dia de atraso.' },
  { id: 'percent_daily', title: 'Percentual por dia', text: 'Aplica um % da parcela a cada dia de atraso.' },
  { id: 'fixed_once', title: 'Valor único', text: 'Cobra uma vez, mesmo que o atraso aumente.' },
];

const DAY_PRESETS = [1, 7, 15, 30];

function todayIso() {
  return toIsoDate(new Date());
}

export function InterestCalcPanel({
  principal,
  dailyAmount,
  days,
  startDate,
  onDailyChange,
  onDaysChange,
}: {
  principal: number;
  dailyAmount: number;
  days: number;
  startDate?: string;
  onDailyChange?: (value: number) => void;
  onDaysChange?: (value: number) => void;
}) {
  const calc = interestBreakdown({ principal, dailyAmount, days, startDate });
  const dayLabel = calc.days === 1 ? '1 dia' : `${calc.days} dias`;
  return (
    <div className="interest-calc">
      <div className="interest-calc-head">
        <div>
          <p className="eyebrow">CONTA DOS JUROS</p>
          <h3>1 dia e por dias, para você conferir</h3>
        </div>
        <span>{formatRate(calc.dailyRate)}% ao dia sobre o valor emprestado</span>
      </div>
      <div className="form-grid">
        <FieldBlock title="Juros de 1 dia" hint="Quanto rende um dia. A terça é este valor × 7.">
          {onDailyChange
            ? <MoneyInput value={dailyAmount} onChange={value => onDailyChange(Math.max(0, value))} required />
            : <div className="readonly-money">{currency(calc.daily)}</div>}
        </FieldBlock>
        <FieldBlock title="Por quantos dias" hint="Mude os dias para ver o total na hora.">
          <input type="number" min="0" step="1" value={days} onChange={event => onDaysChange?.(Math.max(0, Number(event.target.value) || 0))} />
        </FieldBlock>
      </div>
      <div className="interest-day-chips">
        {DAY_PRESETS.map(preset => (
          <button type="button" key={preset} className={days === preset ? 'active' : ''} onClick={() => onDaysChange?.(preset)}>
            {preset === 1 ? '1 dia' : `${preset} dias`}
          </button>
        ))}
      </div>
      <div className="interest-calc-formula">
        <span><small>Juros de 1 dia</small><b>{currency(calc.daily)}</b></span>
        <i>×</i>
        <span><small>Quantos dias</small><b>{dayLabel}</b></span>
        <i>=</i>
        <span className="highlight"><small>Total desses dias</small><b>{currency(calc.forDays)}</b></span>
      </div>
      <p className="interest-calc-math">
        {currency(calc.daily)} × {calc.days} {calc.days === 1 ? 'dia' : 'dias'} = <b>{currency(calc.forDays)}</b>
        {principal > 0 ? ` · ${formatRate(calc.daysRate)}% de ${currency(principal)}` : ''}
      </p>
      <div className="interest-facts">
        <span><small>Valor emprestado</small><b>{currency(principal)}</b><em>Só quita de uma vez</em></span>
        <span><small>1 dia</small><b>{currency(calc.daily)}</b><em>{formatRate(calc.dailyRate)}% ao dia</em></span>
        <span><small>7 dias · terça</small><b>{currency(calc.weekly)}</b><em>{formatRate(calc.weeklyRate)}% na semana</em></span>
        <span><small>{dayLabel}</small><b>{currency(calc.forDays)}</b><em>{currency(calc.daily)} × {calc.days}</em></span>
        <span><small>30 dias</small><b>{currency(calc.forMonth)}</b><em>{currency(calc.daily)} × 30</em></span>
        <span className="highlight"><small>Como cobra</small><b>{currency(calc.weekly)}</b><em>Toda terça = 7 dias de juros</em></span>
      </div>
      {startDate != null && (
        <div className="interest-elapsed">
          <span><small>Dias corridos desde o início</small><b>{calc.elapsed} {calc.elapsed === 1 ? 'dia' : 'dias'}</b></span>
          <span><small>Se contar esses dias</small><b>{currency(calc.accrued)}</b></span>
          <em>{currency(calc.daily)} × {calc.elapsed} = {currency(calc.accrued)}. A cobrança da terça continua sendo {currency(calc.weekly)}.</em>
        </div>
      )}
    </div>
  );
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
  const [dailyAmount, setDailyAmount] = useState(() => dailyFromWeekly(80));
  const [days, setDays] = useState(7);
  const weeklyWeekday = DEFAULT_WEEKLY_WEEKDAY;
  const weeklyAmount = weeklyFromDaily(dailyAmount);
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
  const sampleDays = 5;
  const sampleFine = penaltyMode === 'none'
    ? 0
    : penaltyMode === 'percent_daily'
      ? roundCents(weeklyAmount * (penaltyValue / 100) * sampleDays)
      : penaltyMode === 'fixed_once'
        ? roundCents(penaltyValue)
        : roundCents(penaltyValue * sampleDays);
  const sampleLate = roundCents(weeklyAmount + sampleFine);

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
      dailyAmount,
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
      <PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Informe o juros de 1 dia e veja o total por quantos dias quiser. A cobrança da terça é 7 dias. O principal só quita se for pago de uma vez." />
      <form className="form-card loan-form" onSubmit={submit}>
        <SectionTitle number="1" title="Cliente, valor e juros" text="Os juros de 1 dia não abatem o valor emprestado. Cada terça (7 dias) entra na somatória do cliente. O principal só quita de uma vez." />

        <div className="form-grid">
          <FieldBlock className="span-2" title="Cliente" hint="Quem recebe o empréstimo.">
            <select value={clientId} onChange={event => setClientId(event.target.value)} required>
              {clients.map(item => <option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock title="Valor emprestado" hint="Só quita se o cliente pagar esse valor de uma vez.">
            <MoneyInput value={principal} onChange={value => setPrincipal(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock title="Data de início" hint="A primeira cobrança é na próxima terça depois desta data.">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
          </FieldBlock>
          <FieldBlock className="span-2" title="Dia da semana do semanal" hint="Vencimento já definido: toda terça-feira.">
            <div className="weekday-picker only-tuesday">
              <button type="button" className="active" aria-pressed="true">Ter</button>
            </div>
          </FieldBlock>
        </div>

        <InterestCalcPanel
          principal={principal}
          dailyAmount={dailyAmount}
          days={days}
          startDate={startDate}
          onDailyChange={setDailyAmount}
          onDaysChange={setDays}
        />

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
          <span><small>Valor emprestado</small><b>{currency(principal)}</b><em>Só quita de uma vez</em></span>
          <span><small>Juros de 1 dia</small><b>{currency(dailyAmount)}</b><em>{formatRate(rateFromInterest(principal, dailyAmount))}% ao dia</em></span>
          <span><small>Por {days} {days === 1 ? 'dia' : 'dias'}</small><b>{currency(interestBreakdown({ principal, dailyAmount, days }).forDays)}</b><em>{currency(dailyAmount)} × {days}</em></span>
          <span><small>Terça · 7 dias</small><b>{currency(weeklyAmount)}</b><em>Cobrança semanal</em></span>
          <span><small>30 dias</small><b>{currency(interestBreakdown({ principal, dailyAmount, days: 30 }).forDays)}</b><em>{currency(dailyAmount)} × 30</em></span>
          <span className="highlight"><small>Como quita o principal</small><b>{currency(principal)}</b><em>De uma vez + juros das terças</em></span>
        </div>

        <SectionTitle number="2" title="Juros por atraso" text="A multa entra por cima da terça (7 dias de juros). Só cobra se a terça vencer sem pagamento." />
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
              <small>Exemplo com 5 dias de atraso na terça</small>
              <div className="penalty-stack">
                <span><em>7 dias de juros</em><b>{currency(weeklyAmount)}</b></span>
                <span><em>Multa por cima</em><b>+ {currency(sampleFine)}</b></span>
                <span className="total"><em>Total na terça atrasada</em><strong>{currency(sampleLate)}</strong></span>
              </div>
            </div>
          </div>
        )}

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

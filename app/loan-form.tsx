'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, RiskBadge } from './components';
import { ThreeMonthForecast } from './loan-schedule';
import {
  AppSettings, Client, DEFAULT_WEEKLY_WEEKDAY, Loan, PenaltyMode, currency, dailyFromWeekly, dualScheduleSummary,
  generateOpenWeeklyInstallments, rateFromInterest, riskFor, roundCents, threeMonthEndDate, toIsoDate, uid,
} from './lib';

const penalties: { id: PenaltyMode; title: string; text: string }[] = [
  { id: 'none', title: 'Sem atraso extra', text: 'Cobra só o juros da terça, mesmo atrasado.' },
  { id: 'fixed_daily', title: 'Valor por dia', text: 'Soma um valor em cima do juros semanal, cada dia de atraso.' },
  { id: 'percent_daily', title: '% por dia', text: 'Aplica um % em cima do juros semanal, cada dia de atraso.' },
  { id: 'fixed_once', title: 'Valor único', text: 'Soma uma vez em cima do juros semanal.' },
];

function todayIso() {
  return toIsoDate(new Date());
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
  const dailyAmount = dailyFromWeekly(weeklyAmount);
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>('fixed_daily');
  const [penaltyValue, setPenaltyValue] = useState(settings.feeType === 'fixed' ? Math.max(1, settings.feeValue) : 5);

  const preview = useMemo(
    () => generateOpenWeeklyInstallments({ weeklyAmount, weeklyWeekday, startDate, untilDate: threeMonthEndDate(startDate) }),
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
      <PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Informe o juros da terça. Esse valor é só juros e não abate o emprestado. O atraso entra por cima do juros." />
      <form className="form-card loan-form" onSubmit={submit}>
        <SectionTitle number="1" title="Cliente, valor e juros semanal" text="Os R$ da terça são só juros. O valor emprestado só quita se for pago de uma vez. Cada terça paga entra na somatória." />

        <div className="form-grid">
          <FieldBlock className="span-2" title="Cliente" hint="Quem recebe o empréstimo.">
            <select value={clientId} onChange={event => setClientId(event.target.value)} required>
              {clients.map(item => <option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock title="Valor emprestado" hint="Só quita se o cliente pagar esse valor de uma vez.">
            <MoneyInput value={principal} onChange={value => setPrincipal(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock title="Juros por semana" hint="Cobrado toda terça. Não abate o valor emprestado.">
            <MoneyInput value={weeklyAmount} onChange={value => setWeeklyAmount(Math.max(0, value))} required />
          </FieldBlock>
          <FieldBlock title="Data de início" hint="A primeira cobrança é na próxima terça depois desta data.">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
          </FieldBlock>
          <FieldBlock title="Vencimento" hint="Toda terça-feira.">
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
          <span><small>Valor emprestado</small><b>{currency(principal)}</b><em>Só quita de uma vez</em></span>
          <span><small>Juros por semana</small><b>{currency(weeklyAmount)}</b><em>Toda terça-feira</em></span>
          <span><small>Início</small><b>{startDate.split('-').reverse().join('/')}</b><em>Informado</em></span>
          <span className="highlight"><small>Como quita</small><b>{currency(principal)}</b><em>Principal de uma vez + juros das terças</em></span>
        </div>

        <SectionTitle number="2" title="Juros por atraso" text={`Entra por cima do juros semanal de ${currency(weeklyAmount)}. Não mexe no valor emprestado. Só cobra se a terça vencer sem pagamento.`} />
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
              title={penaltyMode.includes('percent') ? 'Atraso por dia (% do juros)' : penaltyMode === 'fixed_once' ? 'Atraso único em cima do juros (R$)' : 'Atraso por dia em cima do juros (R$)'}
              hint={penaltyMode.includes('percent') ? `Percentual sobre ${currency(weeklyAmount)}, não sobre o valor emprestado.` : 'Soma em cima do juros da terça.'}
            >
              {penaltyMode.includes('percent')
                ? <input type="number" min="0" step="0.01" value={penaltyValue} onChange={event => setPenaltyValue(Number(event.target.value))} />
                : <MoneyInput value={penaltyValue} onChange={setPenaltyValue} />}
            </FieldBlock>
            <div className="penalty-example">
              <small>Exemplo: terça de {currency(weeklyAmount)} com {sampleDays} dias de atraso</small>
              <div className="penalty-stack">
                <span><em>Juros da terça</em><b>{currency(weeklyAmount)}</b></span>
                <span><em>Atraso por cima</em><b>+ {currency(sampleFine)}</b></span>
                <span className="total"><em>Total a cobrar nessa terça</em><strong>{currency(sampleLate)}</strong></span>
              </div>
            </div>
          </div>
        )}

        <SectionTitle number="3" title="Como fica nos 3 meses" text="Cada terça é o juros semanal. O valor emprestado continua o mesmo até pagar de uma vez." />
        <ThreeMonthForecast
          principal={principal}
          dailyAmount={dailyAmount}
          weeklyAmount={weeklyAmount}
          weeklyWeekday={weeklyWeekday}
          startDate={startDate}
        />

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button className="primary-button" disabled={!clientId || !preview.length}>Aprovar e criar contrato</button>
        </div>
      </form>
    </>
  );
}

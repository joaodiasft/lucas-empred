'use client';

import {
  DEFAULT_WEEKLY_WEEKDAY, Installment, Loan, buildThreeMonthForecast, currency, groupInstallmentsByDate,
  installmentKindLabel, liveStatus, loanDailyAmount, payableAmount, parseIsoDate, roundCents, shortDate, weekdayLabel,
  weeklyFromDaily,
} from './lib';

export function ThreeMonthForecast({
  principal,
  dailyAmount,
  weeklyAmount,
  weeklyWeekday = DEFAULT_WEEKLY_WEEKDAY,
  startDate,
  installments,
  loan,
  onRegister,
  onConfirm,
}: {
  principal: number;
  dailyAmount: number;
  weeklyAmount: number;
  weeklyWeekday?: number;
  startDate: string;
  installments?: Installment[];
  loan?: Loan;
  onRegister?: (id: string) => void;
  onConfirm?: (id: string) => void;
}) {
  const forecast = buildThreeMonthForecast({
    principal, dailyAmount, weeklyAmount, weeklyWeekday, startDate, installments,
  });
  const hasActions = Boolean(onRegister || onConfirm);

  if (!forecast.tuesdayCount) {
    return <section className="monthly-schedule empty"><p>Informe o valor emprestado, a data de início e o juros por semana para montar os 3 meses.</p></section>;
  }

  return (
    <section className="monthly-schedule">
      <div className="schedule-heading">
        <div>
          <p className="eyebrow">PRÓXIMOS 3 MESES</p>
          <h3>Como fica mês a mês</h3>
        </div>
        <span>{forecast.tuesdayCount} terças · {currency(forecast.tuesdayTotal)}</span>
      </div>
      <div className="forecast-overview">
        <span><small>Valor emprestado</small><b>{currency(forecast.principal)}</b><em>Continua aberto nos 3 meses</em></span>
        <span><small>Juros por semana</small><b>{currency(forecast.weeklyAmount)}</b><em>Toda terça-feira</em></span>
        <span><small>Juros dos 3 meses</small><b>{currency(forecast.tuesdayTotal)}</b><em>{forecast.tuesdayCount} terças</em></span>
        <span className="highlight"><small>No fim dos 3 meses</small><b>{currency(forecast.principal)}</b><em>Principal ainda em aberto + somatória {currency(forecast.tuesdayTotal)}</em></span>
      </div>
      <div className="month-stack">
        {forecast.months.map((month, index) => (
          <article className="month-card forecast" key={month.key}>
            <header>
              <div>
                <small>MÊS {index + 1} DE 3</small>
                <h4>{month.label}</h4>
                <p>{shortDate(month.from)} até {shortDate(month.to)}</p>
              </div>
              <div className="month-metrics">
                <span><small>Terças</small><b>{month.tuesdayCount}</b></span>
                <span><small>Juros das terças</small><b>{currency(month.tuesdayTotal)}</b></span>
                <span className="month-total"><small>Somatória no fim do mês</small><b>{currency(month.runningTotal)}</b></span>
              </div>
            </header>
            <div className="month-math">
              Terças: {month.tuesdayCount} × {currency(forecast.weeklyAmount)} = <b>{currency(month.tuesdayTotal)}</b>
              <i>·</i>
              Principal continua <b>{currency(month.principalDue)}</b>
            </div>
            <div className={`month-rows forecast ${hasActions ? 'with-actions' : ''}`}>
              {month.rows.length ? month.rows.map(item => {
                const status = liveStatus(item);
                const amount = loan ? payableAmount(loan, item) : item.amount;
                const extra = loan ? roundCents(amount - item.amount) : 0;
                return (
                  <div key={item.id}>
                    <span className="parcel-number">{String(item.number).padStart(2, '0')}</span>
                    <span><small>Vencimento</small><b>{shortDate(item.dueDate)}</b><em>{weekdayLabel(parseIsoDate(item.dueDate).getDay())}</em></span>
                    <span><small>Juros da terça</small><b>{currency(item.amount)}</b></span>
                    <span><small>Atraso por cima</small><b>{extra > 0 ? `+ ${currency(extra)}` : '—'}</b></span>
                    <span><small>Somatória</small><b>{currency(item.runningTotal)}</b></span>
                    <span><small>Principal</small><b>{currency(month.principalDue)}</b></span>
                    <strong>
                      <em className={`status-chip ${status.toLowerCase()}`}>{item.inLedger ? status : 'Previsto'}</em>
                      {hasActions && item.inLedger && item.status !== 'Pago' && onRegister && <button type="button" className="primary-button small" onClick={() => onRegister(item.id)}>Registrar</button>}
                      {hasActions && item.inLedger && item.status === 'Aguardando' && onConfirm && <button type="button" className="outline-button small" onClick={() => onConfirm(item.id)}>Confirmar</button>}
                    </strong>
                  </div>
                );
              }) : <p className="month-empty">Nenhuma terça neste trecho. A primeira cobrança cai no mês seguinte.</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PaymentScheduleTable({
  installments,
  loan,
  title = 'Tabela cronológica',
  onRegister,
  onConfirm,
}: {
  installments: Installment[];
  loan?: Loan;
  title?: string;
  onRegister?: (id: string) => void;
  onConfirm?: (id: string) => void;
}) {
  const groups = groupInstallmentsByDate(installments);
  const weeklyCount = installments.filter(item => item.kind === 'weekly').length;
  const monthlyCount = installments.filter(item => item.kind === 'monthly').length;
  const hasActions = Boolean(onRegister || onConfirm);

  if (!installments.length) {
    return <section className="monthly-schedule empty"><p>Informe o valor, o prazo, o dia mensal e o pagamento semanal para montar a tabela.</p></section>;
  }

  return (
    <section className="monthly-schedule">
      <div className="schedule-heading">
        <div>
          <p className="eyebrow">PAGAMENTOS NA ORDEM DAS DATAS</p>
          <h3>{title}</h3>
        </div>
        <span>{monthlyCount ? `${monthlyCount} mensais · ${weeklyCount} semanais` : `${weeklyCount} terças`}</span>
      </div>
      <div className="table-scroll">
        <div className={`chrono-table ${hasActions ? 'with-actions' : ''}`}>
          <div className="table-row table-head">
            <span>Data</span>
            <span>Tipo</span>
            <span>Valor</span>
            <span>Situação</span>
            {hasActions && <span></span>}
          </div>
          {groups.map(group => (
            <div className="chrono-day" key={group.date}>
              {group.rows.length > 1 && (
                <div className="chrono-day-total">
                  <span>{shortDate(group.date)}</span>
                  <b>Total do dia {currency(loan ? group.rows.reduce((sum, item) => sum + payableAmount(loan, item), 0) : group.total)}</b>
                </div>
              )}
              {group.rows.map(item => {
                const status = liveStatus(item);
                const amount = loan ? payableAmount(loan, item) : item.amount;
                return (
                  <div className="table-row" key={item.id}>
                    <span><b>{shortDate(item.dueDate)}</b></span>
                    <span><em className={`kind-pill ${item.kind || 'legacy'}`}>{installmentKindLabel(item.kind)}</em></span>
                    <span>
                      <b>{currency(amount)}</b>
                      {item.kind === 'monthly' && <small>Principal {currency(item.principal)}</small>}
                    </span>
                    <span><em className={`status-chip ${status.toLowerCase()}`}>{status}</em></span>
                    {hasActions && (
                      <span className="chrono-actions">
                        {item.status !== 'Pago' && onRegister && <button className="primary-button small" onClick={() => onRegister(item.id)}>Registrar</button>}
                        {item.status === 'Aguardando' && onConfirm && <button className="outline-button small" onClick={() => onConfirm(item.id)}>Confirmar</button>}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MonthlySchedule({
  installments, title = 'Calendário por mês',
}: {
  installments: Installment[];
  weeklyInterest?: number;
  title?: string;
}) {
  return <PaymentScheduleTable installments={installments} title={title} />;
}

export function loanForecastProps(loan: Loan) {
  const dailyAmount = loanDailyAmount(loan);
  return {
    principal: loan.principal,
    dailyAmount,
    weeklyAmount: loan.weeklyAmount || weeklyFromDaily(dailyAmount),
    weeklyWeekday: loan.weeklyWeekday ?? loan.paymentWeekdays?.[0] ?? DEFAULT_WEEKLY_WEEKDAY,
    startDate: loan.startDate || loan.createdAt,
    installments: loan.installments,
    loan,
  };
}

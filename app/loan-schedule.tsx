'use client';

import { Installment, Loan, currency, groupInstallmentsByDate, installmentKindLabel, liveStatus, payableAmount, shortDate } from './lib';

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

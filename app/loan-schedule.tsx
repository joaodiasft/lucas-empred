'use client';

import { Installment, currency, installmentMonthKey, monthLabel, shortDate } from './lib';

export function MonthlySchedule({ installments, title = 'Cronograma por mês' }: { installments: Installment[]; title?: string }) {
  const groups = [...new Set(installments.map(item => installmentMonthKey(item.dueDate)))].map(key => {
    const rows = installments.filter(item => installmentMonthKey(item.dueDate) === key);
    return { key, rows, principal:rows.reduce((sum,item)=>sum+item.principal,0), interest:rows.reduce((sum,item)=>sum+item.interest,0), total:rows.reduce((sum,item)=>sum+item.amount,0) };
  });
  return <section className="monthly-schedule"><div className="schedule-heading"><div><p className="eyebrow">RESULTADO ORGANIZADO</p><h3>{title}</h3></div><span>{installments.length} vencimentos em {groups.length} {groups.length === 1 ? 'mês' : 'meses'}</span></div><div className="month-stack">{groups.map(group=><article className="month-card" key={group.key}><header><div><small>MÊS</small><h4>{monthLabel(group.key)}</h4></div><div className="month-metrics"><span><small>Vencimentos</small><b>{group.rows.length}</b></span><span><small>Principal</small><b>{currency(group.principal)}</b></span><span><small>Juros</small><b>{currency(group.interest)}</b></span><span className="month-total"><small>Total do mês</small><b>{currency(group.total)}</b></span></div></header><div className="month-rows">{group.rows.map(item=><div key={item.id}><span className="parcel-number">{String(item.number).padStart(2,'0')}</span><span><small>Vencimento</small><b>{shortDate(item.dueDate)}</b></span><span><small>Principal</small><b>{currency(item.principal)}</b></span><span><small>Juros</small><b>{currency(item.interest)}</b></span><strong>{currency(item.amount)}</strong></div>)}</div></article>)}</div></section>;
}

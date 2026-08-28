'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, StatusBadge, SummaryCard } from './components';
import { Client, Installment, Loan, currency, initials, liveStatus, loanFrequency, monthCells, parseIsoDate, payableAmount, shortDate, startOfWeek, toIsoDate, weekDays } from './lib';

type CalMode = 'weekly' | 'monthly';
type CalFilter = 'todos' | 'pendente' | 'atrasado' | 'pago';
type CalEvent = { loan: Loan; item: Installment; client: Client; date: string; status: ReturnType<typeof liveStatus>; amount: number };

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekTitle(days: Date[]) {
  const start = days[0];
  const end = days[6];
  const startMonth = start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const endMonth = end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} de ${endMonth} ${end.getFullYear()}`;
  return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

export function CalendarView({ clients, loans, onOpenLoan, onRegister }: { clients: Client[]; loans: Loan[]; onOpenLoan: (id: string) => void; onRegister?: (loanId: string, installmentId: string) => void }) {
  const today = new Date();
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [mode, setMode] = useState<CalMode>('weekly');
  const [filter, setFilter] = useState<CalFilter>('todos');
  const [selected, setSelected] = useState(toIsoDate(today));

  const events = useMemo<CalEvent[]>(() => loans.flatMap(loan => {
    const client = clients.find(item => item.id === loan.clientId);
    if (!client) return [];
    return loan.installments.map(item => ({
      loan, item, client, date: item.dueDate, status: liveStatus(item), amount: payableAmount(loan, item),
    }));
  }), [clients, loans]);

  const days = mode === 'weekly' ? weekDays(anchor) : monthCells(anchor);
  const visibleDates = new Set(days.map(toIsoDate));
  const inView = events.filter(event => {
    if (!visibleDates.has(event.date)) return false;
    if (filter === 'todos') return true;
    if (filter === 'pendente') return event.status === 'Pendente' || event.status === 'Aguardando';
    if (filter === 'atrasado') return event.status === 'Atrasado';
    return event.status === 'Pago';
  });
  const byDate = (iso: string) => inView.filter(event => event.date === iso).sort((a, b) => a.client.name.localeCompare(b.client.name));
  const selectedEvents = byDate(selected);
  const due = inView.filter(event => event.status !== 'Pago').reduce((sum, event) => sum + event.amount, 0);
  const paid = inView.filter(event => event.status === 'Pago').reduce((sum, event) => sum + event.item.paidAmount, 0);
  const late = inView.filter(event => event.status === 'Atrasado');
  const weeklyCount = inView.filter(event => event.item.kind === 'weekly' || (!event.item.kind && loanFrequency(event.loan) === 'weekly')).length;
  const monthlyCount = inView.filter(event => event.item.kind === 'monthly' || (!event.item.kind && loanFrequency(event.loan) === 'monthly')).length;

  const shift = (direction: number) => {
    const next = new Date(anchor);
    if (mode === 'weekly') next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction);
    setAnchor(next);
    setSelected(toIsoDate(mode === 'weekly' ? startOfWeek(next) : new Date(next.getFullYear(), next.getMonth(), 1)));
  };

  const goToday = () => {
    const now = new Date();
    setAnchor(now);
    setSelected(toIsoDate(now));
  };

  const title = mode === 'weekly'
    ? weekTitle(weekDays(anchor))
    : anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return <>
    <PageHeader
      eyebrow="AGENDA DE COBRANÇA"
      title="Calendário"
      subtitle="Semana completa com vencimentos, atrasos e recebidos. Alterne para o mês quando quiser a visão ampla."
      action={
        <div className="cal-head-actions">
          <div className="cal-mode">{(['weekly', 'monthly'] as CalMode[]).map(item => (
            <button type="button" key={item} className={mode === item ? 'active' : ''} onClick={() => { setMode(item); setAnchor(new Date(anchor)); }}>{item === 'weekly' ? 'Semanal' : 'Mensal'}</button>
          ))}</div>
          <button className="secondary-button" onClick={goToday}>Hoje</button>
        </div>
      }
    />

    <div className="cal-toolbar">
      <button className="cal-nav" onClick={() => shift(-1)} aria-label={mode === 'weekly' ? 'Semana anterior' : 'Mês anterior'}>‹</button>
      <div className="cal-title"><p className="eyebrow">{mode === 'weekly' ? 'SEMANA' : 'MÊS'}</p><h3>{title}</h3></div>
      <button className="cal-nav" onClick={() => shift(1)} aria-label={mode === 'weekly' ? 'Próxima semana' : 'Próximo mês'}>›</button>
    </div>

    <section className="summary-grid cal-metrics">
      <SummaryCard label="A receber no período" value={currency(due)} detail={`${inView.filter(event => event.status !== 'Pago').length} parcelas`} tone="navy" />
      <SummaryCard label="Já recebido" value={currency(paid)} detail="Confirmados neste recorte" tone="green" />
      <SummaryCard label="Em atraso" value={currency(late.reduce((sum, event) => sum + event.amount, 0))} detail={`${late.length} vencimento(s)`} tone="red" />
      <SummaryCard label="Mix da agenda" value={`${weeklyCount} · ${monthlyCount}`} detail="Semanais · mensais" tone="gold" />
    </section>

    <div className="cal-filters">
      {([
        ['todos', 'Todos'],
        ['pendente', 'Pendentes'],
        ['atrasado', 'Atrasados'],
        ['pago', 'Pagos'],
      ] as [CalFilter, string][]).map(([id, label]) => (
        <button type="button" key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
      ))}
    </div>

    {mode === 'weekly' ? (
      <section className="week-board">
        <div className="week-grid">
          {weekDays(anchor).map((day, index) => {
            const iso = toIsoDate(day);
            const items = byDate(iso);
            const isToday = sameDay(day, today);
            const isSelected = iso === selected;
            const weekend = index >= 5;
            return <article key={iso} className={`week-col ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${weekend ? 'weekend' : ''}`}>
              <button type="button" className="week-col-head" onClick={() => setSelected(iso)}>
                <small>{WEEKDAYS[index]}</small>
                <b>{day.getDate()}</b>
                <em>{items.length ? `${items.length} venc.` : 'Livre'}</em>
              </button>
              <div className="week-col-body">
                {items.length ? items.map(event => (
                  <button type="button" key={event.item.id} className={`cal-event ${event.status.toLowerCase()}`} onClick={() => { setSelected(iso); onOpenLoan(event.loan.id); }}>
                    <span className="cal-event-photo">{event.client.photo ? <img src={event.client.photo} alt="" /> : initials(event.client.name)}</span>
                    <span>
                      <b>{event.client.name.split(' ')[0]} {event.client.name.split(' ').slice(-1)}</b>
                      <small>{event.item.kind === 'monthly' ? 'Mensal' : event.item.kind === 'weekly' ? 'Semanal' : `Parc. ${event.item.number}`} · {currency(event.amount)}</small>
                    </span>
                    <strong>{currency(event.amount)}</strong>
                  </button>
                )) : <p className="cal-empty-day">Sem cobranças</p>}
              </div>
            </article>;
          })}
        </div>
      </section>
    ) : (
      <section className="month-board">
        <div className="month-head">{WEEKDAYS_SHORT.map(day => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">
          {days.map(day => {
            const iso = toIsoDate(day);
            const items = byDate(iso);
            const outside = day.getMonth() !== anchor.getMonth();
            const isToday = sameDay(day, today);
            return <button type="button" key={iso} className={`month-cell ${outside ? 'outside' : ''} ${isToday ? 'today' : ''} ${iso === selected ? 'selected' : ''}`} onClick={() => setSelected(iso)}>
              <span>{day.getDate()}</span>
              <div className="month-dots">
                {items.slice(0, 3).map(event => <i key={event.item.id} className={event.status.toLowerCase()} />)}
                {items.length > 3 && <small>+{items.length - 3}</small>}
              </div>
              {items[0] && <em>{currency(items.reduce((sum, event) => sum + event.amount, 0))}</em>}
            </button>;
          })}
        </div>
      </section>
    )}

    <section className="cal-agenda panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{WEEKDAYS[(parseIsoDate(selected).getDay() + 6) % 7].toUpperCase()}</p>
          <h3>{shortDate(selected)}</h3>
        </div>
        <span className="subtle-count">{selectedEvents.length} vencimento(s){selectedEvents.length > 1 ? ` · total ${currency(selectedEvents.reduce((sum, event) => sum + event.amount, 0))}` : ''}</span>
      </div>
      {selectedEvents.length ? <div className="agenda-list">
        {selectedEvents.map(event => (
          <div className="agenda-item" key={event.item.id}>
            <button type="button" className="agenda-row" onClick={() => onOpenLoan(event.loan.id)}>
              <span className="cal-event-photo large">{event.client.photo ? <img src={event.client.photo} alt="" /> : initials(event.client.name)}</span>
              <span>
                <b>{event.client.name}</b>
                <small>{event.loan.contractNumber} · {event.item.kind === 'monthly' ? 'Mensal' : event.item.kind === 'weekly' ? 'Semanal' : `Parcela ${event.item.number}`} · {shortDate(event.item.dueDate)}</small>
              </span>
              <span className="agenda-value">
                <b>{currency(event.amount)}</b>
                <StatusBadge status={event.status} />
              </span>
            </button>
            {event.status !== 'Pago' && onRegister && (
              <button type="button" className="primary-button small" onClick={() => onRegister(event.loan.id, event.item.id)}>Registrar</button>
            )}
          </div>
        ))}
      </div> : <EmptyState title="Nada neste dia" text="Não há parcela semanal nem mensal com vencimento nesta data." />}
    </section>
  </>;
}

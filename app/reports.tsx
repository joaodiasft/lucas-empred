'use client';

import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, StatusBadge, SummaryCard } from './components';
import { Client, InstallmentStatus, Loan, currency, frequencyLabel, liveStatus, loanFrequency, payableAmount, shortDate } from './lib';

type ReportTemplate = 'portfolio' | 'received' | 'late' | 'interest';

const yearStart = `${new Date().getFullYear()}-01-01`;
const yearEnd = `${new Date().getFullYear()}-12-31`;

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"','""')}"`;
}

export function ReportsView({ clients, loans, notify }: { clients: Client[]; loans: Loan[]; notify: (message: string) => void }) {
  const [template, setTemplate] = useState<ReportTemplate>('portfolio');
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(yearEnd);
  const [clientId, setClientId] = useState('all');
  const [status, setStatus] = useState<'all' | InstallmentStatus>('all');
  const [frequency, setFrequency] = useState<'all' | 'weekly' | 'monthly'>('all');

  const allRows = useMemo(() => loans.flatMap(loan => loan.installments.map(installment => ({
    loan,
    installment,
    client: clients.find(client => client.id === loan.clientId),
    status: liveStatus(installment),
  }))).filter(item => item.client), [clients, loans]);

  const rows = allRows.filter(row => {
    const byDate = row.installment.dueDate >= from && row.installment.dueDate <= to;
    const byClient = clientId === 'all' || row.client?.id === clientId;
    const byStatus = status === 'all' || row.status === status;
    const byFrequency = frequency === 'all' || loanFrequency(row.loan) === frequency;
    return byDate && byClient && byStatus && byFrequency;
  });

  const scheduled = rows.reduce((sum,row) => sum + payableAmount(row.loan,row.installment),0);
  const received = rows.filter(row => row.status === 'Pago').reduce((sum,row) => sum + row.installment.paidAmount,0);
  const interest = rows.filter(row => row.status === 'Pago').reduce((sum,row) => sum + row.installment.interest,0);
  const late = rows.filter(row => row.status === 'Atrasado').reduce((sum,row) => sum + payableAmount(row.loan,row.installment),0);
  const recovery = scheduled ? received / scheduled * 100 : 0;

  const applyTemplate = (next: ReportTemplate) => {
    setTemplate(next);
    setClientId('all');
    setFrequency('all');
    if (next === 'received' || next === 'interest') setStatus('Pago');
    else if (next === 'late') setStatus('Atrasado');
    else setStatus('all');
  };

  const exportCsv = () => {
    const header = ['Cliente','CPF','Contrato','Periodicidade','Parcela','Vencimento','Status','Principal','Juros','Valor atualizado'];
    const body = rows.map(row => [row.client!.name,row.client!.cpf,row.loan.contractNumber,frequencyLabel(loanFrequency(row.loan)),row.installment.number,shortDate(row.installment.dueDate),row.status,row.installment.principal.toFixed(2),row.installment.interest.toFixed(2),payableAmount(row.loan,row.installment).toFixed(2)]);
    const csv = '\ufeff' + [header,...body].map(line => line.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=`lucas-empred-relatorio-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    notify('Relatório exportado em CSV.');
  };

  return <>
    <PageHeader eyebrow="RELATÓRIOS PERSONALIZADOS" title="Central de relatórios" subtitle="Monte uma visão por período, cliente, situação e periodicidade; depois exporte para análise." action={<button className="primary-button" onClick={exportCsv} disabled={!rows.length}>↓ Exportar CSV</button>} />
    <section className="report-templates">
      <button className={template === 'portfolio' ? 'active' : ''} onClick={() => applyTemplate('portfolio')}><span>▤</span><b>Carteira completa</b><small>Visão geral de todas as parcelas</small></button>
      <button className={template === 'received' ? 'active' : ''} onClick={() => applyTemplate('received')}><span>✓</span><b>Recebimentos</b><small>Somente valores já confirmados</small></button>
      <button className={template === 'late' ? 'active' : ''} onClick={() => applyTemplate('late')}><span>!</span><b>Inadimplência</b><small>Atrasos e valores atualizados</small></button>
      <button className={template === 'interest' ? 'active' : ''} onClick={() => applyTemplate('interest')}><span>%</span><b>Juros realizados</b><small>Receita financeira recebida</small></button>
    </section>

    <section className="report-filter panel">
      <div className="panel-head"><div><p className="eyebrow">FILTROS DO RELATÓRIO</p><h3>Personalizar visão</h3></div><button className="text-button" onClick={() => { setFrom(yearStart); setTo(yearEnd); setClientId('all'); setStatus('all'); setFrequency('all'); }}>Limpar filtros</button></div>
      <div className="report-filter-grid">
        <label>Data inicial<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>Data final<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        <label>Cliente<select value={clientId} onChange={event => setClientId(event.target.value)}><option value="all">Todos os clientes</option>{clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
        <label>Situação<select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">Todas</option><option value="Pago">Pagas</option><option value="Pendente">Pendentes</option><option value="Aguardando">Aguardando</option><option value="Atrasado">Atrasadas</option></select></label>
        <label>Periodicidade<select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="all">Semanal e mensal</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
      </div>
    </section>

    <section className="summary-grid report-summary">
      <SummaryCard label="Valor do relatório" value={currency(scheduled)} detail={`${rows.length} parcelas no filtro`} tone="navy" icon="$" />
      <SummaryCard label="Recebido" value={currency(received)} detail={`${recovery.toFixed(1).replace('.',',')}% do valor filtrado`} tone="green" icon="✓" />
      <SummaryCard label="Em atraso" value={currency(late)} detail={`${rows.filter(row => row.status === 'Atrasado').length} ocorrências`} tone="red" icon="!" />
      <SummaryCard label="Juros recebidos" value={currency(interest)} detail="Receita realizada" tone="gold" icon="%" />
    </section>

    <section className="table-card report-table-card">
      <div className="section-title"><div><p className="eyebrow">RESULTADO</p><h3>{rows.length} lançamento(s)</h3></div><span>{shortDate(from)} até {shortDate(to)}</span></div>
      {rows.length ? <div className="table-scroll"><div className="report-table"><div className="table-row table-head"><span>Cliente</span><span>Contrato</span><span>Vencimento</span><span>Periodicidade</span><span>Status</span><span>Valor</span></div>{rows.map(row => <div className="table-row" key={row.installment.id}><span><b>{row.client!.name}</b><small>Parcela {row.installment.number}/{row.loan.installments.length}</small></span><span><b>{row.loan.contractNumber}</b><small>{row.client!.cpf}</small></span><span>{shortDate(row.installment.dueDate)}</span><span>{frequencyLabel(loanFrequency(row.loan))}</span><StatusBadge status={row.status} /><strong>{currency(payableAmount(row.loan,row.installment))}</strong></div>)}</div></div> : <EmptyState title="Nenhum lançamento" text="Ajuste o período ou os filtros para gerar o relatório." />}
    </section>
  </>;
}

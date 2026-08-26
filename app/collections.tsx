'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageHeader, StatusBadge, SummaryCard } from './components';
import { AppSettings, Client, Loan, currency, daysLate, liveStatus, payableAmount, persistGet, persistSet, shortDate, uid } from './lib';

type QueueFilter = 'today' | 'late' | 'upcoming' | 'contacted' | 'all';
type MessageTone = 'friendly' | 'today' | 'late' | 'firm';

interface ContactLog {
  id: string;
  installmentId: string;
  clientName: string;
  createdAt: string;
  tone: MessageTone;
  message: string;
}

const dayMs = 86400000;
const isoToday = () => new Date().toISOString().slice(0, 10);

function dueDistance(value: string) {
  const today = new Date(`${isoToday()}T12:00:00`).getTime();
  return Math.round((new Date(`${value}T12:00:00`).getTime() - today) / dayMs);
}

function messageFor(tone: MessageTone, client: Client, loan: Loan, installment: Loan['installments'][number], settings: AppSettings) {
  const first = client.name.split(' ')[0];
  const amount = currency(payableAmount(loan, installment));
  const base = `Parcela ${installment.number}/${loan.installments.length}, no valor de ${amount}.`;
  if (tone === 'friendly') return `Olá, ${first}! Tudo bem? Passando para lembrar que sua ${base.toLowerCase()} vence em ${shortDate(installment.dueDate)}. A chave PIX é ${settings.pixKey}. Se precisar falar sobre o pagamento, estou à disposição.`;
  if (tone === 'today') return `Olá, ${first}! Sua ${base.toLowerCase()} vence hoje. Para facilitar, a chave PIX é ${settings.pixKey}. Depois do pagamento, envie o comprovante pelo aplicativo.`;
  if (tone === 'firm') return `Olá, ${first}. A ${base.toLowerCase()} continua pendente há ${daysLate(installment.dueDate)} dias. O valor informado já considera os encargos previstos no contrato. Entre em contato para regularizar ou conversar sobre uma solução.`;
  return `Olá, ${first}. Identificamos que a ${base.toLowerCase()} venceu em ${shortDate(installment.dueDate)} e ainda está pendente. O valor atualizado é ${amount}. A chave PIX é ${settings.pixKey}. Caso já tenha pago, desconsidere e envie o comprovante.`;
}

export function CollectionsView({
  clients, loans, settings, onOpenLoan, onRegister, notify,
}: {
  clients: Client[];
  loans: Loan[];
  settings: AppSettings;
  onOpenLoan: (id: string) => void;
  onRegister?: (loanId: string, installmentId: string) => void;
  notify: (message: string) => void;
}) {
  const [filter, setFilter] = useState<QueueFilter>('today');
  const [search, setSearch] = useState('');
  const [tone, setTone] = useState<MessageTone>('friendly');
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<ContactLog[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let live = true;
    persistGet<ContactLog[]>('le-collection-history-v1').then(value => {
      if (live && value) setHistory(value);
      if (live) setHydrated(true);
    });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (hydrated) void persistSet('le-collection-history-v1', history); }, [history, hydrated]);

  const queue = useMemo(() => loans.flatMap(loan => loan.installments.map(installment => {
    const client = clients.find(item => item.id === loan.clientId);
    const status = liveStatus(installment);
    return client ? { loan, installment, client, status, distance: dueDistance(installment.dueDate) } : null;
  })).filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.status !== 'Pago'), [clients, loans]);

  const contactedIds = useMemo(() => new Set(history.map(item => item.installmentId)), [history]);
  const todayRows = queue.filter(item => item.distance === 0);
  const lateRows = queue.filter(item => item.status === 'Atrasado');
  const upcomingRows = queue.filter(item => item.distance > 0 && item.distance <= Math.max(7, settings.reminderDays));
  const rows = queue.filter(item => {
    const matchesSearch = `${item.client.name} ${item.client.phone} ${item.loan.contractNumber}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'today') return item.distance === 0;
    if (filter === 'late') return item.status === 'Atrasado';
    if (filter === 'upcoming') return item.distance > 0 && item.distance <= Math.max(7, settings.reminderDays);
    if (filter === 'contacted') return contactedIds.has(item.installment.id);
    return true;
  }).sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));

  const current = queue.find(item => item.installment.id === selected) || rows[0];
  const currentMessage = current ? messageFor(tone, current.client, current.loan, current.installment, settings) : '';
  const copyMessage = async () => {
    if (!current) return;
    await navigator.clipboard?.writeText(currentMessage);
    const log: ContactLog = { id:uid('msg'), installmentId:current.installment.id, clientName:current.client.name, createdAt:new Date().toISOString(), tone, message:currentMessage };
    setHistory(items => [log, ...items].slice(0, 100));
    notify('Mensagem copiada e contato registrado no histórico.');
  };

  return <>
    <PageHeader eyebrow="RÉGUA DE COBRANÇA" title="Central de cobranças" subtitle="Organize quem precisa ser lembrado, use mensagens prontas e registre cada contato." action={<span className="integration-pill">WhatsApp real • próxima fase</span>} />
    <section className="summary-grid collection-summary">
      <SummaryCard label="Vencem hoje" value={String(todayRows.length)} detail={currency(todayRows.reduce((sum, item) => sum + payableAmount(item.loan, item.installment), 0))} tone="gold" icon="•" />
      <SummaryCard label="Em atraso" value={String(lateRows.length)} detail={currency(lateRows.reduce((sum, item) => sum + payableAmount(item.loan, item.installment), 0))} tone="red" icon="!" />
      <SummaryCard label="Próximos 7 dias" value={String(upcomingRows.length)} detail="Lembretes sugeridos" tone="navy" icon="→" />
      <SummaryCard label="Contatos registrados" value={String(history.length)} detail="Histórico neste dispositivo" tone="green" icon="✓" />
    </section>

    <section className="collection-ruler">
      <div><span className="ruler-icon early">−{settings.reminderDays}</span><b>Lembrete amigável</b><small>{settings.reminderDays} dias antes do vencimento</small></div>
      <i />
      <div><span className="ruler-icon today">0</span><b>Vence hoje</b><small>Reforço com valor e chave PIX</small></div>
      <i />
      <div><span className="ruler-icon late">+1</span><b>Primeiro atraso</b><small>Aviso cordial com valor atualizado</small></div>
      <i />
      <div><span className="ruler-icon firm">+7</span><b>Cobrança firme</b><small>Convite para regularizar ou negociar</small></div>
    </section>

    <div className="collection-layout">
      <section className="panel queue-panel">
        <div className="panel-head"><div><p className="eyebrow">FILA INTELIGENTE</p><h3>Contatos sugeridos</h3></div><span className="subtle-count">{rows.length} cliente(s)</span></div>
        <div className="collection-tabs">
          {([['today','Hoje'],['late','Atrasados'],['upcoming','Próximos'],['contacted','Contatados'],['all','Todos']] as [QueueFilter,string][]).map(([id,label]) => <button className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} key={id}>{label}</button>)}
        </div>
        <label className="search-field collection-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente ou contrato" /></label>
        {rows.length ? <div className="collection-queue">{rows.map(item => <button className={current?.installment.id === item.installment.id ? 'active' : ''} onClick={() => { setSelected(item.installment.id); setTone(item.status === 'Atrasado' ? (daysLate(item.installment.dueDate) >= 7 ? 'firm' : 'late') : item.distance === 0 ? 'today' : 'friendly'); }} key={item.installment.id}><span className="avatar light">{item.client.name.split(' ').slice(0,2).map(part => part[0]).join('')}</span><span><b>{item.client.name}</b><small>{item.distance < 0 ? `${Math.abs(item.distance)} dia(s) em atraso` : item.distance === 0 ? 'Vence hoje' : `Vence em ${item.distance} dia(s)`}</small></span><span><b>{currency(payableAmount(item.loan,item.installment))}</b><StatusBadge status={item.status} /></span>{contactedIds.has(item.installment.id) && <em title="Contato registrado">✓</em>}</button>)}</div> : <EmptyState title="Fila vazia" text="Não há cobranças para este filtro." />}
      </section>

      <aside className="panel message-composer">
        <div className="panel-head"><div><p className="eyebrow">MENSAGEM PRONTA</p><h3>Preparar contato</h3></div>{current && <span className="subtle-count">{current.client.phone}</span>}</div>
        {current ? <>
          <div className="tone-picker">
            {([['friendly','Amigável'],['today','Vence hoje'],['late','Em atraso'],['firm','Mais firme']] as [MessageTone,string][]).map(([id,label]) => <button className={tone === id ? 'active' : ''} onClick={() => setTone(id)} key={id}>{label}</button>)}
          </div>
          <div className="message-preview"><div className="message-contact"><span className="avatar">{current.client.name.split(' ').slice(0,2).map(part => part[0]).join('')}</span><span><b>{current.client.name}</b><small>{current.loan.contractNumber} • Parcela {current.installment.number}</small></span></div><p>{currentMessage}</p><small>Modelo editável quando a integração do WhatsApp for conectada.</small></div>
          <div className="composer-actions"><button className="secondary-button" onClick={() => onOpenLoan(current.loan.id)}>Ver contrato</button>{onRegister && current.status !== 'Pago' && <button className="primary-button" onClick={() => onRegister(current.loan.id, current.installment.id)}>Registrar pagamento</button>}<button className="secondary-button" onClick={copyMessage}>Copiar mensagem</button></div>
        </> : <EmptyState title="Selecione uma cobrança" text="Escolha um cliente na fila para preparar a mensagem." />}
      </aside>
    </div>

    {history.length > 0 && <section className="panel contact-history"><div className="panel-head"><div><p className="eyebrow">RASTREABILIDADE</p><h3>Histórico de contatos</h3></div><button className="text-button" onClick={() => setHistory([])}>Limpar histórico</button></div><div>{history.slice(0,8).map(item => <article key={item.id}><span className="history-check">✓</span><span><b>{item.clientName}</b><small>{new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.createdAt))} • {item.tone === 'friendly' ? 'Amigável' : item.tone === 'today' ? 'Vence hoje' : item.tone === 'late' ? 'Em atraso' : 'Mais firme'}</small></span><p>{item.message}</p></article>)}</div></section>}
  </>;
}

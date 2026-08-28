'use client';

/* eslint-disable @next/next/no-img-element */

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { CalendarView } from './calendar';
import { CollectionsView } from './collections';
import { ConfirmModal, EmptyState, FieldBlock, Modal, MoneyInput, PageHeader, RiskBadge, SignaturePad, StatusBadge, Stepper, SummaryCard, Toast } from './components';
import { NewLoanView } from './loan-form';
import { PaymentScheduleTable } from './loan-schedule';
import { PaymentsView, RegisterPaymentModal } from './payments';
import { ReportsView } from './reports';
import { AccessAccount, AppSettings, Client, GeoLocation, Installment, Loan, Page, PayFrequency, PaymentRecord, Reference, Role, TeamMember, applyInstallmentPayment, callHref, compressImage, currency, daysLate, defaultSettings, digitsOnly, dualScheduleSummary, formatAddress, formatRate, frequencyLabel, generateInstallments, initials, isClientActive, isDualScheduleLoan, loanBalance, loanFrequency, mapEmbedUrl, mapOpenUrl, payableAmount, periodLabel, persistGet, persistSet, rateFromInterest, referenceHref, riskFor, roundCents, seedAccounts, seedClients, seedLoans, seedTeam, shortDate, uid, weekdayLabel, whatsappHref } from './lib';

function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let live = true;
    persistGet<T>(key).then(value => {
      if (!live) return;
      if (value !== undefined) setState(value);
      setHydrated(true);
    });
    return () => { live = false; };
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    void persistSet(key, state);
  }, [key, state, hydrated]);
  return [state, setState] as const;
}

function PersonPhoto({ name, photo, size = 'md' }: { name: string; photo?: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = `avatar photo-avatar ${size === 'lg' ? 'large' : size === 'sm' ? 'small' : ''} ${photo ? 'has-photo' : 'light'}`;
  if (photo) return <span className={cls}><img src={photo} alt={name} /></span>;
  return <span className={cls}>{initials(name)}</span>;
}

const navItems: { page: Page; label: string; icon: string; roles: Role[] }[] = [
  { page:'home', label:'Visão geral', icon:'⌂', roles:['admin','staff'] },
  { page:'clients', label:'Clientes', icon:'◇', roles:['admin','staff'] },
  { page:'calendar', label:'Calendário', icon:'▣', roles:['admin','staff'] },
  { page:'collections', label:'Cobranças', icon:'◉', roles:['admin','staff'] },
  { page:'loans', label:'Empréstimos', icon:'▤', roles:['admin','staff'] },
  { page:'payments', label:'Pagamentos', icon:'✓', roles:['admin','staff'] },
  { page:'dashboard', label:'Dashboard', icon:'⌁', roles:['admin'] },
  { page:'reports', label:'Relatórios', icon:'▦', roles:['admin'] },
  { page:'team', label:'Equipe', icon:'♙', roles:['admin'] },
  { page:'settings', label:'Configurações', icon:'⚙', roles:['admin'] },
  { page:'client-home', label:'Minha conta', icon:'⌂', roles:['client'] },
];

type ModalState = { type:'contract'|'renegotiate'|'payment'|'team'|'confirm-payment'|'reject-payment'|'inactivate-client'|'register-payment'; loanId?:string; installmentId?:string; clientId?:string } | null;

export default function App() {
  const [clients, setClients] = usePersistentState<Client[]>('le-clients-v2', seedClients);
  const [loans, setLoans] = usePersistentState<Loan[]>('le-loans', seedLoans);
  const [team, setTeam] = usePersistentState<TeamMember[]>('le-team', seedTeam);
  const [settings, setSettings] = usePersistentState<AppSettings>('le-settings', defaultSettings);
  const [accounts, setAccounts] = usePersistentState<AccessAccount[]>('le-accounts-v2', seedAccounts);
  const [role, setRole] = usePersistentState<Role>('le-role', 'admin');
  const [clientSession, setClientSession] = usePersistentState('le-client-session', seedClients[0].id);
  const [loggedIn, setLoggedIn] = usePersistentState('le-logged-in', false);
  const [sessionName, setSessionName] = usePersistentState('le-session-name', 'Lucas Silva');
  const [page, setPage] = useState<Page>(role === 'client' ? 'client-home' : 'home');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [prefilledClient, setPrefilledClient] = useState<string | undefined>();
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const notify = (message: string) => setToast(message);
  const navigate = (target: Page, id?: string) => {
    if (target === 'client-detail') setSelectedClient(id || null);
    if (target === 'loan-detail') setSelectedLoan(id || null);
    setPage(target); setMobileMenu(false); window.scrollTo({top:0,behavior:'smooth'});
  };
  const addClient = (client: Client) => {
    setClients(items => [client, ...items]);
    setAccounts(items => [{
      id: uid('acc'),
      name: client.name,
      email: digitsOnly(client.cpf),
      password: client.accessPin,
      role: 'client',
      clientId: client.id,
      active: true,
    }, ...items]);
    setSelectedClient(client.id);
    setPage('client-detail');
    notify('Cliente cadastrado e salvo neste aparelho.');
  };
  const createLoan = (loan: Loan) => { setLoans(items => [loan, ...items]); setSelectedLoan(loan.id); setPage('loan-detail'); notify('Empréstimo e parcelas criados com sucesso.'); };
  const updateInstallment = (loanId: string, installmentId: string, update: Partial<Installment>) => setLoans(items => items.map(loan => loan.id === loanId ? {...loan, installments:loan.installments.map(item => item.id === installmentId ? {...item,...update} : item)} : loan));
  const confirmPayment = (loanId: string, installmentId: string) => {
    const loan = loans.find(item => item.id === loanId);
    const installment = loan?.installments.find(item => item.id === installmentId);
    if (!loan || !installment) return;
    registerPayment(loanId, installmentId, {
      paidAmount: payableAmount(loan, installment),
      paidAt: new Date().toISOString().slice(0, 10),
      paymentMethod: installment.paymentMethod || 'pix',
      receiptName: installment.receiptName,
    });
  };
  const registerPayment = (loanId: string, installmentId: string, payment: PaymentRecord) => {
    setLoans(items => items.map(loan => loan.id === loanId ? applyInstallmentPayment(loan, installmentId, payment) : loan));
    setModal(null);
    notify('Pagamento registrado. A parcela foi baixada.');
  };
  const rejectPayment = (loanId: string, installmentId: string) => { updateInstallment(loanId, installmentId, { status:'Pendente', receiptName:undefined }); notify('Comprovação recusada. A parcela voltou para pendente.'); };
  const markAsPaid = (loanId: string, installmentId: string, receipt?: string) => { updateInstallment(loanId, installmentId, { status:'Aguardando', receiptName:receipt }); notify('Pagamento enviado para confirmação.'); };
  const addRenegotiation = (loan: Loan) => { setLoans(items => [loan, ...items.map(item => item.id === loan.originalLoanId ? {...item,status:'Renegociado' as const} : item)]); setSelectedLoan(loan.id); setPage('loan-detail'); setModal(null); notify('Renegociação criada e vinculada ao contrato original.'); };
  const setClientActive = (id: string, active: boolean) => {
    setClients(items => items.map(item => item.id === id ? { ...item, active } : item));
    setAccounts(items => items.map(item => item.clientId === id ? { ...item, active } : item));
    setModal(null);
    notify(active ? 'Cliente reativado.' : 'Cliente inativado. O acesso dele foi bloqueado.');
  };

  if (!loggedIn) return <Login accounts={accounts} onLogin={(account) => {
    setRole(account.role);
    setSessionName(account.name);
    if (account.clientId) setClientSession(account.clientId);
    setPage(account.role === 'client' ? 'client-home' : 'home');
    setLoggedIn(true);
  }} />;

  const allowedNav = navItems.filter(item => item.roles.includes(role));
  const pendingCount = loans.flatMap(loan => loan.installments).filter(item => item.status === 'Aguardando' || item.status === 'Atrasado').length;
  const currentClient = clients.find(item => item.id === clientSession) || clients[0];
  const currentTitle = navItems.find(item => item.page === page)?.label || (page.includes('client') ? 'Cliente' : page.includes('loan') ? 'Empréstimo' : 'Lucas EMPRED');

  let view: ReactNode;
  switch (page) {
    case 'clients': view = <ClientsView clients={clients} loans={loans} onOpen={id => navigate('client-detail', id)} onNew={() => navigate('new-client')} onInactivate={id => setModal({ type:'inactivate-client', clientId:id })} onReactivate={id => setClientActive(id, true)} />; break;
    case 'new-client': view = <NewClientView onSave={addClient} onCancel={() => navigate('clients')} />; break;
    case 'client-detail': {
      const client = clients.find(item => item.id === selectedClient);
      view = client ? <ClientDetail client={client} loans={loans} onOpenLoan={id => navigate('loan-detail', id)} onNewLoan={() => { setPrefilledClient(client.id); navigate('new-loan'); }} onValidateReference={index => setClients(items => items.map(item => item.id === client.id ? {...item,references:item.references.map((ref,i) => i === index ? {...ref,validated:true} : ref)} : item))} onInactivate={() => setModal({ type:'inactivate-client', clientId:client.id })} onReactivate={() => setClientActive(client.id, true)} /> : <EmptyState title="Cliente não encontrado" text="Volte à lista e selecione outro cadastro." />;
      break;
    }
    case 'loans': view = <LoansView loans={loans} clients={clients} onOpen={id => navigate('loan-detail', id)} onNew={() => { setPrefilledClient(undefined); navigate('new-loan'); }} />; break;
    case 'new-loan': view = <NewLoanView clients={clients.filter(isClientActive)} loans={loans} settings={settings} prefilledClient={prefilledClient} onSave={createLoan} onCancel={() => navigate('loans')} />; break;
    case 'loan-detail': {
      const loan = loans.find(item => item.id === selectedLoan); const client = loan ? clients.find(item => item.id === loan.clientId) : undefined;
      view = loan && client ? <LoanDetail loan={loan} client={client} onContract={() => setModal({type:'contract',loanId:loan.id})} onRenegotiate={() => setModal({type:'renegotiate',loanId:loan.id})} onConfirm={(installmentId) => setModal({type:'confirm-payment',loanId:loan.id,installmentId})} onRegister={(installmentId) => setModal({type:'register-payment',loanId:loan.id,installmentId})} /> : <EmptyState title="Empréstimo não encontrado" text="Volte à carteira e selecione outro contrato." />;
      break;
    }
    case 'payments': view = <PaymentsView loans={loans} clients={clients} onConfirm={(loanId, installmentId) => setModal({type:'confirm-payment',loanId,installmentId})} onReject={(loanId, installmentId) => setModal({type:'reject-payment',loanId,installmentId})} onOpenLoan={id => navigate('loan-detail', id)} onRegister={(loanId, installmentId) => setModal({type:'register-payment',loanId,installmentId})} onSavePayment={registerPayment} />; break;
    case 'calendar': view = <CalendarView clients={clients} loans={loans} onOpenLoan={id => navigate('loan-detail', id)} onRegister={(loanId, installmentId) => setModal({type:'register-payment',loanId,installmentId})} />; break;
    case 'collections': view = <CollectionsView clients={clients} loans={loans} settings={settings} onOpenLoan={id => navigate('loan-detail', id)} onRegister={(loanId, installmentId) => setModal({type:'register-payment',loanId,installmentId})} notify={notify} />; break;
    case 'dashboard': view = <DashboardView clients={clients} loans={loans} />; break;
    case 'reports': view = <ReportsView clients={clients} loans={loans} notify={notify} />; break;
    case 'team': view = <TeamView team={team} setTeam={setTeam} onNew={() => setModal({type:'team'})} notify={notify} />; break;
    case 'settings': view = <SettingsView value={settings} onSave={value => { setSettings(value); notify('Configurações salvas.'); }} />; break;
    case 'client-home': view = <ClientHome client={currentClient} loans={loans} settings={settings} onPayment={(loanId, installmentId) => setModal({type:'payment',loanId,installmentId})} />; break;
    default: view = <AdminHome clients={clients} loans={loans} role={role} onNavigate={navigate} onNewLoan={() => navigate('new-loan')} />;
  }

  const modalLoan = modal?.loanId ? loans.find(item => item.id === modal.loanId) : undefined;
  const modalClient = modalLoan ? clients.find(item => item.id === modalLoan.clientId) : undefined;
  const modalInstallment = modalLoan && modal?.installmentId ? modalLoan.installments.find(item => item.id === modal.installmentId) : undefined;

  return <main className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <button className="brand" onClick={() => navigate(role === 'client' ? 'client-home' : 'home')}><span className="brand-mark">L</span><span>Lucas <b>EMPRED</b></span></button>
      <nav aria-label="Navegação principal">{allowedNav.map(item => <button key={item.page} className={`nav-item ${page === item.page || (item.page === 'clients' && page.includes('client')) || (item.page === 'loans' && page.includes('loan')) ? 'active' : ''}`} onClick={() => navigate(item.page)}><span className="nav-icon">{item.icon}</span>{item.label}{item.page === 'payments' && pendingCount > 0 && <em>{pendingCount}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><PersonPhoto name={sessionName} photo={role === 'client' ? currentClient.photo : undefined} /><span><b>{sessionName}</b><small>{role === 'client' ? 'Cliente' : role === 'staff' ? 'Equipe' : 'Administrador'}</small></span></div></div>
    </aside>
    {mobileMenu && <button className="menu-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}
    <section className="main-area">
      <header className="topbar">
        <div className="mobile-brand"><button className="hamburger" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">☰</button><span className="mini-mark">L</span></div>
        <div className="top-title"><p className="eyebrow">{new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toUpperCase()}</p><h1>{page === 'home' ? `Olá, ${sessionName.split(' ')[0]}` : currentTitle}</h1></div>
        <div className="top-actions">
          <button className="icon-button notification-button" onClick={() => setNotificationsOpen(value => !value)} aria-label="Notificações">●{pendingCount > 0 && <em>{pendingCount}</em>}</button>
          {role !== 'client' && <button className="primary-button desktop-action" onClick={() => navigate('new-loan')}>＋ Novo empréstimo</button>}
          <button className="top-avatar has-photo-btn" onClick={() => setAccountOpen(value => !value)}>{role === 'client' && currentClient.photo ? <img src={currentClient.photo} alt="" /> : initials(sessionName)}</button>
        </div>
        {notificationsOpen && <Notifications loans={loans} clients={clients} onClose={() => setNotificationsOpen(false)} onOpen={(loanId) => { setNotificationsOpen(false); navigate('loan-detail',loanId); }} />}
        {accountOpen && <div className="account-menu"><b>{sessionName}</b><small>{role === 'client' ? currentClient.cpf : role === 'staff' ? 'Acesso da equipe' : 'Acesso total do administrador'}</small><button onClick={() => { setAccountOpen(false); setLoggedIn(false); }}>Encerrar sessão</button></div>}
      </header>
      <div className="content">{view}</div>
    </section>
    <nav className="mobile-nav" aria-label="Navegação móvel">{allowedNav.filter(item => role === 'client' ? item.page === 'client-home' : ['home','calendar','collections','payments'].includes(item.page)).slice(0,4).map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}><span>{item.icon}</span>{item.label === 'Visão geral' ? 'Início' : item.label}</button>)}</nav>
    {toast && <Toast message={toast} onDone={() => setToast('')} />}
    {modal?.type === 'contract' && modalLoan && modalClient && <ContractModal loan={modalLoan} client={modalClient} settings={settings} onClose={() => setModal(null)} />}
    {modal?.type === 'renegotiate' && modalLoan && <RenegotiateModal loan={modalLoan} settings={settings} onSave={addRenegotiation} onClose={() => setModal(null)} />}
    {modal?.type === 'register-payment' && <RegisterPaymentModal clients={clients} loans={loans} presetLoanId={modal.loanId} presetInstallmentId={modal.installmentId} onSave={registerPayment} onClose={() => setModal(null)} />}
    {modal?.type === 'payment' && modalLoan && modalInstallment && <PaymentModal loan={modalLoan} installment={modalInstallment} settings={settings} onSave={(receipt) => { markAsPaid(modalLoan.id,modalInstallment.id,receipt); setModal(null); }} onClose={() => setModal(null)} />}
    {modal?.type === 'team' && <TeamModal onSave={member => { setTeam(items => [...items,member]); setModal(null); notify('Membro adicionado à equipe.'); }} onClose={() => setModal(null)} />}
    {modal?.type === 'confirm-payment' && modalLoan && modalInstallment && <ConfirmModal title="Confirmar recebimento?" description={`Confirme o recebimento de ${currency(payableAmount(modalLoan,modalInstallment))}. Esta ação dará baixa na parcela ${modalInstallment.number}.`} confirmLabel="Confirmar pagamento" onConfirm={() => confirmPayment(modalLoan.id,modalInstallment.id)} onClose={() => setModal(null)} />}
    {modal?.type === 'reject-payment' && modalLoan && modalInstallment && <ConfirmModal title="Recusar comprovação?" description="A parcela voltará para o status pendente e o cliente verá que precisa reenviar o comprovante." confirmLabel="Recusar envio" destructive onConfirm={() => rejectPayment(modalLoan.id,modalInstallment.id)} onClose={() => setModal(null)} />}
    {modal?.type === 'inactivate-client' && modal.clientId && <ConfirmModal title="Inativar este cliente?" description="O cadastro permanece salvo, mas o cliente não entra mais no sistema e não aparece para novos empréstimos. Você pode reativar depois." confirmLabel="Inativar cliente" destructive onConfirm={() => setClientActive(modal.clientId!, false)} onClose={() => setModal(null)} />}
  </main>;
}

function Login({ accounts, onLogin }: { accounts: AccessAccount[]; onLogin:(account:AccessAccount)=>void }) {
  const [role, setRole] = useState<Role>('admin');
  const [login, setLogin] = useState('admin@lucasempred.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const hint = role === 'admin'
    ? 'E-mail do administrador'
    : role === 'staff'
      ? 'E-mail da equipe'
      : 'CPF do cliente, só números ou com pontuação';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const key = digitsOnly(login) === login.replace(/\s/g, '') && role === 'client' ? digitsOnly(login) : login.trim().toLowerCase();
    const account = accounts.find(item => {
      if (item.role !== role) return false;
      const email = item.email.toLowerCase();
      return email === login.trim().toLowerCase() || digitsOnly(item.email) === digitsOnly(login) || email === key;
    });
    if (account && !account.active) {
      setError(role === 'client' ? 'Este cliente está inativo. Fale com o administrador.' : 'Este acesso está inativo.');
      return;
    }
    if (!account || account.password !== password) {
      setError(role === 'client' ? 'CPF ou PIN incorreto.' : 'E-mail ou senha incorretos.');
      return;
    }
    onLogin(account);
  };
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-logo"><span>L</span>Lucas <b>EMPRED</b></div>
        <div>
          <p>Gestão com foto, endereço e referências reais.</p>
          <h1>Cada cliente entra com identidade, localização e três contatos.</h1>
          <span>O administrador cadastra, a foto fica salva neste aparelho e as referências abrem WhatsApp ou ligação.</span>
        </div>
        <ul className="login-points">
          <li>Foto do cliente no cadastro</li>
          <li>Endereço + GPS se a pessoa permitir</li>
          <li>3 referências com WhatsApp ou telefone</li>
        </ul>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">ACESSO SEGURO</p>
          <h2>Entrar no sistema</h2>
          <p className="form-intro">Use o perfil correspondente. O administrador cadastra clientes e libera o PIN de acesso.</p>
          <div className="role-picker">{(['admin','staff','client'] as Role[]).map(item => (
            <button type="button" className={role === item ? 'active' : ''} onClick={() => { setRole(item); setError(''); setLogin(item === 'admin' ? 'admin@lucasempred.com.br' : item === 'staff' ? 'camila@lucasempred.com.br' : ''); setPassword(''); }} key={item}>
              {item === 'admin' ? 'Admin' : item === 'staff' ? 'Equipe' : 'Cliente'}
            </button>
          ))}</div>
          <label>{role === 'client' ? 'CPF' : 'E-mail'}<input required autoComplete="username" value={login} onChange={event => { setLogin(event.target.value); setError(''); }} placeholder={hint} /></label>
          <label>{role === 'client' ? 'PIN de 4 dígitos' : 'Senha'}
            <div className="password-field">
              <input required type={showPass ? 'text' : 'password'} value={password} onChange={event => { setPassword(event.target.value); setError(''); }} placeholder={role === 'client' ? 'Últimos 4 do telefone' : 'Sua senha'} autoComplete="current-password" />
              <button type="button" className="ghost-inline" onClick={() => setShowPass(value => !value)}>{showPass ? 'Ocultar' : 'Ver'}</button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary-button login-button">Entrar no sistema</button>
          <div className="access-card">
            <b>Acessos iniciais</b>
            <p>Admin: admin@lucasempred.com.br · Lucas2026</p>
            <p>Equipe:  camila@lucasempred.com.br · Equipe2026</p>
            <p>Cliente: CPF da ficha · PIN = 4 últimos do telefone</p>
          </div>
        </form>
      </section>
    </main>
  );
}

function AdminHome({ clients, loans, role, onNavigate, onNewLoan }: { clients:Client[]; loans:Loan[]; role:Role; onNavigate:(page:Page,id?:string)=>void; onNewLoan:()=>void }) {
  const all = loans.flatMap(loan => loan.installments.map(item => ({...item,loan})));
  const received = all.filter(item => item.status === 'Pago').reduce((sum,item) => sum + item.paidAmount,0);
  const active = loans.filter(loan => loan.status === 'Ativo').reduce((sum,loan) => sum + loanBalance(loan),0);
  const late = all.filter(item => item.status === 'Atrasado'); const awaiting = all.filter(item => item.status === 'Aguardando');
  const upcoming = all.filter(item => item.status !== 'Pago').sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,4);
  const chart = [52,66,48,78,65,88];
  return <>
    <section className="welcome-strip"><div><span className="live-dot" />Resumo do dia</div><p>Você tem <b>{upcoming.length} parcelas próximas</b> e <b>{awaiting.length} pagamento(s)</b> aguardando confirmação.</p><button onClick={() => onNavigate('payments')}>Registrar pagamento →</button></section>
    <PageHeader eyebrow="VISÃO GERAL" title={role === 'staff' ? 'Sua operação hoje' : 'Saúde da carteira'} subtitle="Os números mais importantes, atualizados com cada movimentação." action={<button className="primary-button mobile-only" onClick={onNewLoan}>＋ Novo</button>} />
    <section className="summary-grid"><SummaryCard label="Carteira ativa" value={currency(active)} detail={`${loans.filter(item=>item.status==='Ativo').length} contratos ativos`} tone="navy" icon="$"/><SummaryCard label="Total recebido" value={currency(received)} detail="Pagamentos confirmados" tone="green" icon="✓"/><SummaryCard label="Em atraso" value={currency(late.reduce((sum,item)=>sum+payableAmount(item.loan,item),0))} detail={`${late.length} parcelas`} tone="red" icon="!"/><SummaryCard label="A confirmar" value={currency(awaiting.reduce((sum,item)=>sum+item.amount,0))} detail={`${awaiting.length} comprovantes`} tone="gold" icon="↗"/></section>
    <div className="dashboard-grid"><section className="panel cashflow-panel"><div className="panel-head"><div><p className="eyebrow">DESEMPENHO</p><h3>Fluxo de caixa</h3></div><button className="text-button" onClick={() => onNavigate('dashboard')}>Análise completa</button></div><div className="chart-legend"><span><i className="planned"/>Previsto</span><span><i className="received"/>Realizado</span></div><div className="bar-chart">{chart.map((height,index)=><div className="bar-group" key={index}><div className="bars"><span style={{height:`${height}%`}}/><span style={{height:`${Math.max(22,height-(index%2?5:13))}%`}}/></div><small>{['Mar','Abr','Mai','Jun','Jul','Ago'][index]}</small></div>)}</div></section><section className="panel"><div className="panel-head"><div><p className="eyebrow">PRÓXIMOS</p><h3>Vencimentos</h3></div><button className="text-button" onClick={()=>onNavigate('loans')}>Ver todos</button></div><div className="payment-list">{upcoming.map(item=>{const client=clients.find(c=>c.id===item.loan.clientId)!;return <button className="payment-row" key={item.id} onClick={()=>onNavigate('loan-detail',item.loan.id)}><span className="avatar light">{initials(client.name)}</span><span><b>{client.name}</b><small>{shortDate(item.dueDate)} • Parcela {item.number}</small></span><span className="payment-value"><b>{currency(payableAmount(item.loan,item))}</b><StatusBadge status={item.status}/></span></button>})}</div></section></div>
    <section className="quick-actions"><button onClick={()=>onNavigate('payments')}><span>✓</span><b>Registrar pagamento</b><small>Baixa em dinheiro, PIX ou transferência</small></button><button onClick={()=>onNavigate('new-client')}><span>＋</span><b>Adicionar cliente</b><small>Cadastre dados e referências</small></button><button onClick={onNewLoan}><span>↗</span><b>Novo empréstimo</b><small>Semanal ou mensal</small></button><button onClick={()=>onNavigate('collections')}><span>◉</span><b>Central de cobranças</b><small>Fila e mensagens prontas</small></button></section>
  </>;
}

function ClientsView({ clients, loans, onOpen, onNew, onInactivate, onReactivate }: { clients:Client[]; loans:Loan[]; onOpen:(id:string)=>void; onNew:()=>void; onInactivate:(id:string)=>void; onReactivate:(id:string)=>void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const filtered = clients.filter(client => {
    const match = `${client.name} ${client.cpf} ${client.phone}`.toLowerCase().includes(search.toLowerCase());
    const active = isClientActive(client);
    if (status === 'ativos') return match && active;
    if (status === 'inativos') return match && !active;
    return match;
  });
  const activeCount = clients.filter(isClientActive).length;
  return <>
    <PageHeader eyebrow="CARTEIRA DE CLIENTES" title="Clientes" subtitle={`${activeCount} ativos • ${clients.length - activeCount} inativos`} action={<button className="primary-button" onClick={onNew}>＋ Adicionar cliente</button>} />
    <div className="toolbar">
      <label className="search-field"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, CPF ou telefone" /></label>
      <select value={status} onChange={event => setStatus(event.target.value as typeof status)} aria-label="Filtrar status">
        <option value="ativos">Ativos</option>
        <option value="inativos">Inativos</option>
        <option value="todos">Todos</option>
      </select>
    </div>
    <section className="table-card">
      <div className="data-table client-table">
        <div className="table-row table-head"><span>Cliente</span><span>Contato</span><span>Score</span><span>Em aberto</span><span>Situação</span></div>
        {filtered.map(client => {
          const risk = riskFor(client, loans);
          const openLoans = loans.filter(loan => loan.clientId === client.id && loan.status === 'Ativo');
          const active = isClientActive(client);
          return <div className={`table-row ${active ? '' : 'inactive-row'}`} key={client.id}>
            <button className="person-cell client-open" onClick={() => onOpen(client.id)}>
              <PersonPhoto name={client.name} photo={client.photo} />
              <span><b>{client.name}</b><small>{client.cpf}</small></span>
            </button>
            <span><b>{client.phone}</b><small>{client.neighborhood || client.city || client.address}</small></span>
            <RiskBadge level={risk.level} score={risk.score} />
            <span><b>{currency(openLoans.reduce((sum, loan) => sum + loanBalance(loan), 0))}</b><small>{openLoans.length} contrato(s)</small></span>
            <span className="row-actions">
              <StatusBadge status={active ? 'Ativo' : 'Inativo'} />
              {active
                ? <button type="button" className="outline-button small danger-outline" onClick={() => onInactivate(client.id)}>Inativar</button>
                : <button type="button" className="outline-button small" onClick={() => onReactivate(client.id)}>Reativar</button>}
            </span>
          </div>;
        })}
      </div>
      {!filtered.length && <EmptyState title="Nenhum cliente neste filtro" text="Adicione um cliente ou mude o filtro de ativos e inativos." action={<button className="primary-button" onClick={onNew}>Adicionar cliente</button>} />}
    </section>
  </>;
}

function emptyRef(): { name: string; phone: string; relation: string; hasWhatsapp: boolean } {
  return { name: '', phone: '', relation: '', hasWhatsapp: true };
}

function NewClientView({ onSave, onCancel }: { onSave:(client:Client)=>void; onCancel:()=>void }) {
  const [step, setStep] = useState(0);
  const [signature, setSignature] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [photo, setPhoto] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [form, setForm] = useState({
    name: '', cpf: '', rg: '', phone: '', income: 0,
    zip: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  });
  const [refs, setRefs] = useState([emptyRef(), emptyRef(), emptyRef()]);
  const update = (key: string, value: string | number) => setForm(state => ({ ...state, [key]: value }));
  const updateRef = (index: number, key: string, value: string | boolean) => setRefs(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item));

  const capturePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    try { setPhoto(await compressImage(file)); } finally { setPhotoBusy(false); }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeoStatus('denied'); return; }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, capturedAt: new Date().toISOString() };
      setLocation(next);
      setGeoStatus('granted');
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${next.lat}&longitude=${next.lng}&localityLanguage=pt`);
        const data = await response.json() as { postcode?: string; city?: string; locality?: string; principalSubdivisionCode?: string; principalSubdivision?: string; localityInfo?: { administrative?: { name: string; adminLevel: number }[] } };
        const neighborhood = data.localityInfo?.administrative?.find(item => item.adminLevel === 8)?.name || data.locality || '';
        setForm(state => ({
          ...state,
          zip: data.postcode || state.zip,
          city: data.city || data.locality || state.city,
          state: (data.principalSubdivisionCode || data.principalSubdivision || state.state).replace('BR-', ''),
          neighborhood: neighborhood || state.neighborhood,
        }));
      } catch { /* keep coordinates even if reverse geocode fails */ }
    }, () => setGeoStatus('denied'), { enableHighAccuracy: true, timeout: 14000 });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 1 && !photo) return;
    if (step < 3) { setStep(value => value + 1); return; }
    const address = formatAddress(form);
    const pin = digitsOnly(form.phone).slice(-4) || '2026';
    const references: Reference[] = refs.map(item => ({ ...item, validated: false }));
    onSave({
      id: uid('cli'), name: form.name, cpf: form.cpf, rg: form.rg, phone: form.phone, income: form.income,
      zip: form.zip, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood, city: form.city, state: form.state,
      address, photo, location, locationConsent: geoStatus === 'granted', accessPin: pin, references, documents, signature,
      createdAt: new Date().toISOString().slice(0, 10), active: true,
    });
  };

  return <>
    <PageHeader eyebrow="CADASTRO DO ADMINISTRADOR" title="Cadastrar cliente" subtitle="Comece pelo endereço. A foto do cliente e as três referências ficam salvas neste aparelho." />
    <Stepper steps={['Endereço e localização', 'Dados e foto', '3 referências', 'Documentos']} active={step} />
    <form className="form-card" onSubmit={submit}>
      {step === 0 && <>
        <div className="form-section-title"><span>1</span><div><h3>Endereço e localização</h3><p>O endereço é obrigatório. A localização no mapa só entra se a pessoa permitir.</p></div></div>
        <div className="location-banner">
          <div><b>Usar a localização do celular?</b><p>{geoStatus === 'granted' ? 'Localização salva e visível no mapa da ficha.' : geoStatus === 'denied' ? 'Permissão recusada. Continue só com o endereço digitado.' : 'Peça autorização e capture o ponto no mapa, se a pessoa aceitar.'}</p></div>
          <button type="button" className="outline-button" onClick={requestLocation} disabled={geoStatus === 'loading'}>{geoStatus === 'loading' ? 'Capturando…' : geoStatus === 'granted' ? 'Atualizar GPS' : 'Permitir localização'}</button>
        </div>
        {location && <iframe className="map-frame" title="Localização do cliente" src={mapEmbedUrl(location)} />}
        <div className="form-grid">
          <label>CEP<input required value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="00000-000" /></label>
          <label>UF<input required maxLength={2} value={form.state} onChange={e => update('state', e.target.value.toUpperCase())} placeholder="SP" /></label>
          <label className="span-2">Rua / avenida<input required value={form.street} onChange={e => update('street', e.target.value)} placeholder="Nome da via" /></label>
          <label>Número<input required value={form.number} onChange={e => update('number', e.target.value)} placeholder="Nº" /></label>
          <label>Complemento<input value={form.complement} onChange={e => update('complement', e.target.value)} placeholder="Apto, casa, bloco" /></label>
          <label>Bairro<input required value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} /></label>
          <label>Cidade<input required value={form.city} onChange={e => update('city', e.target.value)} /></label>
        </div>
      </>}
      {step === 1 && <>
        <div className="form-section-title"><span>2</span><div><h3>Foto e dados do cliente</h3><p>Anexe a foto da própria pessoa. Ela fica salva na ficha.</p></div></div>
        <div className="photo-capture">
          {photo ? <img src={photo} alt="Foto do cliente" /> : <span className="photo-placeholder">{photoBusy ? '…' : 'Foto'}</span>}
          <div>
            <b>Foto do cliente</b>
            <p>Use a câmera frontal ou escolha uma imagem nítida do rosto.</p>
            <div className="photo-actions">
              <label className="primary-button file-button">Tirar / escolher foto<input required={!photo} type="file" accept="image/*" capture="user" onChange={event => void capturePhoto(event.target.files?.[0])} /></label>
              {photo && <button type="button" className="secondary-button" onClick={() => setPhoto('')}>Trocar foto</button>}
            </div>
          </div>
        </div>
        <div className="form-grid">
          <label className="span-2">Nome completo<input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Nome sem abreviações" /></label>
          <label>CPF<input required value={form.cpf} onChange={e => update('cpf', e.target.value)} placeholder="000.000.000-00" /></label>
          <label>RG<input required value={form.rg} onChange={e => update('rg', e.target.value)} /></label>
          <label>Telefone / WhatsApp<input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(00) 00000-0000" /></label>
          <label>Renda mensal<MoneyInput value={form.income} onChange={value => update('income', value)} required /></label>
        </div>
      </>}
      {step === 2 && <>
        <div className="form-section-title"><span>3</span><div><h3>Três referências de contato</h3><p>Se tiver WhatsApp, o botão abre a conversa. Se não tiver, o botão liga.</p></div></div>
        <div className="reference-grid three">
          {refs.map((item, index) => (
            <div key={index}>
              <h4>Referência {index + 1}</h4>
              <label>Nome<input required value={item.name} onChange={e => updateRef(index, 'name', e.target.value)} /></label>
              <label>Parentesco / relação<input required value={item.relation} onChange={e => updateRef(index, 'relation', e.target.value)} placeholder="Mãe, amigo, trabalho" /></label>
              <label>Telefone<input required value={item.phone} onChange={e => updateRef(index, 'phone', e.target.value)} placeholder="(00) 00000-0000" /></label>
              <label className="toggle-line"><input type="checkbox" checked={item.hasWhatsapp} onChange={e => updateRef(index, 'hasWhatsapp', e.target.checked)} /><span>Tem WhatsApp. Se desmarcar, o contato vira ligação.</span></label>
            </div>
          ))}
        </div>
      </>}
      {step === 3 && <>
        <div className="form-section-title"><span>4</span><div><h3>Documentos e assinatura</h3><p>Comprovantes extras e a assinatura digital, se já puder coletar.</p></div></div>
        <label className="upload-zone"><input type="file" multiple accept="image/*,.pdf" onChange={event => setDocuments(Array.from(event.target.files || []).map(file => file.name))} /><span>↑</span><b>Toque para selecionar arquivos</b><small>Fotos ou PDF do comprovante e documento</small></label>
        {documents.length > 0 && <div className="file-list">{documents.map(file => <span key={file}>▤ {file}</span>)}</div>}
        <label className="standalone-label">Assinatura digital</label>
        <SignaturePad value={signature} onChange={setSignature} />
        <p className="save-note">Ao salvar, a foto, o endereço, o GPS (se permitido) e as 3 referências ficam gravados neste aparelho, inclusive no PIN de acesso do cliente (4 últimos dígitos do telefone).</p>
      </>}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={step ? () => setStep(value => value - 1) : onCancel}>{step ? 'Voltar' : 'Cancelar'}</button>
        <button className="primary-button">{step === 3 ? 'Salvar cliente' : 'Continuar →'}</button>
      </div>
    </form>
  </>;
}

function ClientDetail({ client, loans, onOpenLoan, onNewLoan, onValidateReference, onInactivate, onReactivate }: {client:Client;loans:Loan[];onOpenLoan:(id:string)=>void;onNewLoan:()=>void;onValidateReference:(index:number)=>void;onInactivate:()=>void;onReactivate:()=>void}) {
  const clientLoans=loans.filter(loan=>loan.clientId===client.id);const risk=riskFor(client,loans);const paid=clientLoans.flatMap(loan=>loan.installments).filter(item=>item.status==='Pago').length;const late=clientLoans.flatMap(loan=>loan.installments).filter(item=>item.status==='Atrasado').length;
  return <><PageHeader eyebrow="FICHA DO CLIENTE" title={client.name} subtitle={`${client.cpf} • ${isClientActive(client) ? 'Ativo' : 'Inativo'} • desde ${shortDate(client.createdAt)}`} action={<><button className={isClientActive(client) ? 'danger-button' : 'secondary-button'} onClick={isClientActive(client) ? onInactivate : onReactivate}>{isClientActive(client) ? 'Inativar cliente' : 'Reativar cliente'}</button>{isClientActive(client) && <button className="primary-button" onClick={onNewLoan}>＋ Novo empréstimo</button>}</>}/><div className="detail-grid"><section className="profile-card panel"><div className="client-hero"><PersonPhoto name={client.name} photo={client.photo} size="lg" /><div><h3>{client.name}</h3><p>{client.phone}</p><div className="hero-actions"><a className="wa-button" href={whatsappHref(client.phone)} target="_blank" rel="noreferrer">WhatsApp do cliente</a><a className="call-button" href={callHref(client.phone)}>Ligar</a></div></div></div><dl><div><dt>RG</dt><dd>{client.rg}</dd></div><div><dt>Renda declarada</dt><dd>{currency(client.income)}</dd></div><div className="span-2"><dt>Endereço</dt><dd>{client.address}</dd></div><div className="span-2"><dt>Acesso do cliente</dt><dd>CPF · PIN {client.accessPin}</dd></div></dl>{client.location ? <div className="map-block"><iframe title="Localização" src={mapEmbedUrl(client.location)} /><a href={mapOpenUrl(client.location)} target="_blank" rel="noreferrer">Abrir mapa</a></div> : <p className="muted-note">{client.locationConsent ? 'Localização não capturada.' : 'A pessoa não permitiu a localização. O endereço digitado permanece salvo.'}</p>}</section><section className="risk-card panel"><div className="risk-score"><div className={`score-ring ${risk.level==='Baixo risco'?'low':risk.level==='Médio risco'?'medium':'high'}`} style={{'--score':`${risk.score*3.6}deg`} as React.CSSProperties}><span>{risk.score}<small>/100</small></span></div><div><p className="eyebrow">ANÁLISE AUTOMÁTICA</p><h3>{risk.level}</h3><p>{risk.level==='Baixo risco'?'Perfil recomendado para análise de crédito.':'Revise os fatores antes de aprovar.'}</p></div></div><ul>{risk.reasons.slice(0,3).map(reason=><li key={reason}>✓ {reason}</li>)}</ul></section></div><section className="summary-grid three"><SummaryCard label="Saldo em aberto" value={currency(clientLoans.reduce((sum,loan)=>sum+loanBalance(loan),0))} detail={`${clientLoans.filter(item=>item.status==='Ativo').length} contratos ativos`} /><SummaryCard label="Parcelas pagas" value={String(paid)} detail="Histórico confirmado" tone="green"/><SummaryCard label="Parcelas atrasadas" value={String(late)} detail={late?'Requer atenção':'Tudo em dia'} tone={late?'red':'green'}/></section><div className="detail-grid"><section className="panel"><div className="panel-head"><h3>Empréstimos</h3></div>{clientLoans.length?<div className="compact-list">{clientLoans.map(loan=><button key={loan.id} onClick={()=>onOpenLoan(loan.id)}><span><b>{loan.contractNumber}</b><small>{currency(loan.principal)} • {loan.weeks} semanas</small></span><StatusBadge status={loan.status}/><strong>{currency(loanBalance(loan))}</strong><i>›</i></button>)}</div>:<EmptyState title="Sem empréstimos" text="Este cliente ainda não possui contratos."/>}</section><section className="panel"><div className="panel-head"><h3>Referências pessoais</h3><span className="subtle-count">{client.references.filter(ref=>ref.validated).length}/{client.references.length} validadas</span></div><div className="reference-list">{client.references.map((ref,index)=><div key={`${ref.name}-${index}`}><span className="avatar light">{initials(ref.name)}</span><span><b>{ref.name}</b><small>{ref.relation} • {ref.phone}</small></span><a className={ref.hasWhatsapp ? 'wa-button compact' : 'call-button compact'} href={referenceHref(ref)} target={ref.hasWhatsapp ? '_blank' : undefined} rel="noreferrer">{ref.hasWhatsapp ? 'WhatsApp' : 'Ligar'}</a>{ref.validated?<span className="verified">✓ Validada</span>:<button className="outline-button small" onClick={()=>onValidateReference(index)}>Validar</button>}</div>)}</div><div className="document-list"><h4>Documentos</h4>{client.documents.length?client.documents.map(file=><button key={file}>▤ {file}<span>Visualizar</span></button>):<p>Nenhum documento anexado.</p>}</div></section></div></>;
}

function LoansView({ loans, clients, onOpen, onNew }: {loans:Loan[];clients:Client[];onOpen:(id:string)=>void;onNew:()=>void}) {
  const [search,setSearch]=useState('');const [filter,setFilter]=useState('Todos');const list=loans.filter(loan=>{const client=clients.find(c=>c.id===loan.clientId);return `${client?.name} ${loan.contractNumber}`.toLowerCase().includes(search.toLowerCase())&&(filter==='Todos'||loan.status===filter)});
  return <><PageHeader eyebrow="CARTEIRA" title="Empréstimos" subtitle={`${loans.filter(item=>item.status==='Ativo').length} contratos ativos`} action={<button className="primary-button" onClick={onNew}>＋ Novo empréstimo</button>}/><section className="summary-grid three"><SummaryCard label="Capital emprestado" value={currency(loans.reduce((sum,loan)=>sum+loan.principal,0))}/><SummaryCard label="Saldo da carteira" value={currency(loans.reduce((sum,loan)=>sum+loanBalance(loan),0))} tone="gold"/><SummaryCard label="Juros contratados" value={currency(loans.reduce((sum,loan)=>sum+loan.installments.reduce((s,i)=>s+i.interest,0),0))} tone="green"/></section><div className="toolbar"><label className="search-field"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente ou contrato"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option>Todos</option><option>Ativo</option><option>Quitado</option><option>Renegociado</option></select></div><section className="loan-card-grid">{list.map(loan=>{const client=clients.find(c=>c.id===loan.clientId)!;const paid=loan.installments.filter(i=>i.status==='Pago').length;return <button className="loan-card" key={loan.id} onClick={()=>onOpen(loan.id)}><div className="loan-card-top"><PersonPhoto name={client.name} photo={client.photo} /><span><b>{client.name}</b><small>{loan.contractNumber}</small></span><StatusBadge status={loan.status}/></div><div className="loan-values"><span><small>Emprestado</small><b>{currency(loan.principal)}</b></span><span><small>Saldo</small><b>{currency(loanBalance(loan))}</b></span></div><div className="progress"><span style={{width:`${paid/loan.installments.length*100}%`}}/></div><div className="loan-card-foot"><span>{paid} de {loan.installments.length} · {frequencyLabel(loanFrequency(loan))}</span><b>{loan.rate}% juros</b></div></button>})}</section>{!list.length&&<EmptyState title="Nenhum empréstimo" text="Ajuste os filtros ou crie um novo contrato." action={<button className="primary-button" onClick={onNew}>Novo empréstimo</button>}/>}</>;
}

function LoanDetail({ loan, client, onContract, onRenegotiate, onConfirm, onRegister }: {loan:Loan;client:Client;onContract:()=>void;onRenegotiate:()=>void;onConfirm:(id:string)=>void;onRegister:(id:string)=>void}) {
  const dual = isDualScheduleLoan(loan);
  const summary = dual ? dualScheduleSummary(loan) : null;
  const paid = loan.installments.filter(item => item.status === 'Pago');
  const progress = paid.length / loan.installments.length * 100;
  const late = loan.installments.filter(item => item.status === 'Atrasado');
  const subtitle = dual
    ? `Início ${shortDate(loan.startDate || loan.createdAt)} • Encerramento ${shortDate(summary?.endDate || loan.endDate || loan.createdAt)} • Mensal dia ${loan.monthlyDueDay} + ${weekdayLabel(loan.weeklyWeekday)}`
    : `Criado em ${shortDate(loan.createdAt)} • ${frequencyLabel(loanFrequency(loan))} • ${loan.interestMode === 'total' ? 'Juros fixos sobre o total' : 'Juros sobre saldo devedor'}`;
  return <>
    <PageHeader eyebrow={loan.contractNumber} title={`Empréstimo de ${client.name}`} subtitle={subtitle} action={<><button className="secondary-button" onClick={onContract}>▤ Contrato</button>{loan.status === 'Ativo' && <button className="primary-button" onClick={onRenegotiate}>Renegociar</button>}</>} />
    <section className="loan-overview">
      <div className="loan-main-card">
        <p className="eyebrow">SALDO DEVEDOR</p>
        <h3>{currency(loanBalance(loan))}</h3>
        <div className="progress large"><span style={{ width: `${progress}%` }} /></div>
        <p>{paid.length} de {loan.installments.length} pagamentos feitos • {Math.round(progress)}% concluído</p>
      </div>
      <div className="loan-stat"><small>Valor emprestado</small><b>{currency(loan.principal)}</b></div>
      <div className="loan-stat"><small>Total previsto</small><b>{currency(loan.installments.reduce((sum, item) => sum + item.amount, 0))}</b></div>
      <div className="loan-stat"><small>{dual ? 'Prazo' : 'Taxa e prazo'}</small><b>{dual ? periodLabel(loan) : `${loan.rate}% • ${periodLabel(loan)}`}</b></div>
      <div className="loan-stat"><small>Situação</small><StatusBadge status={loan.status} /></div>
    </section>
    {summary && (
      <div className="loan-live-summary dual">
        <span><small>Parcela mensal</small><b>{currency(summary.monthlyAmount)}</b><em>Todo dia {loan.monthlyDueDay}</em></span>
        <span><small>Pagamento semanal</small><b>{currency(loan.weeklyAmount || 0)}</b><em>{weekdayLabel(loan.weeklyWeekday)}</em></span>
        <span><small>Semanais</small><b>{summary.weeklyCount}</b><em>Datas reais do calendário</em></span>
        <span><small>Total das mensais</small><b>{currency(summary.monthlyTotal)}</b><em>Valor emprestado</em></span>
        <span><small>Total dos semanais</small><b>{currency(summary.weeklyTotal)}</b><em>{summary.weeklyCount} pagamentos</em></span>
        <span><small>Já pago</small><b>{currency(summary.paidTotal)}</b><em>{paid.length} quitados</em></span>
        <span><small>Pendente</small><b>{currency(summary.pendingTotal)}</b><em>{loan.installments.length - paid.length} em aberto</em></span>
        <span className="highlight"><small>Próximo vencimento</small><b>{summary.nextDue ? shortDate(summary.nextDue.dueDate) : '—'}</b><em>{summary.nextDue ? `${currency(summary.nextDue.amount)} · ${summary.nextDue.kind === 'monthly' ? 'Mensal' : 'Semanal'}` : 'Nada em aberto'}</em></span>
      </div>
    )}
    {late.length > 0 && <div className="alert-banner danger"><span>!</span><div><b>{late.length} pagamento(s) em atraso</b><p>{summary ? `Total atrasado: ${currency(summary.lateTotal)}. ` : ''}O saldo já considera multa até hoje.</p></div></div>}
    {loan.originalLoanId && <div className="alert-banner info"><span>↻</span><div><b>Contrato renegociado</b><p>Este contrato substitui o saldo do contrato {loan.originalLoanId} e mantém a rastreabilidade.</p></div></div>}
    {dual
      ? <PaymentScheduleTable installments={loan.installments} loan={loan} title="Tabela de pagamentos" onRegister={onRegister} onConfirm={onConfirm} />
      : <section className="table-card"><div className="section-title"><div><p className="eyebrow">CRONOGRAMA</p><h3>Tabela de parcelas</h3></div><span>{loan.installments.length} semanas</span></div><div className="table-scroll"><div className="installment-table detail"><div className="table-row table-head"><span>Parcela</span><span>Vencimento</span><span>Valor</span><span>Encargos</span><span>Status</span><span></span></div>{loan.installments.map(item => { const due = payableAmount(loan, item); return <div className="table-row" key={item.id}><span><b>#{String(item.number).padStart(2, '0')}</b></span><span><b>{shortDate(item.dueDate)}</b>{daysLate(item.dueDate) > 0 && item.status !== 'Pago' && <small>{daysLate(item.dueDate)} dias de atraso</small>}</span><span><b>{currency(item.amount)}</b><small>Principal {currency(item.principal)}</small></span><span>{due > item.amount ? <b className="red-text">+ {currency(due - item.amount)}</b> : '—'}</span><StatusBadge status={item.status} /><span>{item.status !== 'Pago' && <button className="primary-button small" onClick={() => onRegister(item.id)}>Registrar</button>}{item.status === 'Aguardando' && <button className="outline-button small" onClick={() => onConfirm(item.id)}>Confirmar</button>}{item.receiptName && <small className="receipt">▤ {item.receiptName}</small>}</span></div>; })}</div></div></section>}
  </>;
}

function DashboardView({ clients, loans }: {clients:Client[];loans:Loan[]}) {
  const [period,setPeriod]=useState('6 meses');const rows=loans.flatMap(loan=>loan.installments.map(item=>({loan,item})));const received=rows.filter(r=>r.item.status==='Pago').reduce((s,r)=>s+r.item.paidAmount,0);const principalPaid=rows.filter(r=>r.item.status==='Pago').reduce((s,r)=>s+r.item.principal,0);const late=rows.filter(r=>r.item.status==='Atrasado');const pending=rows.filter(r=>r.item.status!=='Pago');const defaultRate=pending.length?late.length/pending.length*100:0;const ranking=clients.map(client=>{const its=rows.filter(r=>r.loan.clientId===client.id);const paid=its.filter(r=>r.item.status==='Pago').length;const delayed=its.filter(r=>r.item.status==='Atrasado').length;return {client,score:paid*8-delayed*15,paid,delayed}}).sort((a,b)=>b.score-a.score);
  const forecast=[{m:'Mar',p:8300,r:6900},{m:'Abr',p:9100,r:8750},{m:'Mai',p:7800,r:7200},{m:'Jun',p:10200,r:9800},{m:'Jul',p:11400,r:10100},{m:'Ago',p:12600,r:9200}];const max=Math.max(...forecast.map(i=>i.p));
  return <><PageHeader eyebrow="INTELIGÊNCIA FINANCEIRA" title="Dashboard" subtitle="Acompanhe rentabilidade, caixa e risco da carteira." action={<select value={period} onChange={e=>setPeriod(e.target.value)}><option>Últimos 30 dias</option><option>6 meses</option><option>Este ano</option></select>}/><section className="summary-grid"><SummaryCard label="Carteira ativa" value={currency(loans.reduce((s,l)=>s+loanBalance(l),0))} detail="Capital e juros em aberto"/><SummaryCard label="Receita de juros" value={currency(received-principalPaid)} detail="Em pagamentos confirmados" tone="green"/><SummaryCard label="Inadimplência" value={`${defaultRate.toFixed(1).replace('.',',')}%`} detail={`${late.length} parcelas atrasadas`} tone={defaultRate>10?'red':'gold'}/><SummaryCard label="Ticket médio" value={currency(loans.reduce((s,l)=>s+l.principal,0)/Math.max(1,loans.length))} detail="Por empréstimo" tone="gold"/></section><div className="analytics-grid"><section className="panel wide-chart"><div className="panel-head"><div><p className="eyebrow">CAIXA • {period.toUpperCase()}</p><h3>Previsto x realizado</h3></div><div className="chart-legend"><span><i className="planned"/>Previsto</span><span><i className="received"/>Realizado</span></div></div><div className="value-chart">{forecast.map(item=><div key={item.m}><div className="value-bars"><span style={{height:`${item.p/max*100}%`}} title={currency(item.p)}/><span style={{height:`${item.r/max*100}%`}} title={currency(item.r)}/></div><small>{item.m}</small></div>)}</div></section><section className="panel donut-panel"><div><p className="eyebrow">COMPOSIÇÃO</p><h3>Status das parcelas</h3></div><div className="donut" style={{background:`conic-gradient(#24734b 0 ${rows.filter(r=>r.item.status==='Pago').length/Math.max(1,rows.length)*100}%,#c7a135 0 ${(rows.filter(r=>r.item.status==='Pago').length+rows.filter(r=>r.item.status==='Pendente').length)/Math.max(1,rows.length)*100}%,#b74843 0)`}}><span><b>{rows.length}</b><small>parcelas</small></span></div><div className="donut-legend"><span><i className="green"/>Pagas <b>{rows.filter(r=>r.item.status==='Pago').length}</b></span><span><i className="gold"/>Pendentes <b>{rows.filter(r=>r.item.status==='Pendente').length}</b></span><span><i className="red"/>Atrasadas <b>{late.length}</b></span></div></section></div><div className="detail-grid"><section className="panel"><div className="panel-head"><h3>Ranking de clientes</h3><small>Melhores pagadores</small></div><div className="ranking-list">{ranking.map((entry,index)=><div key={entry.client.id}><em>{index+1}</em><span className="avatar light">{initials(entry.client.name)}</span><span><b>{entry.client.name}</b><small>{entry.paid} pagas • {entry.delayed} atrasadas</small></span><RiskBadge level={riskFor(entry.client,loans).level} compact/></div>)}</div></section><section className="panel"><div className="panel-head"><h3>Valores em atraso</h3><small>{late.length} ocorrências</small></div><div className="late-list">{late.slice(0,5).map(({loan,item})=>{const client=clients.find(c=>c.id===loan.clientId)!;return <div key={item.id}><span><b>{client.name}</b><small>{daysLate(item.dueDate)} dias • Parcela {item.number}</small></span><b>{currency(payableAmount(loan,item))}</b></div>})}</div></section></div></>;
}

function TeamView({team,setTeam,onNew,notify}:{team:TeamMember[];setTeam:React.Dispatch<React.SetStateAction<TeamMember[]>>;onNew:()=>void;notify:(message:string)=>void}) {
  const permissions=['Cadastrar clientes','Criar empréstimos','Registrar pagamentos','Acessar relatórios'];
  const togglePermission=(id:string,permission:string)=>setTeam(items=>items.map(member=>member.id===id?{...member,permissions:member.permissions.includes(permission)?member.permissions.filter(p=>p!==permission):[...member.permissions,permission]}:member));
  return <><PageHeader eyebrow="ACESSO E SEGURANÇA" title="Equipe" subtitle="Controle quem pode acessar cada parte da operação." action={<button className="primary-button" onClick={onNew}>＋ Adicionar membro</button>}/><div className="alert-banner info"><span>i</span><div><b>Permissões por função</b><p>Membros da equipe não veem o dashboard financeiro geral sem permissão explícita.</p></div></div><section className="team-list">{team.map(member=><article key={member.id}><div className="team-head"><span className="avatar">{initials(member.name)}</span><span><b>{member.name}</b><small>{member.email}</small></span><label className="switch"><input type="checkbox" checked={member.active} onChange={()=>{setTeam(items=>items.map(item=>item.id===member.id?{...item,active:!item.active}:item));notify('Acesso da equipe atualizado.')}}/><span/></label></div><div className="permission-grid">{permissions.map(permission=><label key={permission}><input type="checkbox" checked={member.permissions.includes(permission)} onChange={()=>togglePermission(member.id,permission)}/><span>✓</span>{permission}</label>)}</div></article>)}</section></>;
}

function SettingsView({value,onSave}:{value:AppSettings;onSave:(value:AppSettings)=>void}) {
  const [form,setForm]=useState({...value, defaultFrequency: value.defaultFrequency || 'weekly'});
  const update=<K extends keyof AppSettings>(key:K,newValue:AppSettings[K])=>setForm(state=>({...state,[key]:newValue}));
  return <><PageHeader eyebrow="PREFERÊNCIAS" title="Configurações" subtitle="Dados da empresa, recebimento e regras padrão."/><form className="settings-layout" onSubmit={event=>{event.preventDefault();onSave(form)}}><section className="form-card"><div className="form-section-title"><span>1</span><div><h3>Dados da empresa</h3><p>Informações exibidas nos contratos e no acesso do cliente.</p></div></div><div className="form-grid"><label>Nome da empresa<input value={form.companyName} onChange={e=>update('companyName',e.target.value)}/></label><label>CPF/CNPJ<input value={form.document} onChange={e=>update('document',e.target.value)}/></label><label>Telefone<input value={form.phone} onChange={e=>update('phone',e.target.value)}/></label><label>Chave PIX<input value={form.pixKey} onChange={e=>update('pixKey',e.target.value)}/></label></div></section><section className="form-card"><div className="form-section-title"><span>2</span><div><h3>Regras financeiras padrão</h3><p>Valores sugeridos ao criar um empréstimo.</p></div></div><div className="form-grid"><FieldBlock title="Juros padrão (%)" hint="Sugestão inicial para novos contratos."><input type="number" step=".01" value={form.defaultRate} onChange={e=>update('defaultRate',Number(e.target.value))}/></FieldBlock><FieldBlock title="Prazo padrão" hint="Quantidade inicial de parcelas."><input type="number" value={form.defaultWeeks} onChange={e=>update('defaultWeeks',Number(e.target.value))}/></FieldBlock><FieldBlock title="Periodicidade padrão" hint="Semanal ou mensal, por padrão."><select value={form.defaultFrequency || 'weekly'} onChange={e=>update('defaultFrequency',e.target.value as PayFrequency)}><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></FieldBlock><FieldBlock title="Tipo de multa" hint="Como cobrar o atraso."><select value={form.feeType} onChange={e=>update('feeType',e.target.value as 'fixed'|'percent')}><option value="percent">Percentual sobre a parcela</option><option value="fixed">Valor fixo em reais</option></select></FieldBlock><FieldBlock title={form.feeType==='percent'?'Valor da multa (%)':'Valor da multa (R$)'} hint={form.feeType==='percent'?'Percentual sobre a parcela atrasada.':'Valor fixo em cada parcela atrasada.'}><input type="number" step=".01" value={form.feeValue} onChange={e=>update('feeValue',Number(e.target.value))}/></FieldBlock><FieldBlock title="Mora ao dia (%)" hint="Acréscimo por dia de atraso."><input type="number" step=".001" value={form.lateInterest} onChange={e=>update('lateInterest',Number(e.target.value))}/></FieldBlock><FieldBlock className="span-2" title="Lembrete antes do vencimento (dias)" hint="Aviso antes do vencimento."><input type="number" value={form.reminderDays} onChange={e=>update('reminderDays',Number(e.target.value))}/></FieldBlock></div></section><div className="settings-save"><p>As alterações valem para novos contratos. Os contratos atuais mantêm suas próprias regras.</p><button className="primary-button">Salvar configurações</button></div></form></>;
}

function ClientHome({client,loans,settings,onPayment}:{client:Client;loans:Loan[];settings:AppSettings;onPayment:(loanId:string,id:string)=>void}) {
  const clientLoans=loans.filter(loan=>loan.clientId===client.id&&loan.status==='Ativo');const loan=clientLoans[0];if(!loan)return <><PageHeader eyebrow="ÁREA DO CLIENTE" title={`Olá, ${client.name.split(' ')[0]}`} subtitle="Acompanhe seus contratos e pagamentos."/><EmptyState title="Nenhum empréstimo ativo" text="Você não possui cobranças em aberto neste momento."/></>;
  const next=loan.installments.find(item=>item.status!=='Pago');const paid=loan.installments.filter(item=>item.status==='Pago').length;
  return <><section className="client-welcome"><div><p className="eyebrow">ÁREA DO CLIENTE</p><h2>Olá, {client.name.split(' ')[0]}.</h2><p>Acompanhe seu saldo e mantenha seus pagamentos em dia.</p></div><StatusBadge status={loan.status}/></section><section className="client-balance"><div><small>Seu saldo devedor</small><strong>{currency(loanBalance(loan))}</strong><p>Contrato {loan.contractNumber}</p></div><div className="client-progress"><span><b>{paid}</b><small>pagas</small></span><div><div className="progress large"><span style={{width:`${paid/loan.installments.length*100}%`}}/></div><p>{paid} de {loan.installments.length} parcelas concluídas</p></div></div></section>{next&&<section className={`next-payment ${next.status==='Atrasado'?'late':''}`}><div className="next-date"><span>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit'}).format(new Date(`${next.dueDate}T12:00:00`))}</span><b>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(`${next.dueDate}T12:00:00`)).replace('.','').toUpperCase()}</b></div><div><p className="eyebrow">{next.status==='Atrasado'?'PAGAMENTO EM ATRASO':'PRÓXIMA PARCELA'}</p><h3>{currency(payableAmount(loan,next))}</h3><p>Parcela {next.number} de {loan.installments.length} • Vence em {shortDate(next.dueDate)}</p></div><div><StatusBadge status={next.status}/>{next.status!=='Aguardando'&&<button className="primary-button" onClick={()=>onPayment(loan.id,next.id)}>Pagar com PIX</button>}</div></section>}<div className="client-layout"><section className="panel"><div className="panel-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Minhas parcelas</h3></div></div><div className="client-installments">{loan.installments.map(item=><div key={item.id}><span className={`installment-number ${item.status.toLowerCase()}`}>{item.status==='Pago'?'✓':item.number}</span><span><b>Parcela {item.number}</b><small>{shortDate(item.dueDate)}</small></span><b>{currency(payableAmount(loan,item))}</b><StatusBadge status={item.status}/></div>)}</div></section><aside className="panel support-card"><span>?</span><h3>Precisa de ajuda?</h3><p>Fale com {settings.companyName} sobre seu contrato ou pagamento.</p><button className="outline-button">{settings.phone}</button><button className="text-button">Baixar contrato</button></aside></div></>;
}

function ContractModal({loan,client,settings,onClose}:{loan:Loan;client:Client;settings:AppSettings;onClose:()=>void}) {
  return <Modal title="Contrato digital" onClose={onClose} wide><div className="contract-toolbar"><span>Documento {loan.contractNumber}</span><button className="secondary-button" onClick={()=>window.print()}>Imprimir / salvar PDF</button></div><article className="contract-print"><header><div className="contract-logo"><span>L</span>Lucas <b>EMPRED</b></div><div><b>{loan.contractNumber}</b><small>Gerado em {shortDate(loan.createdAt)}</small></div></header><h1>CONTRATO PARTICULAR DE EMPRÉSTIMO</h1><p>Pelo presente instrumento, de um lado <b>{settings.companyName}</b>, inscrito sob {settings.document}, doravante CREDOR, e de outro <b>{client.name}</b>, CPF {client.cpf}, RG {client.rg}, residente em {client.address}, doravante DEVEDOR, acordam as condições abaixo.</p><h2>1. DO OBJETO E CONDIÇÕES</h2><p>O CREDOR entrega ao DEVEDOR a quantia de <b>{currency(loan.principal)}</b>. {isDualScheduleLoan(loan)
    ? <>O valor emprestado será restituído em <b>{loan.termMonths} parcelas mensais de {currency(loan.installments.find(item => item.kind === 'monthly')?.amount || 0)}</b>, no dia <b>{loan.monthlyDueDay}</b> de cada mês, além de um pagamento semanal fixo de <b>{currency(loan.weeklyAmount || 0)}</b> toda <b>{weekdayLabel(loan.weeklyWeekday)}</b>, pelas datas reais do calendário, até <b>{shortDate(loan.endDate || loan.firstDueDate)}</b>.</>
    : <>O valor será restituído em <b>{loan.weeks} parcelas {loanFrequency(loan)==='monthly'?'mensais':'semanais'}</b>, com taxa contratual de <b>{loan.rate}%</b>, na modalidade {loan.interestMode==='total'?'fixa sobre o valor total':'sobre o saldo devedor'}.</>}</p><div className="contract-values"><span><small>Principal</small><b>{currency(loan.principal)}</b></span><span><small>Total previsto</small><b>{currency(loan.installments.reduce((s,i)=>s+i.amount,0))}</b></span><span><small>1º vencimento</small><b>{shortDate(loan.firstDueDate)}</b></span></div><h2>2. DO ATRASO</h2><p>Em caso de atraso, incidirá multa {loan.feeType==='fixed'?`fixa de ${currency(loan.feeValue)}`:`de ${loan.feeValue}%`} por parcela, além de juros de mora de {loan.lateInterest}% ao dia.</p><h2>3. DOS PAGAMENTOS</h2><p>Os pagamentos serão realizados por PIX para a chave {settings.pixKey}, sujeitos à confirmação do CREDOR. O histórico mantido no sistema integra este contrato.</p><h2>4. DA CIÊNCIA</h2><p>As partes declaram compreender e aceitar as condições financeiras, o cronograma e as regras de renegociação vinculada ao saldo devedor.</p><div className="contract-signatures"><div>{client.signature?<img src={client.signature} alt="Assinatura do cliente"/>:<span/>}<b>{client.name}</b><small>Devedor</small></div><div><span className="admin-signature">Lucas EMPRED</span><b>{settings.companyName}</b><small>Credor</small></div></div></article></Modal>;
}

function RenegotiateModal({loan,settings,onSave,onClose}:{loan:Loan;settings:AppSettings;onSave:(loan:Loan)=>void;onClose:()=>void}) {
  const balance=loanBalance(loan);
  const [interest,setInterest]=useState(()=>roundCents(balance*((settings.defaultRate||0)/100)));
  const [weeks,setWeeks]=useState(settings.defaultWeeks);
  const [firstDue,setFirstDue]=useState(()=>{const d=new Date();d.setDate(d.getDate()+7);return d.toISOString().slice(0,10)});
  const rate=rateFromInterest(balance,interest);
  const preview=generateInstallments({principal:balance,rate,interestAmount:interest,interestMode:'total',weeks,firstDueDate:firstDue,frequency:loanFrequency(loan)});
  return <Modal title="Renegociar empréstimo" onClose={onClose}><form onSubmit={event=>{event.preventDefault();const id=uid('ren');onSave({id,clientId:loan.clientId,contractNumber:`LE-R-${id.slice(-4).toUpperCase()}`,principal:balance,rate,interestMode:'total',weeks,firstDueDate:firstDue,frequency:loanFrequency(loan),feeType:loan.feeType,feeValue:loan.feeValue,lateInterest:loan.lateInterest,status:'Ativo',installments:preview,createdAt:new Date().toISOString().slice(0,10),originalLoanId:loan.id})}}><div className="renegotiation-balance"><small>Saldo consolidado com encargos</small><b>{currency(balance)}</b><span>Este saldo vira o novo principal. Juros em reais, parcelas iguais.</span></div><div className="form-grid"><FieldBlock title="Juros (R$)" hint={`Juros em reais. Equivale a ${formatRate(rate)}%.`}><div className="interest-pair"><MoneyInput value={interest} onChange={value=>setInterest(Math.max(0,roundCents(value)))}/><div className="rate-badge"><small>Equivale a</small><b>{formatRate(rate)}%</b></div></div></FieldBlock><FieldBlock title={`Novo prazo (${loanFrequency(loan)==='monthly'?'meses':'semanas'})`} hint="Quantas parcelas iguais."><input type="number" min="1" value={weeks} onChange={e=>setWeeks(Number(e.target.value)||1)}/></FieldBlock><FieldBlock className="span-2" title="Primeiro vencimento" hint="Primeira parcela do novo acordo."><input type="date" value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></FieldBlock></div><div className="simulation-mini"><span><small>Nova parcela (igual)</small><b>{currency(preview[0]?.amount||0)}</b></span><span><small>Novo total</small><b>{currency(preview.reduce((s,i)=>s+i.amount,0))}</b></span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button">Criar renegociação</button></div></form></Modal>;
}

function PaymentModal({loan,installment,settings,onSave,onClose}:{loan:Loan;installment:Installment;settings:AppSettings;onSave:(receipt?:string)=>void;onClose:()=>void}) {
  const [receipt,setReceipt]=useState('');
  return <Modal title="Pagar parcela com PIX" onClose={onClose}><div className="pix-payment"><div className="fake-qr" aria-label="QR code PIX ilustrativo"><span/></div><div><p className="eyebrow">VALOR ATUALIZADO</p><h3>{currency(payableAmount(loan,installment))}</h3><p>Parcela {installment.number} • {shortDate(installment.dueDate)}</p></div></div><label className="copy-field">Chave PIX<div><input readOnly value={settings.pixKey}/><button type="button" onClick={()=>navigator.clipboard?.writeText(settings.pixKey)}>Copiar</button></div></label><label className="upload-zone compact"><input type="file" accept="image/*,.pdf" onChange={event=>setReceipt(event.target.files?.[0]?.name||'')}/><span>↑</span><b>{receipt||'Anexar comprovante (opcional)'}</b></label><p className="modal-description">Depois de pagar, marque como enviado. A parcela ficará aguardando a confirmação do administrador.</p><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={()=>onSave(receipt)}>Marcar como pago</button></div></Modal>;
}

function TeamModal({onSave,onClose}:{onSave:(member:TeamMember)=>void;onClose:()=>void}) {
  const [name,setName]=useState('');const [email,setEmail]=useState('');
  return <Modal title="Adicionar membro" onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSave({id:uid('team'),name,email,active:true,permissions:['Cadastrar clientes']})}}><div className="form-grid one"><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label></div><p className="modal-description">O convite será simulado nesta fase. Você poderá definir as permissões após salvar.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button">Adicionar membro</button></div></form></Modal>;
}

function Notifications({loans,clients,onClose,onOpen}:{loans:Loan[];clients:Client[];onClose:()=>void;onOpen:(id:string)=>void}) {
  const notifications=loans.flatMap(loan=>loan.installments.filter(item=>item.status==='Aguardando'||item.status==='Atrasado').map(item=>({loan,item,client:clients.find(c=>c.id===loan.clientId)!}))).slice(0,6);
  return <section className="notifications-popover"><header><div><h3>Notificações</h3><small>{notifications.length} itens precisam de atenção</small></div><button onClick={onClose}>×</button></header><div>{notifications.map(({loan,item,client})=><button key={item.id} onClick={()=>onOpen(loan.id)}><span className={`notification-icon ${item.status==='Atrasado'?'late':'waiting'}`}>{item.status==='Atrasado'?'!':'✓'}</span><span><b>{item.status==='Atrasado'?'Parcela em atraso':'Pagamento enviado'}</b><small>{client.name} • Parcela {item.number} • {currency(payableAmount(loan,item))}</small></span><em>›</em></button>)}</div>{!notifications.length&&<p className="popover-empty">Tudo em dia por aqui.</p>}</section>;
}

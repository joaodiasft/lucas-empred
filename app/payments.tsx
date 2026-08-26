'use client';

import { FormEvent, useMemo, useState } from 'react';
import { EmptyState, FieldBlock, Modal, MoneyInput, PageHeader, StatusBadge } from './components';
import { Client, Loan, PaymentMethod, PaymentRecord, currency, daysLate, initials, liveStatus, payableAmount, shortDate } from './lib';

const todayIso = () => new Date().toISOString().slice(0, 10);

function openInstallments(loans: Loan[], clientId?: string) {
  return loans.flatMap(loan => {
    if (clientId && loan.clientId !== clientId) return [];
    if (loan.status !== 'Ativo') return [];
    return loan.installments
      .filter(item => liveStatus(item) !== 'Pago')
      .map(item => ({ loan, item }));
  }).sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate));
}

function PaymentEntryFields({
  due, amount, setAmount, method, setMethod, paidAt, setPaidAt, receipt, setReceipt,
}: {
  due: number;
  amount: number;
  setAmount: (value: number) => void;
  method: PaymentMethod;
  setMethod: (value: PaymentMethod) => void;
  paidAt: string;
  setPaidAt: (value: string) => void;
  receipt: string;
  setReceipt: (value: string) => void;
}) {
  return (
    <div className="form-grid">
      <FieldBlock
        title="Valor recebido"
        hint={`Devido hoje: ${currency(due)}. Inclui atraso, se houver.`}
      >
        <MoneyInput value={amount} onChange={setAmount} required />
      </FieldBlock>
      <FieldBlock
        title="Data do recebimento"
        hint="Quando o dinheiro entrou."
      >
        <input type="date" value={paidAt} onChange={event => setPaidAt(event.target.value)} required />
      </FieldBlock>
      <FieldBlock
        className="span-2"
        title="Como o cliente pagou"
        hint="Dinheiro, PIX ou transferência."
      >
        <div className="choice-cards method-cards">
          <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
            <b>Dinheiro</b>
            <small>Recebido em mãos. A parcela é baixada na hora.</small>
          </button>
          <button type="button" className={method === 'pix' ? 'active' : ''} onClick={() => setMethod('pix')}>
            <b>PIX</b>
            <small>Caiu na chave da empresa. Confirme se o valor bate.</small>
          </button>
          <button type="button" className={method === 'transfer' ? 'active' : ''} onClick={() => setMethod('transfer')}>
            <b>Transferência</b>
            <small>TED, DOC ou depósito identificado.</small>
          </button>
        </div>
      </FieldBlock>
      <FieldBlock
        className="span-2"
        title="Comprovante (opcional)"
        hint="Opcional."
      >
        <label className="upload-zone compact">
          <input type="file" accept="image/*,.pdf" onChange={event => setReceipt(event.target.files?.[0]?.name || '')} />
          <span>↑</span>
          <b>{receipt || 'Anexar comprovante'}</b>
        </label>
      </FieldBlock>
    </div>
  );
}

function RegisterForm({
  clients, loans, presetLoanId, presetInstallmentId, submitLabel, onSave,
}: {
  clients: Client[];
  loans: Loan[];
  presetLoanId?: string;
  presetInstallmentId?: string;
  submitLabel: string;
  onSave: (loanId: string, installmentId: string, payment: PaymentRecord) => void;
}) {
  const open = useMemo(() => openInstallments(loans), [loans]);
  const payers = useMemo(() => {
    const ids = new Set(open.map(row => row.loan.clientId));
    return clients.filter(item => ids.has(item.id));
  }, [clients, open]);
  const preset = open.find(row => row.loan.id === presetLoanId && row.item.id === presetInstallmentId);
  const locked = Boolean(preset);
  const [clientId, setClientId] = useState(preset?.loan.clientId || payers[0]?.id || '');
  const options = useMemo(() => open.filter(row => row.loan.clientId === clientId), [open, clientId]);
  const [installmentKey, setInstallmentKey] = useState(preset ? `${preset.loan.id}:${preset.item.id}` : '');
  const selected = options.find(row => `${row.loan.id}:${row.item.id}` === installmentKey) || options[0];
  const due = selected ? payableAmount(selected.loan, selected.item) : 0;
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState(todayIso);
  const [receipt, setReceipt] = useState(selected?.item.receiptName || '');

  const chooseClient = (nextClientId: string) => {
    const first = open.find(row => row.loan.clientId === nextClientId);
    setClientId(nextClientId);
    setInstallmentKey(first ? `${first.loan.id}:${first.item.id}` : '');
    setAmount(first ? payableAmount(first.loan, first.item) : 0);
    setReceipt(first?.item.receiptName || '');
  };

  const chooseInstallment = (key: string) => {
    const next = open.find(row => `${row.loan.id}:${row.item.id}` === key);
    setInstallmentKey(key);
    setAmount(next ? payableAmount(next.loan, next.item) : 0);
    setReceipt(next?.item.receiptName || '');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || amount <= 0) return;
    onSave(selected.loan.id, selected.item.id, {
      paidAmount: amount,
      paidAt,
      paymentMethod: method,
      receiptName: receipt || undefined,
    });
  };

  if (!payers.length) {
    return <EmptyState title="Nenhuma parcela em aberto" text="Quando houver cobrança pendente, ela aparece aqui para você registrar o recebimento." />;
  }

  return (
    <form onSubmit={submit}>
      {!locked && (
        <div className="form-grid">
          <FieldBlock title="Cliente" hint="Quem pagou.">
            <select value={clientId} onChange={event => chooseClient(event.target.value)}>
              {payers.map(client => <option value={client.id} key={client.id}>{client.name} — {client.cpf}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock title="Parcela" hint="Qual vencimento está sendo baixado.">
            <select value={selected ? `${selected.loan.id}:${selected.item.id}` : ''} onChange={event => chooseInstallment(event.target.value)}>
              {options.map(row => (
                <option value={`${row.loan.id}:${row.item.id}`} key={row.item.id}>
                  {row.loan.contractNumber} · Parcela {row.item.number} · {shortDate(row.item.dueDate)} · {currency(payableAmount(row.loan, row.item))}
                </option>
              ))}
            </select>
          </FieldBlock>
        </div>
      )}
      {selected && (
        <div className="register-summary">
          <span>
            <small>Cliente</small>
            <b>{clients.find(item => item.id === selected.loan.clientId)?.name}</b>
          </span>
          <span>
            <small>Parcela</small>
            <b>#{String(selected.item.number).padStart(2, '0')} · {shortDate(selected.item.dueDate)}</b>
          </span>
          <span>
            <small>A receber</small>
            <b>{currency(due)}</b>
          </span>
        </div>
      )}
      {selected && daysLate(selected.item.dueDate) > 0 && (
        <p className="late-hint">{daysLate(selected.item.dueDate)} dia(s) de atraso. O valor já inclui encargos.</p>
      )}
      {selected && (
        <PaymentEntryFields
          due={due}
          amount={amount} setAmount={setAmount}
          method={method} setMethod={setMethod}
          paidAt={paidAt} setPaidAt={setPaidAt}
          receipt={receipt} setReceipt={setReceipt}
        />
      )}
      <div className="form-actions">
        <p className="register-footnote">A parcela fica paga na hora.</p>
        <button className="primary-button" disabled={!selected || amount <= 0}>{submitLabel}</button>
      </div>
    </form>
  );
}

export function RegisterPaymentModal({
  clients, loans, presetLoanId, presetInstallmentId, onSave, onClose,
}: {
  clients: Client[];
  loans: Loan[];
  presetLoanId?: string;
  presetInstallmentId?: string;
  onSave: (loanId: string, installmentId: string, payment: PaymentRecord) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Registrar pagamento" onClose={onClose}>
      <RegisterForm
        clients={clients}
        loans={loans}
        presetLoanId={presetLoanId}
        presetInstallmentId={presetInstallmentId}
        submitLabel="Registrar e dar baixa"
        onSave={onSave}
      />
    </Modal>
  );
}

export function PaymentsView({
  loans, clients, onConfirm, onReject, onOpenLoan, onRegister, onSavePayment,
}: {
  loans: Loan[];
  clients: Client[];
  onConfirm: (loanId: string, id: string) => void;
  onReject: (loanId: string, id: string) => void;
  onOpenLoan: (id: string) => void;
  onRegister: (loanId: string, id: string) => void;
  onSavePayment: (loanId: string, installmentId: string, payment: PaymentRecord) => void;
}) {
  const [tab, setTab] = useState<'awaiting' | 'late' | 'all'>('all');
  const rows = loans.flatMap(loan => loan.installments.map(item => ({
    loan, item, client: clients.find(client => client.id === loan.clientId)!,
  }))).filter(row => {
    if (!row.client) return false;
    if (tab === 'awaiting') return row.item.status === 'Aguardando';
    if (tab === 'late') return liveStatus(row.item) === 'Atrasado';
    return liveStatus(row.item) !== 'Pago';
  });

  return (
    <>
      <PageHeader
        eyebrow="CAIXA"
        title="Pagamentos"
        subtitle="Registre o recebimento e dê baixa na parcela."
      />

      <section className="form-card register-panel">
        <div className="form-section-title">
          <span>✓</span>
          <div>
            <h3>Registrar pagamento recebido</h3>
            <p>Baixa o que você recebeu. A parcela sai do aberto na hora.</p>
          </div>
        </div>
        <RegisterForm clients={clients} loans={loans} submitLabel="Registrar e dar baixa" onSave={onSavePayment} />
      </section>

      <div className="tabs">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Pendentes</button>
        <button className={tab === 'awaiting' ? 'active' : ''} onClick={() => setTab('awaiting')}>
          Aguardando confirmação <em>{loans.flatMap(loan => loan.installments).filter(item => item.status === 'Aguardando').length}</em>
        </button>
        <button className={tab === 'late' ? 'active' : ''} onClick={() => setTab('late')}>Em atraso</button>
      </div>

      {rows.length ? (
        <section className="payment-cards">
          {rows.map(({ loan, item, client }) => (
            <article key={item.id}>
              <div className="payment-person">
                <span className="avatar light">{initials(client.name)}</span>
                <span>
                  <b>{client.name}</b>
                  <small>{loan.contractNumber} • Parcela {item.number}/{loan.weeks}</small>
                </span>
                <StatusBadge status={liveStatus(item)} />
              </div>
              <div className="payment-amount">
                <small>{liveStatus(item) === 'Atrasado' ? 'Total atualizado' : 'Valor da parcela'}</small>
                <b>{currency(payableAmount(loan, item))}</b>
                <span>Vencimento {shortDate(item.dueDate)}</span>
              </div>
              {item.receiptName ? (
                <button className="receipt-preview" type="button">
                  <span>▤</span>
                  <span><b>Comprovante anexado</b><small>{item.receiptName}</small></span>
                  <em>Visualizar</em>
                </button>
              ) : <div className="no-receipt">Nenhum comprovante anexado</div>}
              <div className="card-actions">
                <button className="text-button" onClick={() => onOpenLoan(loan.id)}>Ver contrato</button>
                {item.status === 'Aguardando' && <button className="danger-link" onClick={() => onReject(loan.id, item.id)}>Recusar</button>}
                {item.status === 'Aguardando' && <button className="secondary-button" onClick={() => onConfirm(loan.id, item.id)}>✓ Confirmar envio</button>}
                <button className="primary-button" onClick={() => onRegister(loan.id, item.id)}>Registrar pagamento</button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title={tab === 'awaiting' ? 'Tudo conferido' : 'Nenhuma parcela nesta situação'}
          text={tab === 'awaiting' ? 'Não há pagamentos aguardando confirmação.' : 'Os filtros não retornaram cobranças.'}
        />
      )}
    </>
  );
}

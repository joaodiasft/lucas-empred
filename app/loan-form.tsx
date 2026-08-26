'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, InterestGuide, MoneyInput, PageHeader, RiskBadge, Stepper } from './components';
import { AppSettings, Client, Loan, PayFrequency, currency, generateInstallments, riskFor, shortDate, uid } from './lib';

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
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState(prefilledClient || clients[0]?.id || '');
  const [principal, setPrincipal] = useState(5000);
  const [rate, setRate] = useState(settings.defaultRate);
  const [weeks, setWeeks] = useState(settings.defaultWeeks);
  const [frequency, setFrequency] = useState<PayFrequency>(settings.defaultFrequency || 'weekly');
  const [mode, setMode] = useState<'total' | 'balance'>('total');
  const [firstDue, setFirstDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [feeType, setFeeType] = useState<'fixed' | 'percent'>(settings.feeType);
  const [feeValue, setFeeValue] = useState(settings.feeValue);
  const [lateInterest, setLateInterest] = useState(settings.lateInterest);

  const client = clients.find(item => item.id === clientId)!;
  const preview = useMemo(
    () => generateInstallments({ principal, rate, interestMode: mode, weeks, firstDueDate: firstDue, frequency }),
    [principal, rate, mode, weeks, firstDue, frequency],
  );
  const total = preview.reduce((sum, item) => sum + item.amount, 0);
  const risk = client ? riskFor(client, loans, principal) : null;
  const periodWord = frequency === 'monthly' ? 'mês' : 'semana';
  const sampleFee = feeType === 'fixed' ? feeValue : (preview[0]?.amount || 0) * (feeValue / 100);
  const sampleMora = (preview[0]?.amount || 0) * (lateInterest / 100);

  const next = () => setStep(value => Math.min(2, value + 1));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step < 2) {
      next();
      return;
    }
    const id = uid('emp');
    onSave({
      id,
      clientId,
      contractNumber: `LE-${new Date().getFullYear()}-${id.slice(-4).toUpperCase()}`,
      principal,
      rate,
      interestMode: mode,
      weeks,
      firstDueDate: firstDue,
      frequency,
      feeType,
      feeValue,
      lateInterest,
      status: 'Ativo',
      installments: preview,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <>
      <PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Simule as condições, revise o risco e gere o contrato." />
      <Stepper steps={['Cliente e valor', 'Condições', 'Parcelas e aprovação']} active={step} />
      <form className="form-card loan-form" onSubmit={submit}>
        {step === 0 && (
          <>
            <div className="form-section-title">
              <span>1</span>
              <div>
                <h3>Cliente e valor solicitado</h3>
                <p>Escolha quem recebe o dinheiro e quanto será emprestado. Os juros entram no passo seguinte.</p>
              </div>
            </div>
            <div className="form-grid">
              <FieldBlock
                className="span-2"
                title="Cliente"
                hint="Quem vai receber o empréstimo. O sistema usa o histórico dele para estimar o risco desta operação."
              >
                <select value={clientId} onChange={e => setClientId(e.target.value)}>
                  {clients.map(item => (
                    <option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>
                  ))}
                </select>
              </FieldBlock>
              <FieldBlock
                title="Valor principal"
                hint="É o dinheiro que você realmente entrega ao cliente. Os juros são calculados em cima deste valor — não do total das parcelas."
              >
                <MoneyInput value={principal} onChange={setPrincipal} required />
              </FieldBlock>
              <FieldBlock
                title="Primeiro vencimento"
                hint="Data da primeira parcela. As demais seguem automaticamente: a cada 7 dias (semanal) ou no mesmo dia do mês seguinte (mensal)."
              >
                <input type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} required />
              </FieldBlock>
              <FieldBlock
                className="span-2"
                title="Periodicidade das parcelas"
                hint="Define o ritmo de pagamento. Semanal cobra mais vezes, em valores menores. Mensal cobra menos vezes, em valores maiores."
              >
                <div className="choice-cards">
                  <button type="button" className={frequency === 'weekly' ? 'active' : ''} onClick={() => setFrequency('weekly')}>
                    <b>Semanal</b>
                    <small>Uma parcela a cada 7 dias</small>
                  </button>
                  <button type="button" className={frequency === 'monthly' ? 'active' : ''} onClick={() => setFrequency('monthly')}>
                    <b>Mensal</b>
                    <small>Uma parcela a cada mês</small>
                  </button>
                </div>
              </FieldBlock>
            </div>
            {risk && (
              <div className={`risk-preview ${risk.level === 'Baixo risco' ? 'low' : risk.level === 'Médio risco' ? 'medium' : 'high'}`}>
                <RiskBadge level={risk.level} score={risk.score} />
                <div>
                  <b>Análise para {client.name}</b>
                  <p>{risk.reasons.join(' • ')}</p>
                </div>
              </div>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <div className="form-section-title">
              <span>2</span>
              <div>
                <h3>Condições financeiras</h3>
                <p>Aqui você define quanto cobra de juros, em quantas vezes o cliente paga e o que acontece se atrasar.</p>
              </div>
            </div>
            <InterestGuide principal={principal} rate={rate} weeks={weeks} frequency={frequency} mode={mode} />
            <div className="form-grid">
              <FieldBlock
                title="Taxa de juros (%)"
                hint={`Percentual cobrado sobre o valor emprestado. Exemplo: R$ 1.000 com 20% gera R$ 200 de juros. O cliente devolve R$ 1.200 no total do prazo.`}
              >
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))} />
              </FieldBlock>
              <FieldBlock
                title={frequency === 'monthly' ? 'Prazo em meses' : 'Prazo em semanas'}
                hint={`Quantas parcelas o cliente terá. ${weeks} ${frequency === 'monthly' ? 'meses' : 'semanas'} = ${weeks} pagamentos, um por ${periodWord}.`}
              >
                <input type="number" min="1" max="104" value={weeks} onChange={e => setWeeks(Number(e.target.value))} />
              </FieldBlock>
              <FieldBlock
                className="span-2"
                title="Modalidade de juros"
                hint="Escolha como a taxa é aplicada. Fixo sobre o total é o mais comum: parcelas iguais e fáceis de explicar. Sobre o saldo, os juros caem conforme o cliente vai pagando."
              >
                <div className="choice-cards">
                  <button type="button" className={mode === 'total' ? 'active' : ''} onClick={() => setMode('total')}>
                    <b>Fixo sobre o total</b>
                    <small>A taxa incide uma vez no valor emprestado e o resultado é dividido em parcelas iguais.</small>
                  </button>
                  <button type="button" className={mode === 'balance' ? 'active' : ''} onClick={() => setMode('balance')}>
                    <b>Sobre saldo devedor</b>
                    <small>A taxa incide no que ainda falta pagar. As primeiras parcelas saem maiores e as últimas, menores.</small>
                  </button>
                </div>
              </FieldBlock>
              <FieldBlock
                title="Tipo de multa"
                hint="A multa entra só se a parcela atrasar. Percentual cobra um % da parcela. Valor fixo cobra sempre o mesmo em reais, independente do tamanho da parcela."
              >
                <select value={feeType} onChange={e => setFeeType(e.target.value as 'fixed' | 'percent')}>
                  <option value="percent">Percentual sobre a parcela</option>
                  <option value="fixed">Valor fixo em reais</option>
                </select>
              </FieldBlock>
              <FieldBlock
                title={feeType === 'percent' ? 'Multa (%)' : 'Multa fixa (R$)'}
                hint={
                  feeType === 'percent'
                    ? `Cobra ${String(feeValue).replace('.', ',')}% em cima da parcela atrasada. Com os números atuais, isso seria cerca de ${currency(sampleFee)} na primeira parcela.`
                    : `Cobra ${currency(feeValue)} uma vez em cada parcela atrasada, além dos juros de mora.`
                }
              >
                <input type="number" min="0" step="0.01" value={feeValue} onChange={e => setFeeValue(Number(e.target.value))} />
              </FieldBlock>
              <FieldBlock
                className="span-2"
                title="Juros de mora ao dia (%)"
                hint={`Percentual extra por cada dia de atraso, em cima do valor da parcela. Com ${String(lateInterest).replace('.', ',')}% ao dia, um dia de atraso na primeira parcela acrescenta cerca de ${currency(sampleMora)}. Multa e mora somam: não substituem uma à outra.`}
              >
                <input type="number" min="0" step="0.001" value={lateInterest} onChange={e => setLateInterest(Number(e.target.value))} />
              </FieldBlock>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="form-section-title">
              <span>3</span>
              <div>
                <h3>Resumo do contrato</h3>
                <p>Confira o que o cliente vai pagar. Principal é o que você emprestou; juros é o seu ganho; parcela é a soma dos dois em cada vencimento.</p>
              </div>
            </div>
            <div className="simulation-summary">
              <span>
                <small>Valor principal</small>
                <b>{currency(principal)}</b>
                <em>Dinheiro entregue ao cliente</em>
              </span>
              <span>
                <small>Total de juros</small>
                <b>{currency(total - principal)}</b>
                <em>Ganho previsto no contrato</em>
              </span>
              <span>
                <small>Total do contrato</small>
                <b>{currency(total)}</b>
                <em>Principal + juros, sem atraso</em>
              </span>
              <span>
                <small>Parcela inicial</small>
                <b>{currency(preview[0]?.amount || 0)}</b>
                <em>Primeiro vencimento {shortDate(firstDue)}</em>
              </span>
            </div>
            <div className="table-scroll">
              <div className="installment-table">
                <div className="table-row table-head">
                  <span>#</span>
                  <span>Vencimento</span>
                  <span>Principal</span>
                  <span>Juros</span>
                  <span>Parcela</span>
                </div>
                {preview.map(item => (
                  <div className="table-row" key={item.id}>
                    <span>{String(item.number).padStart(2, '0')}</span>
                    <span>{shortDate(item.dueDate)}</span>
                    <span>{currency(item.principal)}</span>
                    <span>{currency(item.interest)}</span>
                    <strong>{currency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="approval-note">
              <span>✓</span>
              <div>
                <b>Pronto para aprovação manual</b>
                <p>Ao confirmar, o sistema cria o contrato e todas as parcelas. Multa e mora só aparecem depois, se houver atraso. O score é apenas uma recomendação.</p>
              </div>
            </div>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={step ? () => setStep(value => value - 1) : onCancel}>
            {step ? 'Voltar' : 'Cancelar'}
          </button>
          <button className="primary-button">{step === 2 ? 'Aprovar e criar contrato' : 'Continuar →'}</button>
        </div>
      </form>
    </>
  );
}

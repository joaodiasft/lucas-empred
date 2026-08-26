'use client';

import { FormEvent, useMemo, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, RiskBadge, Stepper } from './components';
import { MonthlySchedule } from './loan-schedule';
import { AppSettings, Client, Loan, LoanCategory, LoanPlanMode, LoanType, PayFrequency, PenaltyMode, currency, formatRate, frequencyLabel, generateFlexibleInstallments, rateFromInterest, riskFor, roundCents, uid } from './lib';

const frequencyCopy: Record<PayFrequency, { title:string; text:string }> = {
  daily:{title:'Diário',text:'Nos dias escolhidos'}, weekly:{title:'Semanal',text:'A cada 7 dias'},
  fortnightly:{title:'Quinzenal',text:'A cada 15 dias'}, monthly:{title:'Mensal',text:'No mesmo dia do mês'},
};
const weekdays = [{value:1,label:'Seg'},{value:2,label:'Ter'},{value:3,label:'Qua'},{value:4,label:'Qui'},{value:5,label:'Sex'},{value:6,label:'Sáb'},{value:0,label:'Dom'}];

export function NewLoanView({ clients, loans, settings, prefilledClient, onSave, onCancel }: {
  clients:Client[]; loans:Loan[]; settings:AppSettings; prefilledClient?:string; onSave:(loan:Loan)=>void; onCancel:()=>void;
}) {
  const [step,setStep] = useState(0);
  const [clientId,setClientId] = useState(prefilledClient || clients[0]?.id || '');
  const [loanType,setLoanType] = useState<LoanType>('personal');
  const [category,setCategory] = useState<LoanCategory>('cash');
  const [frequency,setFrequency] = useState<PayFrequency>(settings.defaultFrequency || 'weekly');
  const [planMode,setPlanMode] = useState<LoanPlanMode>('monthly_split');
  const [principal,setPrincipal] = useState(5000);
  const [rate,setRate] = useState(settings.defaultRate || 20);
  const [installmentCount,setInstallmentCount] = useState(settings.defaultWeeks || 12);
  const [termMonths,setTermMonths] = useState(3);
  const [fixedInstallment,setFixedInstallment] = useState(450);
  const [paymentWeekdays,setPaymentWeekdays] = useState<number[]>([1,2,3,4,5,6]);
  const [firstDueDate,setFirstDueDate] = useState(()=>{const date=new Date();date.setDate(date.getDate()+7);return date.toISOString().slice(0,10);});
  const [penaltyMode,setPenaltyMode] = useState<PenaltyMode>('fixed_daily');
  const [penaltyValue,setPenaltyValue] = useState(settings.feeType === 'fixed' ? settings.feeValue : 5);

  const preview = useMemo(()=>generateFlexibleInstallments({principal,rate,firstDueDate,frequency,planMode,installmentCount,termMonths,fixedInstallment,paymentWeekdays}),[principal,rate,firstDueDate,frequency,planMode,installmentCount,termMonths,fixedInstallment,paymentWeekdays]);
  const total = roundCents(preview.reduce((sum,item)=>sum+item.amount,0));
  const interest = roundCents(total-principal);
  const effectiveRate = rateFromInterest(principal,interest);
  const monthlyPrincipal = roundCents(principal/Math.max(1,termMonths));
  const monthlyInterest = roundCents(principal*(rate/100));
  const monthlyTarget = roundCents(monthlyPrincipal+monthlyInterest);
  const fixedInvalid = planMode === 'fixed_installment' && total < principal;
  const client = clients.find(item=>item.id===clientId);
  const risk = client ? riskFor(client,loans,principal) : null;

  const toggleWeekday = (day:number) => setPaymentWeekdays(current=>current.includes(day) ? (current.length===1?current:current.filter(item=>item!==day)) : [...current,day]);
  const submit = (event:FormEvent) => {
    event.preventDefault();
    if (step < 3) { setStep(value=>value+1); return; }
    if (!clientId || !preview.length || fixedInvalid) return;
    const id=uid('emp');
    onSave({id,clientId,contractNumber:`LE-${new Date().getFullYear()}-${id.slice(-4).toUpperCase()}`,principal,rate:planMode==='fixed_installment'?effectiveRate:rate,interestMode:'total',weeks:preview.length,firstDueDate,frequency,loanType,category,planMode,termMonths:planMode==='contract_total'?undefined:termMonths,fixedInstallment:planMode==='fixed_installment'?fixedInstallment:undefined,paymentWeekdays:frequency==='daily'?paymentWeekdays:undefined,penaltyMode,penaltyValue:penaltyMode==='none'?0:penaltyValue,feeType:penaltyMode.includes('percent')?'percent':'fixed',feeValue:penaltyValue,lateInterest:0,status:'Ativo',installments:preview,createdAt:new Date().toISOString().slice(0,10)});
  };

  return <><PageHeader eyebrow="NOVA OPERAÇÃO" title="Novo empréstimo" subtitle="Defina as regras e confira cada mês antes de aprovar."/><Stepper steps={['Dados','Condições','Multa','Resultado']} active={step}/><form className="form-card loan-form" onSubmit={submit}>
    {step===0&&<><SectionTitle number="1" title="Informações básicas" text="Identifique o cliente, a modalidade e onde o dinheiro será usado."/><div className="form-grid three-columns">
      <FieldBlock title="Cliente" hint="Quem receberá o empréstimo."><select value={clientId} onChange={event=>setClientId(event.target.value)} required>{clients.map(item=><option value={item.id} key={item.id}>{item.name} — {item.cpf}</option>)}</select></FieldBlock>
      <FieldBlock title="Tipo de empréstimo" hint="Organiza a finalidade principal do contrato."><select value={loanType} onChange={event=>setLoanType(event.target.value as LoanType)}><option value="personal">Empréstimo pessoal</option><option value="business">Capital de giro</option><option value="emergency">Emergência</option><option value="refinancing">Renegociação</option><option value="other">Outro</option></select></FieldBlock>
      <FieldBlock title="Categoria" hint="Facilita filtros e relatórios."><select value={category} onChange={event=>setCategory(event.target.value as LoanCategory)}><option value="cash">Dinheiro / PIX</option><option value="vehicle">Veículo</option><option value="home">Casa e reforma</option><option value="health">Saúde</option><option value="education">Educação</option><option value="business">Negócio</option><option value="other">Outros</option></select></FieldBlock>
    </div>{risk&&<div className={`risk-preview ${risk.level==='Baixo risco'?'low':risk.level==='Médio risco'?'medium':'high'}`}><RiskBadge level={risk.level} score={risk.score}/><div><b>Análise para {client?.name}</b><p>{risk.reasons.join(' • ')}</p></div></div>}</>}

    {step===1&&<><SectionTitle number="2" title="Valores e forma de pagamento" text="Escolha como o calendário e os juros devem formar as parcelas."/><div className="form-grid">
      <FieldBlock title="Valor emprestado" hint="Dinheiro entregue ao cliente."><MoneyInput value={principal} onChange={value=>setPrincipal(Math.max(0,value))} required/></FieldBlock>
      <FieldBlock title={planMode==='monthly_split'?'Juros ao mês (%)':planMode==='contract_total'?'Juros do contrato (%)':'Juros calculados'} hint={planMode==='fixed_installment'?'Resultado da parcela fixa escolhida.':'Percentual usado no cálculo.'}>{planMode==='fixed_installment'?<div className="calculated-field"><b>{formatRate(effectiveRate)}%</b><small>{currency(interest)} no contrato</small></div>:<input type="number" min="0" step="0.01" value={rate} onChange={event=>setRate(Number(event.target.value))}/>}</FieldBlock>
      <FieldBlock className="span-2" title="Periodicidade" hint="O ritmo dos vencimentos."><div className="choice-cards frequency-cards">{(Object.keys(frequencyCopy) as PayFrequency[]).map(value=><button type="button" key={value} className={frequency===value?'active':''} onClick={()=>setFrequency(value)}><b>{frequencyCopy[value].title}</b><small>{frequencyCopy[value].text}</small></button>)}</div></FieldBlock>
      {frequency==='daily'&&<FieldBlock className="span-2" title="Dias de cobrança" hint="Escolha em quais dias haverá vencimento."><div className="weekday-picker">{weekdays.map(day=><button type="button" key={day.value} className={paymentWeekdays.includes(day.value)?'active':''} onClick={()=>toggleWeekday(day.value)}>{day.label}</button>)}</div></FieldBlock>}
      <FieldBlock className="span-2" title="Como calcular" hint="Você pode dividir um total, manter um total mensal ou fixar cada parcela."><div className="choice-cards plan-cards"><button type="button" className={planMode==='monthly_split'?'active':''} onClick={()=>setPlanMode('monthly_split')}><b>Total mensal</b><small>Cada mês recebe principal + juros. O sistema divide entre 4 ou 5 semanas reais.</small></button><button type="button" className={planMode==='fixed_installment'?'active':''} onClick={()=>setPlanMode('fixed_installment')}><b>Parcela fixa</b><small>O valor por vencimento não muda. Meses com 5 cobranças ficam maiores.</small></button><button type="button" className={planMode==='contract_total'?'active':''} onClick={()=>setPlanMode('contract_total')}><b>Total do contrato</b><small>Aplica o juros uma vez e divide pela quantidade de parcelas.</small></button></div></FieldBlock>
      <FieldBlock title="Primeiro vencimento" hint="Data da primeira cobrança."><input type="date" value={firstDueDate} onChange={event=>setFirstDueDate(event.target.value)} required/></FieldBlock>
      {planMode==='contract_total'?<FieldBlock title="Quantidade de parcelas" hint={`Parcelas com frequência ${frequencyLabel(frequency).toLowerCase()}.`}><input type="number" min="1" max="1000" value={installmentCount} onChange={event=>setInstallmentCount(Number(event.target.value)||1)}/></FieldBlock>:<FieldBlock title="Duração em meses" hint="Os próximos meses serão montados automaticamente."><input type="number" min="1" max="60" value={termMonths} onChange={event=>setTermMonths(Number(event.target.value)||1)}/></FieldBlock>}
      {planMode==='fixed_installment'&&<FieldBlock className="span-2" title={`Valor fixo por vencimento ${frequencyLabel(frequency).toLowerCase()}`} hint="Este valor se repete em todas as cobranças."><MoneyInput value={fixedInstallment} onChange={value=>setFixedInstallment(Math.max(0,value))} required/></FieldBlock>}
    </div>{planMode==='monthly_split'&&<div className="monthly-formula"><span><small>Principal do mês</small><b>{currency(monthlyPrincipal)}</b></span><i>+</i><span><small>Juros do mês</small><b>{currency(monthlyInterest)}</b></span><i>=</i><span className="highlight"><small>Total de cada mês</small><b>{currency(monthlyTarget)}</b></span></div>}{planMode==='fixed_installment'&&<div className={`plan-alert ${fixedInvalid?'danger':''}`}><b>{fixedInvalid?'A parcela fixa ainda não cobre o valor emprestado.':'Parcela fixa aplicada corretamente.'}</b><p>Total previsto: {currency(total)} em {preview.length} vencimentos. {interest>=0?`Juros resultantes: ${currency(interest)}.`:`Faltam ${currency(Math.abs(interest))} para cobrir o principal.`}</p></div>}</>}

    {step===2&&<><SectionTitle number="3" title="Multa por atraso" text="Defina uma regra clara. O valor só entra quando a parcela vencer sem pagamento."/><div className="penalty-options">{([['none','Não aplicar multa','Nenhum acréscimo automático.'],['fixed_daily','Valor fixo por dia','Soma o mesmo valor a cada dia de atraso.'],['percent_daily','Percentual por dia','Aplica uma porcentagem da parcela por dia.'],['fixed_once','Valor fixo único','Cobra uma vez, independentemente dos dias.'],['percent_once','Percentual único','Aplica uma vez sobre a parcela atrasada.']] as [PenaltyMode,string,string][]).map(option=><button type="button" key={option[0]} className={penaltyMode===option[0]?'active':''} onClick={()=>setPenaltyMode(option[0])}><span>{penaltyMode===option[0]?'✓':''}</span><b>{option[1]}</b><small>{option[2]}</small></button>)}</div>{penaltyMode!=='none'&&<div className="form-grid penalty-value"><FieldBlock className="span-2" title={penaltyMode.includes('percent')?'Valor da multa (%)':'Valor da multa (R$)'} hint={penaltyMode.includes('daily')?'Aplicado por cada dia completo de atraso.':'Aplicado uma única vez por parcela atrasada.'}>{penaltyMode.includes('percent')?<input type="number" min="0" step="0.01" value={penaltyValue} onChange={event=>setPenaltyValue(Number(event.target.value))}/>:<MoneyInput value={penaltyValue} onChange={setPenaltyValue}/>}</FieldBlock></div>}</>}

    {step===3&&<><SectionTitle number="4" title="Resultado e próximos meses" text="Confira totais, juros e todos os vencimentos antes de criar o contrato."/><div className="simulation-summary five"><span><small>Emprestado</small><b>{currency(principal)}</b><em>Capital liberado</em></span><span><small>Juros</small><b>{currency(Math.max(0,interest))}</b><em>{formatRate(effectiveRate)}% no resultado</em></span><span><small>Total</small><b>{currency(total)}</b><em>Sem atraso</em></span><span><small>Vencimentos</small><b>{preview.length}</b><em>{frequencyLabel(frequency)}</em></span><span><small>Prazo</small><b>{planMode==='contract_total'?`${installmentCount} parcelas`:`${termMonths} meses`}</b><em>Começa no dia informado</em></span></div><MonthlySchedule installments={preview}/><div className="approval-note"><span>✓</span><div><b>Cálculo pronto para aprovação</b><p>Os totais mensais e cada vencimento ficarão salvos no contrato.</p></div></div></>}

    <div className="form-actions"><button type="button" className="secondary-button" onClick={step?()=>setStep(value=>value-1):onCancel}>{step?'Voltar':'Cancelar'}</button><button className="primary-button" disabled={fixedInvalid||!clientId}>{step===3?'Aprovar e criar contrato':'Continuar →'}</button></div>
  </form></>;
}

function SectionTitle({number,title,text}:{number:string;title:string;text:string}) { return <div className="form-section-title"><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }

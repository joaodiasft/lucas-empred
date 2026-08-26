'use client';

import { PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { InstallmentStatus, RiskLevel, currency } from './lib';

export function StatusBadge({ status }: { status: InstallmentStatus | 'Ativo' | 'Quitado' | 'Renegociado' | 'Inativo' }) {
  const key = status.toLowerCase().replace(' ', '-').replace('aguardando', 'waiting').replace('pendente','pending').replace('pago','paid').replace('atrasado','late').replace('ativo','active').replace('quitado','paid').replace('renegociado','neutral').replace('inativo','inactive');
  return <span className={`status-badge ${key}`}>{status === 'Aguardando' ? 'Aguardando confirmação' : status}</span>;
}

export function RiskBadge({ level, score, compact = false }: { level: RiskLevel; score?: number; compact?: boolean }) {
  const tone = level === 'Baixo risco' ? 'low' : level === 'Médio risco' ? 'medium' : 'high';
  return <span className={`risk-badge ${tone}`}>{!compact && score !== undefined && <b>{score}</b>}<span>{level}</span></span>;
}

export function SummaryCard({ label, value, detail, tone = 'navy', icon }: { label: string; value: string; detail?: string; tone?: string; icon?: string }) {
  return <article className={`summary-card ${tone}`}><span className="summary-icon">{icon || label.charAt(0)}</span><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="page-actions">{action}</div>}</div>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><header><h3>{title}</h3><button className="icon-close" onClick={onClose} aria-label="Fechar">×</button></header><div className="modal-body">{children}</div></section></div>;
}

export function ConfirmModal({ title, description, confirmLabel = 'Confirmar', destructive = false, onConfirm, onClose }: { title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal title={title} onClose={onClose}><p className="modal-description">{description}</p><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className={destructive ? 'danger-button' : 'primary-button'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div></Modal>;
}

export function MoneyInput({ value, onChange, id, required }: { value: number; onChange: (value: number) => void; id?: string; required?: boolean }) {
  const [text, setText] = useState(value ? currency(value) : '');
  return <div className="money-input"><span>R$</span><input id={id} inputMode="decimal" required={required} value={text.replace(/^R\$\s?/, '')} placeholder="0,00" onFocus={() => setText(value ? value.toFixed(2).replace('.', ',') : '')} onChange={event => { const raw = event.target.value.replace(/[^\d,]/g, '').replace(',', '.'); setText(event.target.value); onChange(Number(raw) || 0); }} onBlur={() => setText(value ? currency(value) : '')} /></div>;
}

export function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return <div className="stepper">{steps.map((step, index) => <div className={index === active ? 'active' : index < active ? 'done' : ''} key={step}><span>{index < active ? '✓' : index + 1}</span><small>{step}</small></div>)}</div>;
}

export function SignaturePad({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const image = new Image();
    image.onload = () => canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = value;
  }, [value]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; drawing.current = true; canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext('2d')!; const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.strokeStyle = '#172642'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext('2d')!; const p = point(event); ctx.lineTo(p.x,p.y); ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current!.toDataURL('image/png')); };
  const clear = () => { const canvas = canvasRef.current!; canvas.getContext('2d')!.clearRect(0,0,canvas.width,canvas.height); onChange(''); };
  return <div className="signature-pad"><canvas ref={canvasRef} width={720} height={210} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Área para assinatura digital" /><div className="signature-line"><span>Assine acima usando o dedo ou mouse</span><button type="button" onClick={clear}>Limpar</button></div></div>;
}

export function FieldBlock({ title, hint, className = '', children }: { title: string; hint: string; className?: string; children: ReactNode }) {
  return (
    <div className={`explained-field ${className}`.trim()}>
      <b>{title}</b>
      <em>{hint}</em>
      {children}
    </div>
  );
}

export function InterestGuide({
  principal, rate, weeks, frequency, mode,
}: {
  principal: number; rate: number; weeks: number; frequency: 'weekly' | 'monthly'; mode: 'total' | 'balance';
}) {
  const count = Math.max(1, Number(weeks) || 1);
  const interest = principal * (rate / 100);
  const total = principal + interest;
  const parcel = total / count;
  const unit = frequency === 'monthly' ? (count === 1 ? 'mês' : 'meses') : (count === 1 ? 'semana' : 'semanas');
  const cadence = frequency === 'monthly' ? 'mês' : 'semana';
  return (
    <aside className="interest-guide">
      <h4>Como os juros funcionam neste contrato</h4>
      <p>
        Você empresta um valor (o principal). A taxa é o percentual cobrado sobre esse valor.
        O prazo divide o total em parcelas {frequency === 'monthly' ? 'mensais' : 'semanais'}.
        Multa e mora só entram se o cliente atrasar.
      </p>
      <div className="interest-example">
        <small>Exemplo com os números atuais</small>
        {mode === 'total' ? (
          <p>
            Emprestando <b>{currency(principal)}</b> com <b>{String(rate).replace('.', ',')}%</b> em <b>{count} {unit}</b>,
            os juros são <b>{currency(interest)}</b>. O cliente devolve <b>{currency(total)}</b>,
            em parcelas iguais de cerca de <b>{currency(parcel)}</b> por {cadence}.
          </p>
        ) : (
          <p>
            Emprestando <b>{currency(principal)}</b> com <b>{String(rate).replace('.', ',')}%</b> sobre o saldo,
            os juros caem a cada parcela paga. As primeiras ficam mais altas; as últimas, menores.
            O prazo continua sendo <b>{count} {unit}</b>.
          </p>
        )}
      </div>
    </aside>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span>○</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onDone, 3200); return () => window.clearTimeout(timer); }, [message, onDone]);
  return <div className="toast" role="status"><span>✓</span>{message}</div>;
}

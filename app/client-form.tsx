'use client';

import { FormEvent, useState } from 'react';
import { FieldBlock, MoneyInput, PageHeader, SignaturePad } from './components';
import {
  AddressFields, CLIENT_DOCUMENT_SLOTS, Client, GeoLocation, compressImage, digitsOnly, emptyAddress,
  formatAddress, formatCep, formatCpf, formatPhone, formatRg, lookupCep, mapEmbedUrl, uid,
} from './lib';

function emptyRef() {
  return { name: '', phone: '', relation: '', hasWhatsapp: true };
}

function AddressBlock({
  value, onChange, disabled, onLocated,
}: {
  value: AddressFields;
  onChange: (value: AddressFields) => void;
  disabled?: boolean;
  onLocated?: (patch: Partial<AddressFields>) => void;
}) {
  const set = (key: keyof AddressFields, next: string) => onChange({ ...value, [key]: next });

  const onCep = async (raw: string) => {
    const zip = formatCep(raw);
    onChange({ ...value, zip });
    const found = await lookupCep(zip);
    if (found) onChange({ ...value, zip, ...found });
    onLocated?.(found || { zip });
  };

  return (
    <div className={`form-grid ${disabled ? 'is-disabled' : ''}`}>
      <FieldBlock title="CEP" hint="8 dígitos. Ao completar, rua, bairro, cidade e UF entram sozinhos.">
        <input inputMode="numeric" autoComplete="postal-code" maxLength={9} disabled={disabled} value={value.zip} onChange={event => void onCep(event.target.value)} placeholder="00000-000" />
      </FieldBlock>
      <FieldBlock title="UF" hint="Sigla do estado, 2 letras.">
        <input maxLength={2} autoComplete="address-level1" disabled={disabled} value={value.state} onChange={event => set('state', event.target.value.toUpperCase())} placeholder="SP" />
      </FieldBlock>
      <FieldBlock className="span-2" title="Rua / avenida" hint="Nome da via, sem o número.">
        <input autoComplete="address-line1" disabled={disabled} value={value.street} onChange={event => set('street', event.target.value)} placeholder="Rua, avenida ou travessa" />
      </FieldBlock>
      <FieldBlock title="Número" hint="Número do imóvel. Se não tiver, escreva S/N.">
        <input autoComplete="address-line2" disabled={disabled} value={value.number} onChange={event => set('number', event.target.value)} placeholder="Nº ou S/N" />
      </FieldBlock>
      <FieldBlock title="Complemento" hint="Apto, casa, bloco, loja, fundos.">
        <input disabled={disabled} value={value.complement} onChange={event => set('complement', event.target.value)} placeholder="Apto, casa, loja" />
      </FieldBlock>
      <FieldBlock title="Bairro" hint="Bairro ou distrito.">
        <input autoComplete="address-level3" disabled={disabled} value={value.neighborhood} onChange={event => set('neighborhood', event.target.value)} placeholder="Bairro" />
      </FieldBlock>
      <FieldBlock title="Cidade" hint="Cidade do endereço.">
        <input autoComplete="address-level2" disabled={disabled} value={value.city} onChange={event => set('city', event.target.value)} placeholder="Cidade" />
      </FieldBlock>
    </div>
  );
}

export function NewClientView({ onSave, onCancel }: { onSave: (client: Client) => void; onCancel: () => void }) {
  const [signature, setSignature] = useState('');
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [sameAsHome, setSameAsHome] = useState(true);
  const [home, setHome] = useState<AddressFields>(emptyAddress);
  const [business, setBusiness] = useState<AddressFields>(emptyAddress);
  const [businessName, setBusinessName] = useState('');
  const [form, setForm] = useState({
    name: '', cpf: '', rg: '', phone: '', income: 0, birthDate: '', motherName: '', email: '', occupation: '',
  });
  const [refs, setRefs] = useState([emptyRef(), emptyRef(), emptyRef()]);
  const update = (key: string, value: string | number) => setForm(state => ({ ...state, [key]: value }));
  const updateRef = (index: number, key: string, value: string | boolean) => setRefs(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item));

  const setHomeAndMaybeBusiness = (next: AddressFields) => {
    setHome(next);
    if (sameAsHome) setBusiness(next);
  };

  const toggleSamePlace = (checked: boolean) => {
    setSameAsHome(checked);
    if (checked) setBusiness(home);
  };

  const capturePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    try { setPhoto(await compressImage(file)); } finally { setPhotoBusy(false); }
  };

  const attachDocument = (slot: string, file?: File) => {
    if (!file) return;
    setDocs(state => ({ ...state, [slot]: file.name }));
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
        const patch = {
          zip: data.postcode || home.zip,
          city: data.city || data.locality || home.city,
          state: (data.principalSubdivisionCode || data.principalSubdivision || home.state).replace('BR-', ''),
          neighborhood: neighborhood || home.neighborhood,
        };
        setHomeAndMaybeBusiness({ ...home, ...patch });
      } catch { /* keep coordinates even if reverse geocode fails */ }
    }, () => setGeoStatus('denied'), { enableHighAccuracy: true, timeout: 14000 });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const shop = sameAsHome ? home : business;
    const pin = digitsOnly(form.phone).slice(-4) || '2026';
    const documents = CLIENT_DOCUMENT_SLOTS.filter(slot => docs[slot]).map(slot => ({ label: slot, fileName: docs[slot] }));
    onSave({
      id: uid('cli'),
      name: form.name.trim() || 'Cliente sem nome',
      cpf: form.cpf,
      rg: form.rg,
      phone: form.phone,
      income: form.income,
      birthDate: form.birthDate,
      motherName: form.motherName,
      email: form.email,
      occupation: form.occupation,
      ...home,
      address: formatAddress(home),
      photo,
      location,
      locationConsent: geoStatus === 'granted',
      accessPin: pin,
      references: refs.filter(item => item.name.trim() || item.phone.trim()).map(item => ({ ...item, validated: false })),
      documents,
      signature,
      createdAt: new Date().toISOString().slice(0, 10),
      active: true,
      sameAsHome,
      businessName,
      businessZip: shop.zip,
      businessStreet: shop.street,
      businessNumber: shop.number,
      businessComplement: shop.complement,
      businessNeighborhood: shop.neighborhood,
      businessCity: shop.city,
      businessState: shop.state,
      businessAddress: formatAddress(shop),
    });
  };

  const filledDocs = Object.values(docs).filter(Boolean).length;

  return (
    <>
      <PageHeader eyebrow="CADASTRO" title="Cadastrar cliente" subtitle="Tudo numa tela só. Nenhum campo é obrigatório: salve o que tiver agora e complete depois." />
      <form className="form-card wide client-form" onSubmit={submit}>
        <div className="form-section-title">
          <span>1</span>
          <div>
            <h3>Dados e foto</h3>
            <p>Máscara no CPF, telefone e CEP. Preencha só o que quiser.</p>
          </div>
        </div>
        <div className="photo-capture">
          {photo ? <img src={photo} alt="Foto do cliente" /> : <span className="photo-placeholder">{photoBusy ? '…' : 'Foto'}</span>}
          <div>
            <b>Foto do cliente</b>
            <p>Câmera ou galeria. A foto fica neste aparelho, na ficha da pessoa.</p>
            <div className="photo-actions">
              <label className="primary-button file-button">Câmera<input type="file" accept="image/*" capture="environment" onChange={event => void capturePhoto(event.target.files?.[0])} /></label>
              <label className="secondary-button file-button">Galeria<input type="file" accept="image/*" onChange={event => void capturePhoto(event.target.files?.[0])} /></label>
              {photo && <button type="button" className="text-button" onClick={() => setPhoto('')}>Remover</button>}
            </div>
          </div>
        </div>
        <div className="form-grid">
          <FieldBlock className="span-2" title="Nome completo" hint="Como no documento. Se vazio, salva como Cliente sem nome.">
            <input autoComplete="name" value={form.name} onChange={event => update('name', event.target.value)} placeholder="Nome sem abreviações" />
          </FieldBlock>
          <FieldBlock title="CPF" hint="11 números. A pontuação entra sozinha.">
            <input inputMode="numeric" autoComplete="off" maxLength={14} value={form.cpf} onChange={event => update('cpf', formatCpf(event.target.value))} placeholder="000.000.000-00" />
          </FieldBlock>
          <FieldBlock title="RG" hint="Número do documento de identidade.">
            <input autoComplete="off" value={form.rg} onChange={event => update('rg', formatRg(event.target.value))} placeholder="00.000.000-0" />
          </FieldBlock>
          <FieldBlock title="Telefone / WhatsApp" hint="DDD + número. A máscara entra sozinha.">
            <input inputMode="tel" autoComplete="tel" maxLength={16} value={form.phone} onChange={event => update('phone', formatPhone(event.target.value))} placeholder="(00) 00000-0000" />
          </FieldBlock>
          <FieldBlock title="Data de nascimento" hint="Dia, mês e ano. Use o calendário do celular.">
            <input type="date" autoComplete="bday" value={form.birthDate} onChange={event => update('birthDate', event.target.value)} />
          </FieldBlock>
          <FieldBlock title="Nome da mãe" hint="Filiação, se tiver o dado.">
            <input autoComplete="off" value={form.motherName} onChange={event => update('motherName', event.target.value)} placeholder="Nome completo da mãe" />
          </FieldBlock>
          <FieldBlock title="E-mail" hint="Opcional. Serve para contato e recado.">
            <input type="email" autoComplete="email" value={form.email} onChange={event => update('email', event.target.value)} placeholder="email@exemplo.com" />
          </FieldBlock>
          <FieldBlock title="Profissão / ocupação" hint="O que a pessoa faz. Comércio, CLT, autônomo.">
            <input value={form.occupation} onChange={event => update('occupation', event.target.value)} placeholder="Comerciante, motorista, diarista" />
          </FieldBlock>
          <FieldBlock title="Renda mensal" hint="Valor aproximado em reais. Pode deixar zerado.">
            <MoneyInput value={form.income} onChange={value => update('income', value)} />
          </FieldBlock>
        </div>

        <div className="form-section-title">
          <span>2</span>
          <div>
            <h3>Endereço da casa e do comércio</h3>
            <p>Se for o mesmo lugar, marque a opção e o comércio copia a casa.</p>
          </div>
        </div>
        <div className="location-banner">
          <div>
            <b>Localização do celular</b>
            <p>{geoStatus === 'granted' ? 'Ponto salvo no mapa da ficha.' : geoStatus === 'denied' ? 'Permissão recusada. Pode seguir só com o endereço.' : 'Opcional. Captura o ponto no mapa se a pessoa permitir.'}</p>
          </div>
          <button type="button" className="outline-button" onClick={requestLocation} disabled={geoStatus === 'loading'}>{geoStatus === 'loading' ? 'Capturando…' : geoStatus === 'granted' ? 'Atualizar GPS' : 'Permitir localização'}</button>
        </div>
        {location && <iframe className="map-frame" title="Localização do cliente" src={mapEmbedUrl(location)} />}

        <h4 className="address-heading">Casa</h4>
        <AddressBlock value={home} onChange={setHomeAndMaybeBusiness} />

        <label className="toggle-line same-place">
          <input type="checkbox" checked={sameAsHome} onChange={event => toggleSamePlace(event.target.checked)} />
          <span>O comércio e a casa são o mesmo local. Marque para copiar o endereço da casa automaticamente.</span>
        </label>

        <h4 className="address-heading">Comércio</h4>
        <div className="form-grid">
          <FieldBlock className="span-2" title="Nome do comércio" hint="Loja, barraca, oficina ou o nome que a pessoa usa no ponto.">
            <input value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Nome do ponto comercial" />
          </FieldBlock>
        </div>
        <AddressBlock value={sameAsHome ? home : business} onChange={setBusiness} disabled={sameAsHome} />
        {sameAsHome && <p className="muted-note">Endereço do comércio igual ao da casa. Desmarque a opção acima se for outro lugar.</p>}

        <div className="form-section-title">
          <span>3</span>
          <div>
            <h3>Três referências de contato</h3>
            <p>Se tiver WhatsApp, o botão abre a conversa. Se não tiver, o botão liga. Pode deixar em branco.</p>
          </div>
        </div>
        <div className="reference-grid three">
          {refs.map((item, index) => (
            <div key={index}>
              <h4>Referência {index + 1}</h4>
              <label>Nome<input value={item.name} onChange={event => updateRef(index, 'name', event.target.value)} placeholder="Quem indica" /></label>
              <label>Parentesco / relação<input value={item.relation} onChange={event => updateRef(index, 'relation', event.target.value)} placeholder="Mãe, amigo, trabalho" /></label>
              <label>Telefone<input inputMode="tel" maxLength={16} value={item.phone} onChange={event => updateRef(index, 'phone', formatPhone(event.target.value))} placeholder="(00) 00000-0000" /></label>
              <label className="toggle-line"><input type="checkbox" checked={item.hasWhatsapp} onChange={event => updateRef(index, 'hasWhatsapp', event.target.checked)} /><span>Tem WhatsApp. Se desmarcar, o contato vira ligação.</span></label>
            </div>
          ))}
        </div>

        <div className="form-section-title">
          <span>4</span>
          <div>
            <h3>Documentos</h3>
            <p>10 anexos. Mande foto ou PDF no que tiver. {filledDocs} de 10 preenchidos.</p>
          </div>
        </div>
        <div className="document-slots">
          {CLIENT_DOCUMENT_SLOTS.map(slot => (
            <div className={`document-slot ${docs[slot] ? 'filled' : ''}`} key={slot}>
              <label>
                <input type="file" accept="image/*,.pdf" onChange={event => attachDocument(slot, event.target.files?.[0])} />
                <small>{slot}</small>
                <b>{docs[slot] ? docs[slot] : 'Anexar arquivo'}</b>
                {!docs[slot] && <em>Foto ou PDF</em>}
              </label>
              {docs[slot] && <button type="button" className="text-button" onClick={() => setDocs(state => ({ ...state, [slot]: '' }))}>Remover</button>}
            </div>
          ))}
        </div>

        <label className="standalone-label">Assinatura digital</label>
        <SignaturePad value={signature} onChange={setSignature} />
        <p className="save-note">Nada é obrigatório. O que preencher fica neste aparelho, inclusive o PIN de acesso (4 últimos dígitos do telefone, ou 2026 se não houver telefone).</p>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
          <button className="primary-button">Salvar cliente</button>
        </div>
      </form>
    </>
  );
}

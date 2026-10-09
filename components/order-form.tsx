'use client';
// Online ordering (spec 1.1–1.8): one dynamic form per service, a live price, a
// quotation PDF, and confirmation after signing in or creating an account.
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Upload,Plus,X,Check,FileText,Clock3,Bookmark,Globe2,ShieldCheck,ChevronLeft,Loader2,Download,Send,Mail,Truck,Stamp,Info} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Pick,Field,CheckField,YesNo,api,json,sectorIcons,uploadFile,downloadFrom} from './verba-ui';
import {AddressFields,PhoneField,CountrySelect} from './fields';
import Captcha from './captcha';
import {useT} from './i18n';
import {sectors,languages,services,urgencies,notaryTypes,formats,subjects,documentTypes,certificateTypes,extraServices,deliveryTimings,currencies,newOrder,newDocument,quote,money,orderSchema,basePricing,translates,isCertificate,notaryOptional,hasNotary,wordCount,MAX_FREE_TEXT_WORDS,normalizeOrder,type Order,type Service,type Pricing,type CustomerKind,type Level} from '@/lib/catalog';
import {orderRows} from '@/lib/order-text';
import {splitPhone} from '@/lib/geo';
const STORE='verba-order-v2';
type StepKey='details'|'documents'|'options'|'notary'|'delivery'|'courier'|'summary';
const stepsFor=(s:string):StepKey[]=>s==='Courier only'?['courier','summary']:s==='Notary only'?['notary','documents','delivery','summary']:s==='Additional services'?[]:['details','documents','options','summary'];
const stepNames:Record<StepKey,string>={details:'Project details',documents:'Documents',options:'Price & options',notary:'Notary service',delivery:'Arrival & delivery',courier:'Collection & delivery',summary:'Summary & confirmation'};
type Me={name:string;email:string;firstName:string;lastName:string;phone:string|null;company:string;country:string};

export default function OrderForm({embedded=false}:{embedded?:boolean}){
  const {t,lang}=useT();
  const [o,setO]=useState<Order>(()=>newOrder());
  const [step,setStep]=useState(0);
  const [draftId,setDraftId]=useState<string|null>(null);
  const [pricing,setPricing]=useState<Pricing>(basePricing);
  const [kind,setKind]=useState<CustomerKind>('new');
  const [me,setMe]=useState<Me|null>(null);const [checked,setChecked]=useState(false);
  const [captchaKey,setCaptchaKey]=useState<string|null>(null);const [captcha,setCaptcha]=useState('');
  const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState<number|null>(null);
  const [err,setErr]=useState('');const [success,setSuccess]=useState<{id:string;reference:string;status:string;inquiry?:boolean}|null>(null);
  const [fileNames,setFileNames]=useState<Record<string,string>>({});
  const top=useRef<HTMLDivElement>(null);
  const steps=stepsFor(o.service);const key=steps[step];
  const q=useMemo(()=>quote(o,pricing,kind),[o,pricing,kind]);
  const m=(cents:number)=>money(cents,o.currency,pricing,lang);
  const set=<K extends keyof Order>(k:K,v:Order[K])=>setO(x=>({...x,[k]:v}));
  const onCaptcha=useCallback((v:string)=>setCaptcha(v),[]);

  // Restores the visitor's draft (local storage) and the requested draft or service after hydration.
  useEffect(()=>{let alive=true;
    const draft=new URLSearchParams(location.search).get('draft');const service=new URLSearchParams(location.search).get('service');
    api('/api/workspace').then(w=>{if(!alive)return;setPricing(w.pricing);setKind(w.customerKind);const u=w.user;setMe({name:u.name,email:u.email,firstName:u.firstName,lastName:u.lastName,phone:u.phone,company:u.company,country:u.country});
      setO(x=>({...x,firstName:x.firstName||u.firstName,lastName:x.lastName||u.lastName,email:x.email||u.email,...(x.phone||!u.phone?{}:{phonePrefix:splitPhone(u.phone).prefix,phone:splitPhone(u.phone).number}),company:x.company||u.company||'',customerCountry:u.country||x.customerCountry,currency:x.currency==='EUR'&&u.currency?u.currency:x.currency}));}).catch(()=>{
      api('/api/public-config').then(p=>{if(alive){setPricing(p.pricing);setCaptchaKey(p.captcha);}}).catch(()=>{});
    }).finally(()=>alive&&setChecked(true));
    if(draft){api('/api/orders/'+draft).then(d=>{if(d.status!=='Draft'){setErr(t('This project is no longer a draft. Open it in the workspace.'));return;}setDraftId(String(d.id));setO(normalizeOrder(d.payload));setFileNames(Object.fromEntries((d.files as {id:string;name:string}[]).map(f=>[f.id,f.name])));}).catch(e=>setErr(t(e.message)));}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state read once on load
    else{try{const saved=localStorage.getItem(STORE);if(saved){const s=JSON.parse(saved);if(s&&Date.now()-s.at<7*86400000){setO(normalizeOrder(s.o));setStep(s.step||0);setFileNames(s.files||{});}}}catch{}
      if(service&&(services as readonly string[]).includes(service))changeService(service as Service);}
    return ()=>{alive=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on load
  },[]);
  useEffect(()=>{if(!checked||draftId)return;const id=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify({at:Date.now(),o,step,files:fileNames}));}catch{}},400);return ()=>clearTimeout(id);},[o,step,fileNames,checked,draftId]);
  useEffect(()=>{if(me||!checked)return;api('/api/auth/status').then(s=>setCaptchaKey(s.captcha)).catch(()=>{});},[me,checked]);

  function changeService(s:Service){setErr('');setStep(0);setO(x=>{const cert=isCertificate(s);const docs=x.documents.length?x.documents:[newDocument(1,cert)];
    return {...x,service:s,subject:cert?'Certificate':x.subject==='Certificate'?'Document':x.subject,level:s==='Document translation'?x.level:x.level==='Machine draft'?'Professional':x.level,
      documents:docs.map((d,i)=>cert&&!(certificateTypes as readonly string[]).includes(d.type)?{...d,type:'Birth certificate',name:d.name.startsWith('Document ')?`Certificate ${i+1}`:d.name}:!cert&&(certificateTypes as readonly string[]).includes(d.type)?{...d,type:'Document',name:d.name.startsWith('Certificate ')?`Document ${i+1}`:d.name}:d),
      collect:s==='Courier only'?true:x.collect,deliver:s==='Courier only'?true:x.deliver,notary:notaryOptional(s)?x.notary:false};});}
  function goto(n:number){setErr('');setStep(n);top.current?.scrollIntoView({behavior:'smooth',block:'start'});}
  function stepProblem(k:StepKey):string{
    if(k==='details'){if(!o.targets.length)return 'Choose at least one target language.';if(o.targets.includes(o.source))return 'Choose a target language different from the source.';}
    if(k==='documents'&&o.documents.some(d=>!d.name.trim()||d.pages<1||d.words<0||!Number.isFinite(d.pages)))return 'Add a document name and a valid page or word count.';
    if(k==='documents'&&!o.documents.length)return 'Add at least one document';
    if(k==='courier'&&!o.collect&&!o.deliver)return 'Choose collection, delivery or both';
    const r=orderSchema.safeParse({...o,firstName:o.firstName||'x',lastName:o.lastName||'x',email:o.email||'a@b.co'});
    if(['options','delivery','courier'].includes(k)&&!r.success){const issue=r.error.issues.find(i=>['pickup','dropoff','collect','level'].includes(String(i.path[0])));if(issue)return issue.message;}
    return '';
  }
  function next(){const p=stepProblem(key);if(p){setErr(t(p));return;}goto(Math.min(steps.length-1,step+1));}
  function setDocs(n:number){const cert=isCertificate(o.service);const count=Math.max(1,Math.min(20,Math.floor(n)||1));setO(x=>({...x,documents:count>x.documents.length?[...x.documents,...Array.from({length:count-x.documents.length},(_,i)=>newDocument(x.documents.length+i+1,cert))]:x.documents.slice(0,count)}));}
  function doc(i:number,patch:Partial<Order['documents'][number]>){setO(x=>({...x,documents:x.documents.map((d,j)=>i===j?{...d,...patch}:d)}));}
  async function upload(f:File,i:number){setErr('');setUploading(i);try{const r=await uploadFile(f);setFileNames(x=>({...x,[r.id]:r.name}));const ext=f.name.split('.').pop()?.toUpperCase();const format=(ext==='JPEG'?'JPG':ext) as Order['documents'][number]['format'];
      setO(x=>({...x,documents:x.documents.map((d,j)=>j===i?{...d,name:/^(Document|Certificate) \d+$/.test(d.name)?f.name:d.name,format:(formats as readonly string[]).includes(format)?format:d.format,fileIds:[...d.fileIds,r.id],...(r.stats&&r.stats.words>0?{words:(d.counted?d.words:0)+r.stats.words,pages:Math.max(1,(d.counted?d.pages:0)+r.stats.pages),counted:true}:{})}:d)}));
      toast.success(r.stats&&r.stats.words>0?t('Document uploaded. We counted {words} words on {pages} pages.',{words:r.stats.words.toLocaleString(),pages:r.stats.pages}):t('Document uploaded'));}
    catch(e){setErr(t((e as Error).message));}finally{setUploading(null);}}
  async function pdf(){setBusy(true);try{await downloadFrom('/api/quote/pdf','verba-quotation.pdf',json({payload:o,lang}));}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  async function save(submit:boolean){setErr('');const parsed=orderSchema.safeParse(o);if(!parsed.success){setErr(t(parsed.error.issues[0].message));return;}if(submit&&!o.agreed){setErr(t('Please accept the service terms before submitting.'));return;}if(!me){setErr(t('Sign in or create an account to save your quote or submit an order.'));return;}
    setBusy(true);try{const r=await api(draftId?'/api/orders/'+draftId:'/api/orders',json({payload:o,submit},draftId?'PUT':'POST'));setDraftId(String(r.id));setSuccess({id:String(r.id),reference:String(r.reference),status:String(r.status)});try{localStorage.removeItem(STORE);}catch{}toast.success(submit?t('Order submitted for review'):t('Quote saved'));}catch(e){setErr(t((e as Error).message));}finally{setBusy(false);}}
  async function sendInquiry(){setErr('');if(o.freeText.trim().length<3){setErr(t('Describe the service you need'));return;}if(wordCount(o.freeText)>MAX_FREE_TEXT_WORDS){setErr(t('Keep the description under {n} words',{n:MAX_FREE_TEXT_WORDS}));return;}
    if(!me){setErr(t('Sign in or create an account to send your request. Your text is kept on this device.'));return;}
    setBusy(true);try{const r=await api('/api/inquiries',json({extraType:o.extraType,description:o.description,freeText:o.freeText,captcha}));setSuccess({id:String(r.id),reference:'',status:'Sent',inquiry:true});try{localStorage.removeItem(STORE);}catch{}}catch(e){setErr(t((e as Error).message));}finally{setBusy(false);}}
  const reset=()=>{setO(newOrder());setDraftId(null);setStep(0);setFileNames({});};
  const returnTo=encodeURIComponent(embedded?'/studio?view=new':'/order');
  const urgencyLabel=(u:string)=>u==='Standard'?t('Standard'):t('{name} · +{pct}%',{name:t(u),pct:Math.round((u==='Priority'?pricing.priority:pricing.express)*100)});
  const levelText:Record<Level,string>={Professional:'Specialist translator with a human review workflow.',Student:'Supervised translation student; budget option for non-critical content.','Machine draft':'Unreviewed machine draft for reference only; not a certified translation.'};

  const serviceSelect=<div className="service-strip"><Pick label={t('Type of service')} value={o.service} onChange={v=>changeService(v as Service)} options={services.map(s=>({value:s,label:t(s)}))}/><p className="fine-print">{t({
    'Document translation':'Translation of any document, website or file, priced by words and pages.',
    'Translation + notary':'Document translation with a notarized certificate for the translated document.',
    'Translation validation':'Independent validation of a document that has already been translated.',
    'Certificate translation':'Translation of personal certificates, priced per page.',
    'Certificate + notary':'Certificate translation including notarization.',
    'Notary only':'Notarial services for documents you already have.',
    'Additional services':'Graphics, QA and other services that are not in sections 1 to 6.',
    'Courier only':'Courier service from point X to point Y.',
  }[o.service])}</p></div>;

  const languagesBlock=<><div className="two-col"><Pick label={t('Source language')} value={o.source} onChange={v=>setO(x=>({...x,source:v as Order['source'],targets:x.targets.filter(y=>y!==v)}))} options={languages.map(l=>({value:l,label:t(l)}))}/><Pick label={t('Add a target language')} value="choose" onChange={v=>v!=='choose'&&!o.targets.includes(v as Order['source'])&&o.targets.length<8&&set('targets',[...o.targets,v as Order['source']])} options={[{value:'choose',label:t('Choose language')},...languages.filter(l=>l!==o.source&&!o.targets.includes(l)).map(l=>({value:l,label:t(l)}))]}/></div>
    <div className="language-tags" aria-label={t('Target languages')}>{o.targets.map(l=><button type="button" key={l} onClick={()=>set('targets',o.targets.filter(x=>x!==l))}>{t(l)}<X size={13}/><span className="sr-only">{t('Remove target')}</span></button>)}{!o.targets.length&&<span>{t('Choose at least one target language.')}</span>}</div></>;

  const notaryBlock=(title=true)=><div className="subpanel">{title&&<h4><Stamp size={16}/>{t('Notarized certificate')}</h4>}<div className="two-col"><Pick label={t('Notarial type of service')} value={o.notaryType} onChange={v=>set('notaryType',v as Order['notaryType'])} options={notaryTypes.map(n=>({value:n,label:t(n)}))}/><Pick label={t('Number of copies')} value={String(o.copies)} onChange={v=>set('copies',Number(v))} options={Array.from({length:10},(_,i)=>({value:String(i+1),label:String(i+1)}))}/></div><div className="two-col"><Pick label={t('Notary urgency')} value={o.notaryUrgency} onChange={v=>set('notaryUrgency',v as Order['urgency'])} options={urgencies.map(u=>({value:u,label:urgencyLabel(u)}))}/><CountrySelect label={t('Country where the document will be used')} value={o.notaryCountry} onChange={v=>set('notaryCountry',v)}/></div><p className="fine-print">{t('Notarial fees follow the official price list of the destination country where one exists. Final fees are confirmed by the notary.')}</p></div>;

  const courierBlocks=(courierOnly:boolean)=><><div className="subpanel"><YesNo label={courierOnly?t('Requires collection (via courier)?'):t('Requires collection of your documents (via courier)?')} value={o.collect} onChange={v=>set('collect',v)}/>{o.collect&&<AddressFields idPrefix="pickup" value={o.pickup} onChange={a=>set('pickup',a)}/>}</div>
    <div className="subpanel"><YesNo label={courierOnly?t('Requires delivery (via courier)?'):t('Requires return of the documents (via courier)?')} value={o.deliver} onChange={v=>set('deliver',v)}/>{o.deliver&&<AddressFields idPrefix="dropoff" value={o.dropoff} onChange={a=>set('dropoff',a)}/>}</div>
    {(o.collect||o.deliver)&&<div className="two-col"><Pick label={t('Delivery timing')} value={o.timing} onChange={v=>set('timing',v as Order['timing'])} options={deliveryTimings.map(d=>({value:d,label:d==='Standard'?t('Standard'):t('{name} · +{price}',{name:t(d),price:m(Math.round((d==='Same day'?pricing.sameDay:pricing.nextDay)*100))})}))}/>{courierOnly&&<CheckField label={t('Round trip (2 way)')} checked={o.roundTrip} onChange={v=>set('roundTrip',v)}>{t('The courier returns the item to the starting point.')}</CheckField>}</div>}
    {(o.collect||o.deliver)&&<p className="fine-print"><Truck size={14}/> {q.international?t('International shipment: sent with {carrier}.',{carrier:t(q.carrier)}):t('Local shipment: handled by our couriers.')} {!courierOnly&&!o.collect&&t('You can also bring the documents to our office.')}</p>}</>;

  const docsBlock=<><div className="two-col"><Field label={isCertificate(o.service)?t('Number of certificates'):t('Number of documents')}><input type="number" min={1} max={20} value={o.documents.length} onChange={e=>setDocs(Number(e.target.value))}/></Field></div>
    {o.documents.map((d,i)=><div className="document-card" key={i}><div className="document-heading"><b><FileText size={17}/>{isCertificate(o.service)?t('Certificate {n}',{n:i+1}):t('Document {n}',{n:i+1})}</b>{o.documents.length>1&&<button type="button" aria-label={t('Remove document')} onClick={()=>set('documents',o.documents.filter((_,j)=>i!==j))}><X size={16}/></button>}</div>
      <div className="two-col"><Field label={isCertificate(o.service)?t('Document name'):t('Document name')}><input value={d.name} onChange={e=>doc(i,{name:e.target.value})} maxLength={160}/></Field><Pick label={isCertificate(o.service)?t('Certificate type'):t('Document type')} value={d.type} onChange={v=>doc(i,{type:v})} options={(isCertificate(o.service)?certificateTypes:documentTypes).map(x=>({value:x,label:t(x)}))}/></div>
      <div className="doc-numbers">{isCertificate(o.service)&&<Field label={t('Identical certificates')} hint={t('Several identical certificates (for example, the same certificate for each family member) can be ordered together.')}><input type="number" min={1} max={50} value={d.quantity} onChange={e=>doc(i,{quantity:Math.max(1,Number(e.target.value)||1)})}/></Field>}<Field label={isCertificate(o.service)?t('Number of pages (up to 250 words per page)'):t('Number of pages')}><input type="number" min={1} max={10000} value={d.pages} onChange={e=>doc(i,{pages:Number(e.target.value),counted:false})}/></Field>{o.service!=='Notary only'||o.notaryType==='Translation certification'?<Field label={t('Number of words')} hint={t('0 = estimate by pages (1 page = 250 words)')}><input type="number" min={0} max={1000000} value={d.words} onChange={e=>doc(i,{words:Number(e.target.value),counted:false})}/></Field>:null}<Pick label={t('File format')} value={d.format} onChange={v=>doc(i,{format:v as typeof d.format})} options={formats.map(f=>({value:f,label:f}))}/></div>
      {d.counted&&<p className="counted"><Check size={14}/>{t('Words and pages were counted from your file.')}</p>}
      <label className="upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)void upload(f,i);}}>{uploading===i?<Loader2 className="spin"/>:<Upload size={23}/>}<strong>{uploading===i?t('Uploading and checking…'):t('Upload file')}</strong><span>{t('PDF, DOCX, TXT, JPG, PNG · up to 10 MB · scanned for scripts')}</span><input className="sr-only" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" disabled={uploading!==null||d.fileIds.length>=10} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],i);e.target.value='';}}/></label>
      {d.fileIds.map(id=><div className="uploaded-file" key={id}><FileText size={15}/><span>{fileNames[id]||t('Uploaded document')}</span><Check size={15}/><button type="button" aria-label={t('Remove attachment')} onClick={()=>doc(i,{fileIds:d.fileIds.filter(f=>f!==id)})}><X size={14}/></button></div>)}
    </div>)}
    <button type="button" className="button secondary" disabled={o.documents.length>=20} onClick={()=>setDocs(o.documents.length+1)}><Plus size={16}/>{t('Add another document')}</button>
    <p className="fine-print">{t('Uploading is optional: you can estimate first. An exact quote is given after your files are analysed. One page = 250 words.')}</p></>;

  const priceCards=q.levels.length>0&&<div className="level-cards" role="radiogroup" aria-label={t('Rated price')}>{q.levels.map(l=>{const disabled=o.sector==='Medical'&&l.level!=='Professional';return <div key={l.level} role="radio" tabIndex={0} aria-checked={o.level===l.level} aria-disabled={disabled} className={'level-card'+(o.level===l.level?' active':'')+(disabled?' disabled':'')} onClick={()=>!disabled&&set('level',l.level)} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!disabled){e.preventDefault();set('level',l.level);}}}>
    <strong>{t(l.level==='Machine draft'?'Machine translation':l.level+' translation')}</strong><small>{t(levelText[l.level])}</small><span className="level-days">{t('Delivery')} · {t('{n} business days',{n:l.days})}</span><span className="level-price">{m(Math.round(l.translation*100))}</span>
    {l.level!=='Machine draft'&&<label className="level-validation" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={o.validation} onChange={e=>set('validation',e.target.checked)}/>{t('Validation')} +{m(Math.round(l.validation*100))}</label>}
    {disabled&&<em>{t('Medical documents require the professional workflow')}</em>}</div>;})}</div>;

  const summary=<><div className="section-heading"><h3>{t('Order summary')}</h3><p>{t('Check the details. No payment is taken at this stage.')}</p></div>
    <table className="summary-table"><tbody>{orderRows(o,q,t,lang).map(([k,v])=><tr key={k}><th>{k}</th><td>{v}</td></tr>)}{q.lines.map(l=><tr key={l.key} className="price-row"><th>{t(l.label)}</th><td>{m(Math.round(l.amount*100))}</td></tr>)}<tr className="total-row"><th>{t('Total')}</th><td>{m(q.total)}</td></tr></tbody></table>
    <div className="button-group"><button type="button" className="button secondary" disabled={busy} onClick={pdf}><Download size={15}/>{t('Quotation summary (PDF)')}</button>{draftId&&me&&<button type="button" className="button secondary" disabled={busy} onClick={async()=>{try{const r=await api('/api/orders/'+draftId+'/email',json({}));toast.success(r.sent?t('We emailed you a copy of the quote.'):t('Email is not connected yet. Download the PDF instead.'));}catch(e){toast.error(t((e as Error).message));}}}><Mail size={15}/>{t('Email me this quote')}</button>}</div>
    <div className="section-heading"><h3>{t('Your details')}</h3></div>
    <div className="two-col"><Field label={t('First name')}><input value={o.firstName} onChange={e=>set('firstName',e.target.value)} autoComplete="given-name" maxLength={60}/></Field><Field label={t('Last name')}><input value={o.lastName} onChange={e=>set('lastName',e.target.value)} autoComplete="family-name" maxLength={60}/></Field></div>
    <div className="two-col"><Field label={t('Email address')}><input type="email" value={o.email} onChange={e=>set('email',e.target.value)} autoComplete="email" maxLength={254}/></Field><PhoneField label={t('Phone number')} prefix={o.phonePrefix} number={o.phone} onChange={(p,n)=>setO(x=>({...x,phonePrefix:p,phone:n}))}/></div>
    <div className="two-col"><Field label={t('Company (optional)')}><input value={o.company} onChange={e=>set('company',e.target.value)} autoComplete="organization" maxLength={120}/></Field><CountrySelect label={t('Country of the work request')} value={o.customerCountry} onChange={v=>set('customerCountry',v)}/></div>
    {o.service!=='Courier only'&&<Field label={t('Instructions or special requirements')}><textarea rows={3} value={o.notes} maxLength={4000} onChange={e=>set('notes',e.target.value)} placeholder={t('Preferred terminology, intended use, country of submission…')}/></Field>}
    <CheckField label={t('I accept the order terms and the company’s policy')} checked={o.agreed} onChange={v=>set('agreed',v)}>{t('I understand that this is an estimate and that scope, timing and final fees require confirmation.')} <a href="/terms" target="_blank">{t('Read terms')}</a> · <a href="/privacy" target="_blank">{t('Privacy notice')}</a></CheckField>
    {!me&&checked&&<div className="signin-box"><ShieldCheck size={20}/><div><strong>{t('Sign in or create an account to confirm')}</strong><p>{t('Your order details stay on this device while you sign in.')}</p><div className="button-group"><a className="button primary" href={'/account?mode=register&return_to='+returnTo}>{t('Create an account')}</a><a className="button secondary" href={'/account?return_to='+returnTo}>{t('Sign in')}</a></div></div></div>}
    {me&&<div className="inline-note"><Info size={18}/><span>{t('Payment is requested after our team reviews your order. You will receive an email confirmation.')}</span></div>}</>;

  if(o.service==='Additional services')return <div className="quote-surface" ref={top}><Heading t={t}/>{serviceSelect}<div className="quote-layout single"><div className="quote-work"><div className="step-body">
    <div className="section-heading"><h3>{t('Ordering additional services')}</h3><p>{t('Receiving additional services that are not in sections 1 to 6. Our team will contact you with a quote.')}</p></div>
    <Pick label={t('Type of service')} value={o.extraType} onChange={v=>set('extraType',v as Order['extraType'])} options={extraServices.map(x=>({value:x,label:t(x)}))}/>
    <Field label={t('Description')}><input value={o.description} maxLength={160} onChange={e=>set('description',e.target.value)}/></Field>
    <Field label={t('Free text')}><textarea rows={8} value={o.freeText} maxLength={5000} onChange={e=>set('freeText',e.target.value)}/></Field>
    <p className={'fine-print'+(wordCount(o.freeText)>MAX_FREE_TEXT_WORDS?' over':'')}>{t('{n} of {max} words',{n:wordCount(o.freeText),max:MAX_FREE_TEXT_WORDS})}</p>
    <Captcha siteKey={me?null:captchaKey} onToken={onCaptcha}/>
    {!me&&checked&&<div className="signin-box"><ShieldCheck size={20}/><div><strong>{t('Sign in or create an account to send your request')}</strong><p>{t('Your text is kept on this device while you sign in.')}</p><div className="button-group"><a className="button primary" href={'/account?mode=register&return_to='+returnTo}>{t('Create an account')}</a><a className="button secondary" href={'/account?return_to='+returnTo}>{t('Sign in')}</a></div></div></div>}
    {err&&<div role="alert" className="error-box">{err}</div>}
    <div className="step-actions"><span/><button type="button" className="button primary" disabled={busy||!me} onClick={sendInquiry}><Send size={15}/>{busy?t('Sending…'):t('Send')}</button></div>
  </div></div></div>{successDialog()}</div>;

  return <div className="quote-surface" ref={top}><Heading t={t}/>{serviceSelect}<div className="quote-layout"><div className="quote-work">
    <nav className="stepper" aria-label={t('Order steps')}>{steps.map((s,i)=><button type="button" key={s} className={step===i?'current':step>i?'done':''} onClick={()=>i<step&&goto(i)} disabled={i>step}><span>{step>i?<Check size={14}/>:i+1}</span><b>{t(stepNames[s])}</b></button>)}</nav>
    <div className="step-body">
      {key==='details'&&<><div className="section-heading"><h3>{t('What are we working on?')}</h3><p>{t('A little context helps shape the right service.')}</p></div>
        <div className="field-label sector-label">{t('Translation field')}</div><div className="sector-picker">{sectors.map(s=>{const Icon=sectorIcons[s];return <button type="button" key={s} aria-pressed={o.sector===s} className={'sector-option '+(o.sector===s?'selected':'')} onClick={()=>setO(x=>({...x,sector:s,level:s==='Medical'?'Professional':x.level}))}><Icon size={23}/><span>{t(s)}</span>{o.sector===s&&<span className="sector-check"><Check size={11}/></span>}</button>;})}</div>
        <div className="two-col"><Pick label={t('What is translated?')} value={o.subject} onChange={v=>set('subject',v as Order['subject'])} options={subjects.map(s=>({value:s,label:t(s)}))}/><Field label={t('Project name (optional)')}><input value={o.title} onChange={e=>set('title',e.target.value)} maxLength={160}/></Field></div>
        <Field label={t('Document description')}><textarea rows={2} value={o.description} maxLength={2000} onChange={e=>set('description',e.target.value)} placeholder={t('e.g. Discharge summary and lab results for a hospital abroad')}/></Field>
        {languagesBlock}
        {o.sector==='Medical'&&<div className="inline-note"><ShieldCheck size={18}/><span>{t('Medical projects follow a professional review workflow.')}</span></div>}</>}
      {key==='documents'&&<><div className="section-heading"><h3>{t('Give every document a home.')}</h3><p>{t('Upload now, or enter the details to estimate first.')}</p></div>{docsBlock}</>}
      {key==='options'&&<><div className="section-heading"><h3>{t('Rated price')}</h3><p>{o.service==='Translation validation'?t('Validation of an existing translation, priced by words.'):t('Choose the translation level. Prices are for your documents and languages.')}</p></div>
        {priceCards}{o.service==='Translation validation'&&<div className="level-cards"><div className="level-card active"><strong>{t('Validation')}</strong><small>{t('A second linguist checks the translation against the source.')}</small><span className="level-price">{m(Math.round(q.base*100))}</span></div></div>}
        <div className="two-col"><Pick label={t('Urgency')} value={o.urgency} onChange={v=>set('urgency',v as Order['urgency'])} options={urgencies.map(u=>({value:u,label:urgencyLabel(u)}))}/><CheckField label={t('Layout and formatting (DTP)')} checked={o.dtp} onChange={v=>set('dtp',v)}>{t('Keep fonts, colours and layout as in the original (+{price} per page).',{price:m(Math.round(pricing.dtpPage*100))})}</CheckField></div>
        {notaryOptional(o.service)&&<YesNo label={t('Notarized certificate required?')} value={o.notary} onChange={v=>set('notary',v)}/>}
        {hasNotary(o)&&notaryBlock()}
        {courierBlocks(false)}</>}
      {key==='notary'&&<><div className="section-heading"><h3>{t('Ordering notary services')}</h3><p>{t('Notarization for documents you already have.')}</p></div>{notaryBlock(false)}</>}
      {key==='delivery'&&<><div className="section-heading"><h3>{t('How will the documents reach the notary?')}</h3></div><CheckField label={t('I will arrive physically')} checked={o.physical} onChange={v=>setO(x=>({...x,physical:v,collect:v?false:x.collect}))}>{t('Depending on the document, the law may require you to attend in person.')}</CheckField>{courierBlocks(false)}</>}
      {key==='courier'&&<><div className="section-heading"><h3>{t('Ordering courier services')}</h3><p>{t('Receiving courier services from point X to point Y.')}</p></div>{courierBlocks(true)}<CheckField label={t('I need an invoice')} checked={o.invoice} onChange={v=>set('invoice',v)}/><p className="fine-print">{t('Shipping notes: the total weight should not exceed 2 kg and the envelope should not exceed A4 size.')}</p></>}
      {key==='summary'&&summary}
      {err&&<div role="alert" className="error-box">{err}</div>}
      <div className="step-actions">{step>0?<button type="button" className="button text-button" onClick={()=>goto(step-1)}><ChevronLeft size={16} className="flip-rtl"/>{t('Back')}</button>:<span className="no-account">{t('No account needed to estimate')}</span>}
        {key!=='summary'?<button type="button" className="button primary" onClick={next}>{t('Continue')}</button>:<div className="button-group"><button type="button" className="button secondary" disabled={busy||!me} onClick={()=>save(false)}><Bookmark size={15}/>{t('Save quote')}</button><button type="button" className="button primary" disabled={busy||!me} onClick={()=>save(true)}>{busy?t('Saving…'):t('Confirm order')}</button></div>}</div>
    </div></div>
    <aside className="quote-summary"><div className="summary-top"><span className="small-kicker">{t('YOUR ESTIMATE')}</span><Pick label={t('Currency')} value={o.currency} onChange={v=>set('currency',v as Order['currency'])} options={currencies.map(c=>({value:c,label:c}))}/></div>
      <div className="price">{m(q.total)}</div><p className="price-caption">{t('Indicative estimate · before applicable tax')}</p><div className="summary-divider"/>
      {translates(o.service)&&<div className="summary-project"><span className="summary-icon"><Globe2 size={21}/></span><div><strong>{t('{from} → {to}',{from:t(o.source),to:o.targets.length?o.targets.map(x=>t(x)).join(', '):'…'})}</strong><small>{t(o.sector)} · {t('{n} words',{n:q.words.toLocaleString()})}</small></div></div>}
      <dl className="price-lines">{q.lines.map(l=><div key={l.key}><dt>{t(l.label)}</dt><dd>{m(Math.round(l.amount*100))}</dd></div>)}</dl>
      <div className="summary-timing"><Clock3 size={17}/><div><strong>{t('{n} business days requested',{n:q.days})}</strong><small>{t('Confirmed after document review')}</small></div></div>
      {kind!=='new'&&<p className="fine-print">{kind==='organization'?t('Organization rates applied.'):t('Returning customer rates applied.')}</p>}
      <div className="summary-bottom"><Check size={16}/><span>{t('No charge until you approve the final scope.')}</span></div>
      <p className="fine-print">{t('Prices are calculated in EUR. Other currencies use reference exchange rates.')}</p>
    </aside></div>{successDialog()}</div>;

  function successDialog(){return <Dialog open={!!success} onOpenChange={v=>{if(!v){if(success?.status!=='Draft')reset();setSuccess(null);}}}><DialogContent className="success-dialog"><span className="success-check"><Check size={28}/></span><DialogTitle>{success?.inquiry?t('Your request was sent.'):success?.status==='Draft'?t('Your quote is saved.'):t('Your order was received.')}</DialogTitle><DialogDescription>{success?.inquiry?t('Our team will contact you soon. You can follow the conversation in your workspace.'):`${success?.reference} · ${success?.status==='Draft'?t('Return whenever you’re ready.'):t('We sent a confirmation. Payment is requested after review.')}`}</DialogDescription>
    <div className="button-group">{!success?.inquiry&&<button type="button" className="button secondary" onClick={()=>downloadFrom('/api/orders/'+success?.id+'/pdf?lang='+lang,(success?.reference||'order')+'.pdf').catch(e=>toast.error(t(e.message)))}><Download size={15}/>{t('Download order details')}</button>}<a className="button primary" href={success?.inquiry?'/studio?view=support':'/studio?order='+success?.id}>{success?.inquiry?t('Open customer service'):t('Open my order')}</a></div></DialogContent></Dialog>;}
}
function Heading({t}:{t:(s:string)=>string}){return <div className="quote-title"><div><span className="small-kicker">{t('LET’S MAKE IT CLEAR')}</span><h2>{t('Create a new order.')}</h2></div><span className="quiet-tag"><Clock3 size={15}/>{t('A few minutes to get started')}</span></div>;}

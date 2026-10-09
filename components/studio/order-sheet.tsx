'use client';
import {useCallback,useEffect,useState} from 'react';
import {Download,FileText,Upload,MessageCircle,Mail,Loader2} from 'lucide-react';
import {toast} from 'sonner';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Skeleton} from '@/components/ui/skeleton';
import {Pick,Field,CheckField,Empty,Pill,api,json,uploadFile,downloadFrom,date} from '../verba-ui';
import {useT} from '../i18n';
import {money,quote,paymentStates,hasCourier,hasNotary,translates} from '@/lib/catalog';
import {orderRows} from '@/lib/order-text';
import type {OrderDetail,WorkspaceInfo} from './types';
const statusNext:Record<string,string[]>={Draft:['Submitted','Cancelled'],Submitted:['In review','Cancelled'],'In review':['Translating','Notary review','Ready','Cancelled'],Translating:['Notary review','Ready','Cancelled'],'Notary review':['Ready','Cancelled'],Ready:['Delivered','In review'],Delivered:[],Cancelled:[]};
const shipmentSteps=['Awaiting assignment','Assigned','Collected','In transit','Delivered'];
export default function OrderSheet({id,ws,onClose,onChanged}:{id:string|null;ws:WorkspaceInfo;onClose:()=>void;onChanged:()=>void}){
  const {t,lang}=useT();
  const [o,setO]=useState<OrderDetail|null>(null);const [busy,setBusy]=useState(false);const [tab,setTab]=useState('details');const [message,setMessage]=useState('');const [consent,setConsent]=useState(false);
  const staff=ws.role==='admin'||ws.role==='staff';const me=ws.user.email;
  const load=useCallback(async(oid:string)=>{try{setO(await api('/api/orders/'+oid) as OrderDetail);}catch(e){toast.error(t((e as Error).message));onClose();}},[t,onClose]);
  const [shownId,setShownId]=useState(id);
  if(shownId!==id){setShownId(id);setO(null);setTab('details');setConsent(false);}
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading: state changes after the request finishes
  useEffect(()=>{if(id)void load(id);},[id,load]);
  useEffect(()=>{if(!id||tab!=='messages')return;const timer=setInterval(()=>void load(id),5000);return ()=>clearInterval(timer);},[id,tab,load]);
  async function update(p:Record<string,unknown>){if(!o)return;setBusy(true);try{await api('/api/orders/'+o.id,json(p,'PATCH'));await load(o.id);onChanged();toast.success(t('Order updated'));}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  async function send(){if(!o||!message.trim())return;setBusy(true);try{await api('/api/messages',json({orderId:o.id,body:message}));setMessage('');await load(o.id);}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  async function upload(f:File,purpose:string){if(!o)return;setBusy(true);try{await uploadFile(f,{orderId:o.id,purpose});await load(o.id);toast.success(t('File saved to the order'));}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  const p=o?.payload;
  const q=p?quote(p,ws.pricing):null;
  const people=(roles:string[])=>[{value:'unassigned',label:t('Unassigned')},...ws.members.filter(m=>roles.includes(m.role)&&m.active).map(m=>({value:m.email,label:m.name}))];
  const canStatus=(s:string)=>staff||(ws.role==='notary'&&o?.assignee===me&&s==='Ready')||(ws.role==='vendor'&&o?.vendor===me&&['Notary review','Ready'].includes(s))||(o?.owner&&ws.role==='customer'&&['Submitted','Cancelled'].includes(s));
  const canDeliver=staff||(ws.role==='notary'&&o?.assignee===me)||(ws.role==='vendor'&&o?.vendor===me);
  return <Sheet open={!!id} onOpenChange={v=>{if(!v)onClose();}}><SheetContent className="project-sheet" side={lang==='he'?'left':'right'}>{!o||!p||!q?<><SheetHeader><SheetTitle>{t('Loading order')}</SheetTitle><SheetDescription>{t('Retrieving files and activity.')}</SheetDescription></SheetHeader><Skeleton className="h-72 m-6"/></>:<>
    <SheetHeader><div className="sheet-kicker">{o.reference}<Pill>{o.status}</Pill></div><SheetTitle>{p.title}</SheetTitle><SheetDescription>{t(p.service)}{translates(p.service)?' · '+t(p.sector):''}</SheetDescription></SheetHeader>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="sheet-tabs"><TabsTrigger value="details">{t('Details')}</TabsTrigger>{ws.role!=='courier'&&<><TabsTrigger value="files">{t('Files')} ({o.files.length})</TabsTrigger><TabsTrigger value="messages">{t('Messages')}</TabsTrigger><TabsTrigger value="activity">{t('Activity')}</TabsTrigger></>}</TabsList>
      <TabsContent value="details" className="sheet-section">
        {ws.role!=='courier'&&<div className="detail-price"><span>{t('Order total')}</span><strong>{money(o.total,p.currency,ws.pricing,lang)}</strong><small>{t('Before applicable tax')} · {t('Payment')}: {t(o.payment)}</small></div>}
        <dl className="detail-list"><dt>{t('Customer')}</dt><dd>{p.name}{p.company?` · ${p.company}`:''}</dd><dt>{t('Email')}</dt><dd>{p.email}</dd><dt>{t('Phone')}</dt><dd dir="ltr">{[p.phonePrefix,p.phone].filter(Boolean).join(' ')||'—'}</dd><dt>{t('Created')}</dt><dd>{date(o.created,lang)}</dd><dt>{t('Delivery date of the project')}</dt><dd>{date(o.due_date,lang)}</dd>
          {ws.role!=='courier'&&orderRows(p,q,t,lang).map(([k,v])=><div key={k} className="contents"><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {p.notes&&<div className="subpanel"><h4>{t('Instructions')}</h4><p className="preserve-lines">{p.notes}</p></div>}
        {staff&&<div className="subpanel"><h4>{t('Management')}</h4><div className="two-col"><Pick label={t('Payment')} value={o.payment} onChange={v=>update({payment:v})} options={paymentStates.map(s=>({value:s,label:t(s)}))}/><Field label={t('Delivery date of the project')}><input type="date" value={o.due_date||''} onChange={e=>update({dueDate:e.target.value||null})}/></Field></div>
          {translates(p.service)&&<Pick label={t('Assigned translator / editor')} value={o.vendor||'unassigned'} onChange={v=>update({vendor:v==='unassigned'?null:v})} options={people(['vendor','staff','admin'])}/>}
          {hasNotary(p)&&<Pick label={t('Assigned notary')} value={o.assignee||'unassigned'} onChange={v=>update({assignee:v==='unassigned'?null:v})} options={people(['notary','admin'])}/>}
          <p className="fine-print">{t('Payment collection is not connected yet: record payments here manually. Marking an order as paid notifies the customer and sends it to the main system when connected.')}</p></div>}
        {hasCourier(p)&&<div className="subpanel"><h4>{t('Collection & delivery')}</h4><Pill>{o.shipment}</Pill>{staff&&<Pick label={t('Assigned courier')} value={o.courier||'unassigned'} onChange={v=>update({courier:v==='unassigned'?null:v})} options={people(['courier','admin'])}/>}
          {(staff||(ws.role==='courier'&&o.courier===me))&&shipmentSteps.includes(o.shipment)&&o.shipment!=='Delivered'&&o.courier&&<button className="button secondary small" disabled={busy} onClick={()=>update({shipment:shipmentSteps[shipmentSteps.indexOf(o.shipment)+1]})}>{t('Mark as {step}',{step:t(shipmentSteps[shipmentSteps.indexOf(o.shipment)+1])})}</button>}</div>}
        {o.status==='Draft'&&o.owner&&<><CheckField label={t('Accept the order terms to submit')} checked={consent} onChange={setConsent}>{t('This estimate requires review.')} <a href="/terms" target="_blank">{t('Read terms')}</a></CheckField><a className="button secondary" href={'/order?draft='+o.id}>{t('Edit this quote')}</a></>}
        <div className="detail-actions">{(statusNext[o.status]||[]).filter(canStatus).map(s=><button key={s} disabled={busy||(s==='Submitted'&&!consent)} className={'button small '+(s==='Cancelled'?'danger':'primary')} onClick={()=>{if(s==='Cancelled'&&!window.confirm(t('Cancel this order? This closes the order.')))return;void update(s==='Submitted'?{status:s,agreed:consent}:{status:s});}}>{s==='Cancelled'?t('Cancel order'):s==='Submitted'?t('Submit for review'):t('Mark as {step}',{step:t(s)})}</button>)}</div>
        {ws.role!=='courier'&&<div className="button-group sheet-downloads"><button className="button secondary small" onClick={()=>downloadFrom(`/api/orders/${o.id}/pdf?lang=${lang}`,o.reference+'.pdf').catch(e=>toast.error(t(e.message)))}><Download size={15}/>{t('Order details (PDF)')}</button><button className="button secondary small" disabled={busy} onClick={async()=>{try{const r=await api('/api/orders/'+o.id+'/email',json({}));toast.success(r.sent?t('A copy was emailed to the customer.'):t('Email is not connected yet. Download the PDF instead.'));}catch(e){toast.error(t((e as Error).message));}}}><Mail size={15}/>{t('Email a copy of the quote')}</button></div>}
      </TabsContent>
      <TabsContent value="files" className="sheet-section"><h3>{t('Order documents')}</h3><p className="muted">{t('Source files and translated files. Print or download them to your computer.')}</p>
        {o.files.length?o.files.map(f=><div className="file-row" key={f.id}><FileText size={21}/><div><strong>{f.name}</strong><small>{f.purpose==='delivery'?t('Translated file'):t('Source file')} · {(f.size/1024).toFixed(0)} KB</small></div><a href={'/api/files/'+f.id} className="icon-button" aria-label={t('Download {name}',{name:f.name})}><Download size={18}/></a></div>):<Empty title={t('No files yet')} text={t('Upload source documents to begin the review.')}/>}
        <label className="button secondary upload-button">{busy?<Loader2 className="spin" size={16}/>:<Upload size={16}/>}{t('Upload source file')}<input type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" disabled={busy} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],'source');e.target.value='';}}/></label>
        {canDeliver&&<label className="button primary upload-button"><Upload size={16}/>{t('Upload translated file')}<input type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" disabled={busy} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],'delivery');e.target.value='';}}/></label>}
        <p className="fine-print">{t('Up to 10 MB. Files are checked for scripts and active content.')}</p></TabsContent>
      <TabsContent value="messages" className="sheet-section"><h3>{t('One conversation. All the context.')}</h3><p className="muted">{t('For the customer, company staff and the assigned specialists. New messages appear automatically.')}</p>
        <div className="message-list">{o.messages.length?o.messages.map(m=><div key={m.id} className={'message '+(m.sender===me?'own':'')}><div><strong>{m.name}</strong><small>{new Date(m.created).toLocaleString(lang==='he'?'he-IL':'en-GB')}</small></div><p>{m.body}</p></div>):<Empty title={t('Start the conversation')} text={t('Ask a question or add context for the order team.')}/>}</div>
        <Field label={t('Message')}><textarea rows={4} value={message} maxLength={4000} onChange={e=>setMessage(e.target.value)}/></Field><button className="button primary" disabled={busy||!message.trim()} onClick={send}><MessageCircle size={16}/>{t('Send message')}</button></TabsContent>
      <TabsContent value="activity" className="sheet-section"><h3>{t('Order history')}</h3><div className="timeline">{o.events.map((ev,i)=><div key={i}><span/><section><strong>{ev.action}</strong><small>{ev.actor}</small><time>{new Date(ev.created).toLocaleString(lang==='he'?'he-IL':'en-GB')}</time></section></div>)}</div></TabsContent>
    </Tabs></>}</SheetContent></Sheet>;
}

'use client';
// Delivery area (spec 1.9–1.13): shipments, courier cards, customer cards, delivery
// reports and the courier's own area.
import {useEffect,useMemo,useState} from 'react';
import {Plus,Save,RefreshCw,XCircle,PauseCircle,Truck,UserPlus,Link2} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Pick,Field,CheckField,Pill,Empty,api,json,date} from '../verba-ui';
import {AddressFields} from '../fields';
import {useT} from '../i18n';
import {money,addressLine,urgencies,blankAddress,type Address} from '@/lib/catalog';
import DataTable,{type Column} from './data-table';
import type {ShipmentView,WorkspaceInfo,MemberInfo} from './types';
const steps=['Awaiting assignment','Assigned','Collected','In transit','Delivered'];
const where=(a:Address)=>[a.city,[a.street,a.number].filter(Boolean).join(' ')].filter(Boolean).join(', ');
type Form={customerName:string;customerPhone:string;urgency:string;sameDay:boolean;nextDay:boolean;deliveryDate:string;type:string;operator:string;courier:string;returnCourier:string;origin:Address;destination:Address;sum:number;notes:string;tracking:string};
const toForm=(s?:ShipmentView):Form=>s?{customerName:s.customer_name,customerPhone:s.customer_phone,urgency:s.urgency,sameDay:!!s.same_day,nextDay:!!s.next_day,deliveryDate:s.delivery_date||'',type:s.type,operator:s.operator,courier:s.courier||'',returnCourier:s.return_courier||'',origin:s.origin,destination:s.destination,sum:s.sum/100,notes:s.notes,tracking:s.tracking}:{customerName:'',customerPhone:'',urgency:'Standard',sameDay:false,nextDay:false,deliveryDate:'',type:'1 way',operator:'',courier:'',returnCourier:'',origin:{...blankAddress},destination:{...blankAddress},sum:0,notes:'',tracking:''};

export function shipmentColumns(t:(s:string,v?:Record<string,string|number>)=>string,lang:string,ws:WorkspaceInfo,withCourier=true):Column<ShipmentView>[]{
  const name=(e:string|null)=>ws.members.find(m=>m.email===e)?.name||e||'';
  return [
    {key:'status',label:t('Status'),value:s=>t(s.status),render:s=><Pill>{s.status}</Pill>,filter:'select'},
    {key:'date',label:t('Delivery date'),value:s=>s.delivery_date?date(s.delivery_date,lang):s.same_day?t('Same day'):s.next_day?t('Next day'):'—'},
    {key:'urgency',label:t('Urgency'),value:s=>t(s.urgency),filter:'select'},
    {key:'customer',label:t('Customer name'),value:s=>s.customer_name},
    {key:'order',label:t('Order number'),value:s=>s.orderReference||s.reference},
    {key:'pickup',label:t('Pickup address'),value:s=>where(s.origin)},
    {key:'delivery',label:t('Delivery address'),value:s=>where(s.destination)},
    {key:'type',label:t('Type of delivery'),value:s=>t(s.type),filter:'select'},
    {key:'operator',label:t('Operating company'),value:s=>t(s.operator),filter:'select'},
    ...(withCourier?[{key:'courier',label:t('Courier'),value:(s:ShipmentView)=>name(s.courier),filter:'select'} as Column<ShipmentView>]:[]),
    {key:'sum',label:t('Sum'),value:s=>money(s.sum,'EUR',ws.pricing,lang),align:'end'},
  ];
}
// Edit form under the table: Save creates a new delivery, Update changes the selected one, Cancel cancels it.
export function ShipmentForm({ws,selected,couriers,onDone,readOnly=false}:{ws:WorkspaceInfo;selected:ShipmentView|null;couriers:MemberInfo[];onDone:()=>void;readOnly?:boolean}){
  const {t}=useT();const [f,setF]=useState<Form>(toForm(selected||undefined));const [busy,setBusy]=useState(false);
  const version=selected?selected.id+selected.updated:'new';const [shown,setShown]=useState(version);
  if(shown!==version){setShown(version);setF(toForm(selected||undefined));}
  const set=<K extends keyof Form>(k:K,v:Form[K])=>setF(x=>({...x,[k]:v}));
  const closed=!!selected&&['Delivered','Cancelled'].includes(selected.status);
  const opts=[{value:'none',label:t('Unassigned')},...couriers.filter(c=>c.active).map(c=>({value:c.email,label:c.name+(c.area?` · ${c.area}`:'')}))];
  const body=()=>({customerName:f.customerName,customerPhone:f.customerPhone,urgency:f.urgency,sameDay:f.sameDay,nextDay:f.nextDay,deliveryDate:f.deliveryDate||null,type:f.type,operator:f.operator,courier:f.courier||null,returnCourier:f.returnCourier||null,origin:f.origin,destination:f.destination,sum:Number(f.sum)||0,notes:f.notes});
  async function run(fn:()=>Promise<unknown>,msg:string){setBusy(true);try{await fn();toast.success(t(msg));onDone();}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  return <section className="panel shipment-form"><div className="panel-heading"><h2>{selected?t('Delivery {ref}',{ref:selected.reference}):t('New delivery')}</h2>{selected&&<Pill>{selected.status}</Pill>}</div>
    <fieldset disabled={readOnly||closed||busy}>
    <div className="form-grid-3"><Field label={t('Client')}><input value={f.customerName} maxLength={120} onChange={e=>set('customerName',e.target.value)}/></Field><Field label={t('Client phone')}><input dir="ltr" value={f.customerPhone} maxLength={40} onChange={e=>set('customerPhone',e.target.value)}/></Field><Pick label={t('Urgency')} value={f.urgency} onChange={v=>set('urgency',v)} options={urgencies.map(u=>({value:u,label:t(u)}))}/></div>
    <div className="form-grid-3"><CheckField label={t('That day')} checked={f.sameDay} onChange={v=>setF(x=>({...x,sameDay:v,nextDay:v?false:x.nextDay}))}/><CheckField label={t('Day after')} checked={f.nextDay} onChange={v=>setF(x=>({...x,nextDay:v,sameDay:v?false:x.sameDay}))}/><Field label={t('Delivery date')}><input type="date" value={f.deliveryDate} onChange={e=>set('deliveryDate',e.target.value)}/></Field></div>
    <div className="form-grid-3"><Pick label={t('Type of delivery')} value={f.type} onChange={v=>set('type',v)} options={[{value:'1 way',label:t('1 way')},{value:'2 way',label:t('2 way')}]}/><Field label={t('Operating company')}><input list="operators" value={f.operator} maxLength={60} onChange={e=>set('operator',e.target.value)}/></Field><Field label={t('Sum (EUR)')}><input type="number" min={0} step="0.01" value={f.sum} onChange={e=>set('sum',Number(e.target.value))}/></Field></div>
    <datalist id="operators">{[ws.pricing.localCarrier,'DHL','UPS','FedEx'].map(o=><option key={o} value={o}/>)}</datalist>
    <div className="leg-grid"><div className="leg"><h4>{t('Starting point')}</h4><Pick label={t('Messenger name')} value={f.courier||'none'} onChange={v=>set('courier',v==='none'?'':v)} options={opts}/><AddressFields idPrefix="leg-origin" value={f.origin} onChange={a=>set('origin',a)} showWindow={false}/></div>
      <div className="leg"><h4>{t('Destination')}</h4><Pick label={t('Messenger name')} value={f.returnCourier||'none'} onChange={v=>set('returnCourier',v==='none'?'':v)} options={opts}/><AddressFields idPrefix="leg-dest" value={f.destination} onChange={a=>set('destination',a)} showWindow={false}/></div></div>
    <Field label={t('Notes')}><textarea rows={2} value={f.notes} maxLength={1000} onChange={e=>set('notes',e.target.value)}/></Field>
    </fieldset>
    {!readOnly&&<div className="button-group form-actions"><button className="button primary" disabled={busy} onClick={()=>run(()=>api('/api/shipments',json(body())),'Delivery saved')}><Save size={15}/>{t('Save as new')}</button>
      {selected&&!closed&&<><button className="button secondary" disabled={busy} onClick={()=>run(()=>api('/api/shipments/'+selected.id,json({...body(),updated:selected.updated},'PATCH')),'Delivery updated')}><RefreshCw size={15}/>{t('Update')}</button>
        {selected.status!=='Stopped'?<button className="button secondary" disabled={busy} onClick={()=>run(()=>api('/api/shipments/'+selected.id,json({status:'Stopped'},'PATCH')),'Delivery stopped')}><PauseCircle size={15}/>{t('Stop')}</button>:<button className="button secondary" disabled={busy} onClick={()=>run(()=>api('/api/shipments/'+selected.id,json({status:selected.courier?'Assigned':'Awaiting assignment'},'PATCH')),'Delivery resumed')}>{t('Resume')}</button>}
        {steps.includes(selected.status)&&selected.status!=='Delivered'&&selected.courier&&<button className="button secondary" disabled={busy} onClick={()=>run(()=>api('/api/shipments/'+selected.id,json({status:steps[steps.indexOf(selected.status)+1]},'PATCH')),'Delivery updated')}><Truck size={15}/>{t('Mark as {step}',{step:t(steps[steps.indexOf(selected.status)+1])})}</button>}
        <button className="button danger" disabled={busy} onClick={()=>{if(window.confirm(t('Cancel this delivery?')))void run(()=>api('/api/shipments/'+selected.id,json({status:'Cancelled'},'PATCH')),'Delivery cancelled');}}><XCircle size={15}/>{t('Cancel')}</button></>}</div>}
  </section>;
}
export function DeliveriesView({ws,shipments,reload}:{ws:WorkspaceInfo;shipments:ShipmentView[];reload:()=>void}){
  const {t,lang}=useT();const [sel,setSel]=useState<string|null>(null);const selected=shipments.find(s=>s.id===sel)||null;
  const couriers=ws.members.filter(m=>m.role==='courier'||m.role==='admin');
  return <><section className="panel"><DataTable id="deliveries" title={t('Active deliveries')} rows={shipments} columns={shipmentColumns(t,lang,ws)} rowKey={s=>s.id} selected={sel} onSelect={s=>setSel(s.id)} rowClass={s=>s.status==='Stopped'?'row-stop':''} toolbar={<button className="button primary small" onClick={()=>setSel(null)}><Plus size={15}/>{t('New delivery')}</button>}/></section>
    <ShipmentForm ws={ws} selected={selected} couriers={couriers} onDone={reload}/></>;
}
type CourierRow=MemberInfo&{total:number;open:number};
export function CouriersView({ws,shipments,reload}:{ws:WorkspaceInfo;shipments:ShipmentView[];reload:()=>void}){
  const {t,lang}=useT();const [rows,setRows]=useState<CourierRow[]>([]);const [sel,setSel]=useState<string|null>(null);const [ship,setShip]=useState<string|null>(null);const [edit,setEdit]=useState<Partial<CourierRow>|null>(null);
  const load=()=>api('/api/couriers').then(r=>setRows(r as unknown as CourierRow[])).catch(e=>toast.error(t(e.message)));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when deliveries change
  useEffect(()=>{void load();},[shipments]);
  const c=rows.find(r=>r.email===sel);
  const history=useMemo(()=>shipments.filter(s=>s.courier===sel||s.return_courier===sel).sort((a,b)=>Number(['Delivered','Cancelled'].includes(a.status))-Number(['Delivered','Cancelled'].includes(b.status))),[shipments,sel]);
  const cols:Column<CourierRow>[]=[{key:'name',label:t('Messenger name'),value:r=>r.name},{key:'area',label:t('Area of activity'),value:r=>r.area,filter:'select'},{key:'phone',label:t('Phone'),value:r=>r.phone},{key:'address',label:t('Address'),value:r=>r.address},{key:'business',label:t('Business number'),value:r=>r.business_number},{key:'status',label:t('Status'),value:r=>r.active?t('Active'):t('Not active'),filter:'select'},{key:'total',label:t('Total shipments'),value:r=>String(r.total),align:'end'},{key:'open',label:t('Deliveries in action'),value:r=>String(r.open),align:'end'}];
  return <><section className="panel"><DataTable id="couriers" title={t('Couriers')} rows={rows} columns={cols} rowKey={r=>r.email} selected={sel} onSelect={r=>{setSel(r.email);setShip(null);}} toolbar={ws.role==='admin'?<button className="button primary small" onClick={()=>setEdit({role:'courier',active:1})}><UserPlus size={15}/>{t('Add courier')}</button>:null}/></section>
    {c&&<section className="panel courier-card"><div className="panel-heading"><h2>{t('Courier details')}</h2>{ws.role==='admin'&&<div className="button-group"><button className="button secondary small" onClick={()=>setEdit(c)}>{t('Update')}</button>{!c.has_account&&<InviteButton email={c.email}/>}</div>}</div>
      <dl className="detail-list wide"><dt>{t('Messenger name')}</dt><dd>{c.name}</dd><dt>{t('Area of activity')}</dt><dd>{c.area||'—'}</dd><dt>{t('Phone')}</dt><dd dir="ltr">{c.phone||'—'}</dd><dt>{t('Address')}</dt><dd>{c.address||'—'}</dd><dt>{t('Business number')}</dt><dd>{c.business_number||'—'}</dd><dt>{t('Status')}</dt><dd>{c.active?t('Active'):t('Not active')}</dd><dt>{t('General deliveries')}</dt><dd>{c.total}</dd><dt>{t('Deliveries in action')}</dt><dd>{c.open}</dd><dt>{t('Email')}</dt><dd>{c.email}</dd><dt>{t('Password')}</dt><dd>{c.has_account?t('Set by the courier (never shown)'):t('No account yet — send an invitation')}</dd></dl>
      <h3 className="sub-heading">{t('Mission history')}</h3><DataTable id="courier-history" title={t('Mission history')} rows={history} columns={shipmentColumns(t,lang,ws,false)} rowKey={s=>s.id} selected={ship} onSelect={s=>setShip(s.id)} rowClass={s=>s.status==='Stopped'?'row-stop':''}/></section>}
    {c&&ship&&<ShipmentForm ws={ws} selected={history.find(s=>s.id===ship)||null} couriers={ws.members.filter(m=>m.role==='courier'||m.role==='admin')} onDone={reload}/>}
    <MemberDialog value={edit} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);void load();reload();}} courier/></>;
}
function InviteButton({email}:{email:string}){const {t}=useT();const [link,setLink]=useState('');return <><button className="button secondary small" onClick={async()=>{try{const r=await api('/api/auth/invite',json({email}));setLink(location.origin+r.path);}catch(e){toast.error(t((e as Error).message));}}}><Link2 size={15}/>{t('Account invitation')}</button><Dialog open={!!link} onOpenChange={v=>{if(!v)setLink('');}}><DialogContent><DialogTitle>{t('Account invitation')}</DialogTitle><DialogDescription>{t('Share this private link with the person. It can be used once within 24 hours.')}</DialogDescription><textarea readOnly rows={3} value={link} aria-label={t('Invitation link')}/><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(link);toast.success(t('Invitation copied'));}catch{toast.error(t('Select and copy the link manually'));}}}>{t('Copy invitation')}</button></DialogContent></Dialog></>;}
export {InviteButton};
const memberRoles=['customer','staff','vendor','reviewer','notary','courier'];
export function MemberDialog({value,onClose,onSaved,courier=false}:{value:Partial<MemberInfo>|null;onClose:()=>void;onSaved:()=>void;courier?:boolean}){
  const {t}=useT();const [m,setM]=useState<Partial<MemberInfo>>(value||{});const [busy,setBusy]=useState(false);
  const [shown,setShown]=useState(value);if(shown!==value){setShown(value);setM(value||{});}
  const set=(k:keyof MemberInfo,v:string|number)=>setM(x=>({...x,[k]:v}));
  return <Dialog open={!!value} onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="wide-dialog"><DialogTitle>{value?.email?t('Update member'):courier?t('Add courier'):t('Add a workspace member')}</DialogTitle><DialogDescription>{t('Authorize their sign-in email and choose what they can access.')}</DialogDescription>
    <div className="two-col"><Field label={t('Full name')}><input value={m.name||''} onChange={e=>set('name',e.target.value)}/></Field><Field label={t('Email used to sign in')}><input type="email" value={m.email||''} disabled={!!value?.email} onChange={e=>set('email',e.target.value)}/></Field></div>
    <div className="two-col">{!courier&&<Pick label={t('Role')} value={m.role||'staff'} onChange={v=>set('role',v)} options={memberRoles.map(r=>({value:r,label:t(r)}))}/>}<Field label={t('Area of activity')}><input value={m.area||''} onChange={e=>set('area',e.target.value)} placeholder={t('e.g. Tel Aviv, Ramat Gan')}/></Field></div>
    <div className="two-col"><Field label={t('Phone')}><input dir="ltr" value={m.phone||''} onChange={e=>set('phone',e.target.value)}/></Field><Field label={t('Business number')}><input value={m.business_number||''} onChange={e=>set('business_number',e.target.value)}/></Field></div>
    <Field label={t('Address')}><input value={m.address||''} onChange={e=>set('address',e.target.value)}/></Field>
    <CheckField label={t('Active')} checked={m.active!==0} onChange={v=>set('active',v?1:0)}>{t('Inactive members cannot sign in to the workspace.')}</CheckField>
    <button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);try{await api('/api/team',json({email:m.email,name:m.name,role:courier?'courier':m.role||'staff',area:m.area||'',phone:m.phone||'',address:m.address||'',businessNumber:m.business_number||'',active:m.active!==0}));toast.success(t('Member saved'));onSaved();}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}}>{t('Save')}</button></DialogContent></Dialog>;
}
type CustomerRow={key:string;name:string;email:string;phone:string;address:string;customerType:string;company:string;orders:number;shipments:number;registered:boolean;active:boolean};
export function CustomersView({ws,shipments,reload,orders,open}:{ws:WorkspaceInfo;shipments:ShipmentView[];reload:()=>void;orders:{id:string;reference:string;status:string;payload:{email:string};created:string}[];open:(id:string)=>void}){
  const {t,lang}=useT();const [rows,setRows]=useState<CustomerRow[]>([]);const [sel,setSel]=useState<string|null>(null);const [ship,setShip]=useState<string|null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when deliveries change
  useEffect(()=>{api('/api/customers').then(r=>setRows(r as unknown as CustomerRow[])).catch(e=>toast.error(t(e.message)));},[shipments]);
  const c=rows.find(r=>r.key===sel);
  const theirs=shipments.filter(s=>c&&((c.email&&s.customer_email===c.email)||s.customer_name.toLowerCase()===c.key));
  const theirOrders=orders.filter(o=>c&&c.email&&o.payload.email===c.email);
  const cols:Column<CustomerRow>[]=[{key:'name',label:t('Customer name'),value:r=>r.name},{key:'phone',label:t('Phone'),value:r=>r.phone},{key:'address',label:t('Address'),value:r=>r.address},{key:'email',label:t('Email'),value:r=>r.email},{key:'type',label:t('Customer type'),value:r=>t(r.customerType),filter:'select'},{key:'orders',label:t('Total orders'),value:r=>String(r.orders),align:'end'},{key:'shipments',label:t('Total shipments'),value:r=>String(r.shipments),align:'end'},{key:'account',label:t('Account'),value:r=>r.registered?(r.active?t('Registered'):t('Deactivated')):t('Guest'),filter:'select',hidden:true}];
  return <><section className="panel"><DataTable id="customers" title={t('Customers')} rows={rows} columns={cols} rowKey={r=>r.key} selected={sel} onSelect={r=>{setSel(r.key);setShip(null);}}/></section>
    {c&&<section className="panel"><div className="panel-heading"><h2>{t('Customer details')}</h2></div><dl className="detail-list wide"><dt>{t('Customer name')}</dt><dd>{c.name}</dd><dt>{t('Phone')}</dt><dd dir="ltr">{c.phone||'—'}</dd><dt>{t('Address')}</dt><dd>{c.address||'—'}</dd><dt>{t('Customer type')}</dt><dd>{t(c.customerType)}{c.company?` · ${c.company}`:''}</dd><dt>{t('Total shipments')}</dt><dd>{c.shipments}</dd><dt>{t('Total orders')}</dt><dd>{c.orders}</dd></dl>
      {theirOrders.length>0&&<><h3 className="sub-heading">{t('Orders')}</h3><div className="chip-list">{theirOrders.map(o=><button key={o.id} className="chip" onClick={()=>open(o.id)}>{o.reference} · {t(o.status)}</button>)}</div></>}
      <h3 className="sub-heading">{t('Mission history')}</h3><DataTable id="customer-history" title={t('Mission history')} rows={theirs} columns={shipmentColumns(t,lang,ws)} rowKey={s=>s.id} selected={ship} onSelect={s=>setShip(s.id)}/></section>}
    {c&&ship&&<ShipmentForm ws={ws} selected={theirs.find(s=>s.id===ship)||null} couriers={ws.members.filter(m=>m.role==='courier'||m.role==='admin')} onDone={reload}/>}</>;
}
// Delivery reports (spec 1.12): cuts by customer, courier, address and dates.
export function DeliveryReport({ws,shipments}:{ws:WorkspaceInfo;shipments:ShipmentView[]}){
  const {t,lang}=useT();const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const courier=(e:string|null)=>ws.members.find(m=>m.email===e);
  const rows=shipments.filter(s=>{const d=(s.delivery_date||s.created).slice(0,10);return (!from||d>=from)&&(!to||d<=to);});
  const cols:Column<ShipmentView>[]=[{key:'courier',label:t('Courier name'),value:s=>courier(s.courier)?.name||'',filter:'select'},{key:'area',label:t('Area of activity'),value:s=>courier(s.courier)?.area||'',filter:'select'},{key:'phone',label:t('Telephone'),value:s=>courier(s.courier)?.phone||'',hidden:true},{key:'address',label:t('Residential address'),value:s=>courier(s.courier)?.address||'',hidden:true},{key:'status',label:t('Status'),value:s=>t(s.status),filter:'select'},{key:'date',label:t('Delivery date'),value:s=>date(s.delivery_date||s.created,lang)},{key:'customer',label:t('Customer name'),value:s=>s.customer_name},{key:'order',label:t('Order number'),value:s=>s.orderReference||s.reference},{key:'from',label:t('Collection address'),value:s=>addressLine(s.origin)},{key:'to',label:t('Delivery address'),value:s=>addressLine(s.destination)},{key:'type',label:t('Delivery type'),value:s=>t(s.type),filter:'select'},{key:'operator',label:t('Operating company'),value:s=>t(s.operator),filter:'select'},{key:'sum',label:t('Amount'),value:s=>money(s.sum,'EUR',ws.pricing,lang),align:'end'}];
  const counts=new Map<string,number>();for(const s of rows)if(s.courier)counts.set(s.courier,(counts.get(s.courier)||0)+1);
  return <section className="panel"><div className="report-filters"><label className="field"><span className="field-label">{t('From date')}</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span className="field-label">{t('To date')}</span><input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><div><span>{t('Cumulative shipments')}</span><strong>{rows.length}</strong><small>{[...counts].map(([e,n])=>`${courier(e)?.name||e}: ${n}`).join(' · ')||'—'}</small></div></div><DataTable id="delivery-report" title={t('Deliveries report')} rows={rows} columns={cols} rowKey={s=>s.id}/></section>;
}
// Courier area (spec 1.13): open jobs in the courier's area, their own jobs and their reports.
export function CourierArea({ws,shipments,reload,reports}:{ws:WorkspaceInfo;shipments:ShipmentView[];reload:()=>void;reports?:boolean}){
  const {t,lang}=useT();const [sel,setSel]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [tracking,setTracking]=useState('');
  const me=ws.user.email;
  const rows=reports?shipments.filter(s=>s.courier===me||s.return_courier===me):shipments.filter(s=>!['Delivered','Cancelled'].includes(s.status));
  const s=rows.find(x=>x.id===sel)||null;
  const [shownJob,setShownJob]=useState(s?.id+'|'+s?.tracking);if(shownJob!==s?.id+'|'+s?.tracking){setShownJob(s?.id+'|'+s?.tracking);setTracking(s?.tracking||'');}
  async function act(p:Record<string,unknown>,msg:string){if(!s)return;setBusy(true);try{await api('/api/shipments/'+s.id,json(p,'PATCH'));toast.success(t(msg));reload();}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  const cols:Column<ShipmentView>[]=[{key:'status',label:t('Status'),value:x=>x.available?t('Open'):t(x.status),render:x=>x.available?<Pill tone="open">Open</Pill>:<Pill>{x.status}</Pill>,filter:'select'},...shipmentColumns(t,lang,ws,false).filter(c=>!['status','operator','sum'].includes(c.key)),...(reports?[{key:'sum',label:t('Amount'),value:(x:ShipmentView)=>money(x.sum,'EUR',ws.pricing,lang),align:'end'} as Column<ShipmentView>]:[])];
  const next=s&&steps.includes(s.status)?steps[steps.indexOf(s.status)+1]:null;
  return <><section className="panel">{!reports&&<div className="panel-notice">{ws.area?t('Showing open deliveries in your area: {area}',{area:ws.area}):t('Your area of activity is not set, so all open deliveries are shown.')}</div>}<DataTable id={reports?'courier-reports':'courier-area'} title={reports?t('My deliveries'):t('Deliveries available')} rows={rows} columns={cols} rowKey={x=>x.id} selected={sel} onSelect={x=>setSel(x.id)} exportable={!!reports} empty={<Empty title={t('No deliveries right now.')} text={t('New deliveries in your area appear here.')}/>}/></section>
    {s&&<section className="panel"><div className="panel-heading"><h2>{t('Delivery {ref}',{ref:s.reference})}</h2><Pill>{s.available?'Open':s.status}</Pill></div>
      {s.available?<p className="muted">{t('Take this delivery to see all details and start it.')}</p>:<>
      <dl className="detail-list wide"><dt>{t('Client')}</dt><dd>{s.customer_name} · <span dir="ltr">{s.customer_phone}</span></dd><dt>{t('Urgency')}</dt><dd>{t(s.urgency)} {s.same_day?'· '+t('That day'):s.next_day?'· '+t('Day after'):''}</dd><dt>{t('Type of delivery')}</dt><dd>{t(s.type)}</dd></dl>
      <div className="leg-grid">{([['Starting point',s.origin],['Destination',s.destination]] as const).map(([label,a])=><div className="leg" key={label}><h4>{t(label)}</h4><dl className="detail-list"><dt>{t('Address')}</dt><dd>{addressLine(a)}</dd><dt>{t('Remarks')}</dt><dd>{a.notes||'—'}</dd><dt>{t('Contact')}</dt><dd>{a.contact} <span dir="ltr">{[a.phonePrefix,a.phone].filter(Boolean).join(' ')}</span></dd><dt>{t('Time range')}</dt><dd>{t(a.window)}</dd></dl></div>)}</div>
      {!reports&&<Field label={t('Tracking number or note')}><input value={tracking} maxLength={80} onChange={e=>setTracking(e.target.value)}/></Field>}</>}
      {!reports&&<div className="button-group form-actions">{s.available?<button className="button primary" disabled={busy} onClick={()=>act({action:'take'},'The delivery is yours')}><Truck size={15}/>{t('Take this delivery')}</button>:<>
        {next&&<button className="button primary" disabled={busy} onClick={()=>act({status:next},'Delivery updated')}><Save size={15}/>{next==='Delivered'?t('Confirm delivery'):t('Mark as {step}',{step:t(next)})}</button>}
        <button className="button secondary" disabled={busy} onClick={()=>act({tracking},'Delivery updated')}><RefreshCw size={15}/>{t('Update')}</button>
        {s.status==='Assigned'&&<button className="button danger" disabled={busy} onClick={()=>act({action:'release'},'Delivery released')}><XCircle size={15}/>{t('Cancel mission')}</button>}</>}</div>}
    </section>}</>;
}

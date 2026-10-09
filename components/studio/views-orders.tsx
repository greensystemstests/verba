'use client';
import {useMemo,useState} from 'react';
import {Plus,Files,FileText,Check,Globe2,Truck,MessageCircle} from 'lucide-react';
import {Pill,Empty,date} from '../verba-ui';
import {useT} from '../i18n';
import {money,hasCourier,hasNotary,translates,type Order} from '@/lib/catalog';
import DataTable,{type Column} from './data-table';
import type {OrderView,WorkspaceInfo,ShipmentView} from './types';
import type {T} from '@/lib/i18n/core';
export const words=(p:Order)=>p.documents.reduce((n,d)=>n+(d.words||d.pages*250)*(d.quantity||1),0);
const docType=(p:Order)=>[...new Set(p.documents.map(d=>d.type))].join(', ');
const yes=(t:T,b:boolean)=>b?t('Yes'):t('No');
// Projects & quotes (staff), Orders / offers (customer), assignments (translators).
export function OrdersView({orders,ws,open,customer}:{orders:OrderView[];ws:WorkspaceInfo;open:(id:string)=>void;customer?:boolean}){
  const {t,lang}=useT();const m=(o:OrderView)=>money(o.total,o.payload.currency,ws.pricing,lang);
  const cols:Column<OrderView>[]=customer?[
    {key:'number',label:t('Bid number'),value:o=>o.reference},
    {key:'description',label:t('Description'),value:o=>o.payload.title+(o.payload.description?' — '+o.payload.description:'')},
    {key:'service',label:t('Type of service'),value:o=>t(o.payload.service),filter:'select'},
    {key:'name',label:t('Name'),value:o=>o.payload.name},
    {key:'date',label:t('Date'),value:o=>date(o.created,lang)},
    {key:'targets',label:t('Target languages'),value:o=>translates(o.payload.service)?o.payload.targets.map(x=>t(x)).join(', '):''},
    {key:'source',label:t('Source language'),value:o=>translates(o.payload.service)?t(o.payload.source):'',filter:'select'},
    {key:'amount',label:t('Bid amount'),value:m,align:'end'},
    {key:'status',label:t('Status'),value:o=>t(o.status),render:o=><Pill>{o.status}</Pill>,filter:'select'},
  ]:[
    {key:'number',label:t('Order number'),value:o=>o.reference},
    {key:'title',label:t('Project'),value:o=>o.payload.title},
    {key:'customer',label:t('Customer'),value:o=>o.payload.name},
    {key:'email',label:t('Email'),value:o=>o.payload.email,hidden:true},
    {key:'service',label:t('Type of service'),value:o=>t(o.payload.service),filter:'select'},
    {key:'languages',label:t('Languages'),value:o=>translates(o.payload.service)?t('{from} → {to}',{from:t(o.payload.source),to:o.payload.targets.map(x=>t(x)).join(', ')}):''},
    {key:'status',label:t('Status'),value:o=>t(o.status),render:o=><Pill>{o.status}</Pill>,filter:'select'},
    {key:'payment',label:t('Payment'),value:o=>t(o.payment),filter:'select'},
    {key:'total',label:t('Amount'),value:m,align:'end'},
    {key:'created',label:t('Date'),value:o=>date(o.created,lang)},
    {key:'due',label:t('Delivery date'),value:o=>date(o.due_date,lang)},
    {key:'notary',label:t('Notary'),value:o=>o.assignee||'',hidden:true,filter:'select'},
    {key:'vendor',label:t('Translator'),value:o=>o.vendor||'',hidden:true,filter:'select'},
  ];
  return <section className="panel"><DataTable id={customer?'customer-orders':'orders'} title={customer?t('Orders / offers'):t('Projects & quotes')} rows={orders} columns={cols} rowKey={o=>o.id} onSelect={o=>open(o.id)}
    empty={<Empty title={t('A clear space for your next order.')} text={t('Create a quote and keep every document, update and conversation together.')} action={<a href={customer?'/studio?view=new':'/order'} className="button primary"><Plus size={16}/>{t('Create a new order')}</a>}/>}/></section>;
}
// Notary work area (spec 1.15) and notary reports (1.16).
export function NotaryView({orders,ws,open,reports}:{orders:OrderView[];ws:WorkspaceInfo;open:(id:string)=>void;reports?:boolean}){
  const {t,lang}=useT();
  const rows=orders.filter(o=>hasNotary(o.payload)&&(reports||!['Delivered','Cancelled','Draft'].includes(o.status)));
  const delivery=(p:Order)=>!hasCourier(p)?t('No'):p.collect&&p.deliver?t('2 way'):t('1 way');
  const cols:Column<OrderView>[]=[
    {key:'total',label:t('Total'),value:o=>money(o.total,o.payload.currency,ws.pricing,lang),align:'end'},
    {key:'delivery',label:t('Delivery'),value:o=>delivery(o.payload),filter:'select'},
    {key:'physical',label:t('Physical arrival'),value:o=>yes(t,o.payload.physical),filter:'select'},
    {key:'collection',label:t('Physical collection'),value:o=>yes(t,o.payload.collect),filter:'select',hidden:!reports},
    {key:'copies',label:t('Copies'),value:o=>String(o.payload.copies)},
    {key:'words',label:t('Words'),value:o=>String(words(o.payload))},
    {key:'doctype',label:t('Document type'),value:o=>docType(o.payload).split(', ').map(x=>t(x)).join(', '),filter:'select'},
    {key:'type',label:t('Requirement type'),value:o=>t(o.payload.notaryType),filter:'select'},
    {key:'client',label:t('Customer name'),value:o=>o.payload.name},
    {key:'date',label:t('Date'),value:o=>date(o.created,lang)},
    {key:'number',label:t('Order number'),value:o=>o.reference},
    {key:'status',label:t('Status'),value:o=>t(o.status),render:o=><Pill>{o.status}</Pill>,filter:'select'},
    {key:'due',label:t('Date of delivery of the project'),value:o=>date(o.due_date,lang),hidden:!reports},
  ];
  return <section className="panel"><DataTable id={reports?'notary-reports':'notary-orders'} title={reports?t('Notary report'):t('Orders for notary care')} rows={rows} columns={cols} rowKey={o=>o.id} onSelect={o=>open(o.id)} exportable={!!reports||ws.role!=='notary'} empty={<Empty title={t('No orders waiting for you.')} text={t('Orders assigned to you appear here.')}/>}/></section>;
}
// Projects report (staff): orders by date range.
export function ProjectsReport({orders,ws,open}:{orders:OrderView[];ws:WorkspaceInfo;open:(id:string)=>void}){
  const {t,lang}=useT();const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const rows=orders.filter(o=>(!from||o.created.slice(0,10)>=from)&&(!to||o.created.slice(0,10)<=to));
  const total=rows.filter(o=>o.status!=='Cancelled'&&o.status!=='Draft').reduce((s,o)=>s+o.total,0);
  const paid=rows.filter(o=>o.payment==='Paid').reduce((s,o)=>s+o.total,0);
  const cols:Column<OrderView>[]=[{key:'number',label:t('Order number'),value:o=>o.reference},{key:'date',label:t('Date'),value:o=>date(o.created,lang)},{key:'customer',label:t('Customer'),value:o=>o.payload.name},{key:'service',label:t('Type of service'),value:o=>t(o.payload.service),filter:'select'},{key:'sector',label:t('Translation field'),value:o=>translates(o.payload.service)?t(o.payload.sector):'',filter:'select'},{key:'status',label:t('Status'),value:o=>t(o.status),filter:'select'},{key:'payment',label:t('Payment'),value:o=>t(o.payment),filter:'select'},{key:'amount',label:t('Amount'),value:o=>money(o.total,'EUR',ws.pricing,lang),align:'end'},{key:'due',label:t('Delivery date'),value:o=>date(o.due_date,lang)}];
  return <section className="panel"><div className="report-filters"><label className="field"><span className="field-label">{t('From date')}</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span className="field-label">{t('To date')}</span><input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><div><span>{t('Ordered value')}</span><strong>{money(total,'EUR',ws.pricing,lang)}</strong><small>{t('Paid: {amount}',{amount:money(paid,'EUR',ws.pricing,lang)})}</small></div></div><DataTable id="projects-report" title={t('Projects report')} rows={rows} columns={cols} rowKey={o=>o.id} onSelect={o=>open(o.id)}/></section>;
}
export function Overview({orders,shipments,unread,ws,go,open}:{orders:OrderView[];shipments:ShipmentView[];unread:number;ws:WorkspaceInfo;go:(v:string)=>void;open:(id:string)=>void}){
  const {t,lang}=useT();
  const counts=useMemo(()=>({active:orders.filter(o=>!['Draft','Delivered','Cancelled'].includes(o.status)).length,awaiting:orders.filter(o=>o.status==='Submitted').length,ready:orders.filter(o=>o.status==='Ready').length,unpaid:orders.filter(o=>!['Draft','Cancelled'].includes(o.status)&&o.payment!=='Paid').length,deliveries:shipments.filter(s=>!['Delivered','Cancelled'].includes(s.status)).length}),[orders,shipments]);
  const tiles:[number,string,typeof Files,string][]=[[counts.awaiting,'New orders to review',Files,'orders'],[counts.active,'Active orders',FileText,'orders'],[counts.deliveries,'Open deliveries',Truck,'deliveries'],[unread,'Unread customer messages',MessageCircle,'inbox'],[counts.unpaid,'Awaiting payment',Check,'orders'],[counts.ready,'Ready to deliver',Globe2,'orders']];
  return <><div className="stat-grid">{tiles.map(([n,label,Icon,v])=><button className="stat-card" key={label} onClick={()=>go(v)}><div><span>{t(label)}</span><Icon size={18}/></div><strong>{n}</strong></button>)}</div>
    <section className="panel"><div className="panel-heading"><h2>{t('Recent orders')}</h2><button className="text-link" onClick={()=>go('orders')}>{t('View all')}</button></div>
      {orders.length?<table className="dyn-table"><thead><tr><th>{t('Order number')}</th><th>{t('Customer')}</th><th>{t('Type of service')}</th><th>{t('Status')}</th><th className="end">{t('Amount')}</th><th>{t('Date')}</th></tr></thead><tbody>{orders.slice(0,8).map(o=><tr key={o.id} className="clickable" onClick={()=>open(o.id)}><td>{o.reference}</td><td>{o.payload.name}</td><td>{t(o.payload.service)}</td><td><Pill>{o.status}</Pill></td><td className="end">{money(o.total,o.payload.currency,ws.pricing,lang)}</td><td>{date(o.created,lang)}</td></tr>)}</tbody></table>:<Empty title={t('No orders yet.')} text={t('Orders from the website appear here.')}/>}
    </section></>;
}

// Shared order logic: pricing with the customer's context, shipment records,
// readable summaries (emails, PDF) and customer notifications.
import {db,customerKindFor,publicOrder,siteOrigin,type Ctx,type OrderRow} from './server';
import {quote,normalizeOrder,normalizeAddress,money,addBusinessDays,shipmentReference,type Order,type Quote,type Pricing} from './catalog';
import {orderRows,priceRows,summaryText} from './order-text';
export {orderRows,priceRows,summaryText};
import {withLiveRates} from './rates';
import {makeT,type Lang} from './i18n/core';
import {displayPhone} from './geo';
import {renderPdf,type PdfBlock} from './pdf';
import {notify} from './notify';

export async function pricingFor(c:Ctx){return withLiveRates(c.pricing,c.config.liveRates!==false);}
export async function quoteFor(c:Ctx,o:Order){return quote(o,await pricingFor(c),await customerKindFor(c));}
export const officeAddress=(c:{config:{officeAddress?:Record<string,string>};pricing:Pricing})=>normalizeAddress({country:c.pricing.officeCountry,city:'',street:'',contact:'Verba office',...(c.config.officeAddress||{})});

// Creates the courier job for an order that includes collection and/or delivery.
export function shipmentStatement(c:Ctx,orderId:string,owner:string,o:Order,q:Quote,number:number){
  const office=officeAddress(c);
  const origin=o.collect||o.service==='Courier only'&&!o.deliver?o.pickup:office;
  const destination=o.deliver?o.dropoff:office;
  const type=o.service==='Courier only'?(o.roundTrip?'2 way':'1 way'):(o.collect&&o.deliver?'2 way':'1 way');
  const now=new Date();const date=o.timing==='Same day'?now:o.timing==='Next day'?addBusinessDays(now,1):null;
  return db().prepare('INSERT INTO shipments (id,workspace,number,order_id,customer_account,customer_name,customer_email,customer_phone,status,delivery_date,same_day,next_day,urgency,type,operator,origin,destination,sum,international,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),c.workspace.id,number,orderId,owner,o.name,o.email,[o.phonePrefix,o.phone].filter(Boolean).join(' '),'Awaiting assignment',date?date.toISOString().slice(0,10):null,o.timing==='Same day'?1:0,o.timing==='Next day'?1:0,o.urgency,type,q.carrier,JSON.stringify(origin),JSON.stringify(destination),Math.round(q.delivery*100),q.international?1:0,now.toISOString(),now.toISOString());
}
export async function nextNumber(seq:'order_number_seq'|'shipment_number_seq'){const r=await db().prepare(`SELECT nextval('${seq}') AS n`).first<{n:number}>();return Number(r!.n);}

export async function quotePdf(o:Order,q:Quote,p:Pricing,lang:Lang,opts:{reference?:string;status?:string;created?:string;customer?:boolean;payment?:string}={}){
  const t=makeT(lang);
  const date=new Intl.DateTimeFormat(lang==='he'?'he-IL':'en-GB',{dateStyle:'long'}).format(opts.created?new Date(opts.created):new Date());
  const blocks:PdfBlock[]=[
    {kind:'heading',text:t('Order details')},{kind:'pairs',rows:orderRows(o,q,t,lang)},
    {kind:'heading',text:t('Customer')},{kind:'pairs',rows:[[t('Name'),o.name||'—'],[t('Email'),o.email||'—'],[t('Phone'),displayPhone([o.phonePrefix,o.phone].join(''))||'—'],...(o.company?[[t('Company'),o.company] as [string,string]]:[])]},
  ];
  if(q.levels.length>1)blocks.push({kind:'heading',text:t('Prices by translation level')},{kind:'table',head:[t('Level'),t('Translation'),t('Language review'),t('Delivery')],rows:q.levels.map(l=>[t(l.level),money(Math.round(l.translation*100),o.currency,p,lang),money(Math.round(l.validation*100),o.currency,p,lang),t('{n} business days',{n:l.days})]),widths:[2,2,2,2]});
  blocks.push({kind:'heading',text:t('Price')},{kind:'table',head:[t('Item'),t('Amount')],rows:priceRows(q,o.currency,p,t,lang),widths:[3,1]},{kind:'total',label:t('Total (before applicable tax)'),value:money(q.total,o.currency,p,lang)});
  if(o.currency!=='EUR')blocks.push({kind:'text',muted:true,text:t('Converted from {amount} at the reference exchange rate.',{amount:money(q.total,'EUR',p,lang)})});
  if(opts.payment)blocks.push({kind:'text',muted:true,text:t('Payment: {status}',{status:t(opts.payment)})});
  if(o.service==='Courier only')blocks.push({kind:'text',muted:true,text:t('Shipping notes: the total weight should not exceed 2 kg and the envelope should not exceed A4 size.')});
  return renderPdf({lang,title:opts.reference?t('Order {reference}',{reference:opts.reference}):t('Quotation summary'),subtitle:[opts.reference||t('Estimate (not yet saved)'),date,opts.status?t(opts.status):''].filter(Boolean).join(' · '),blocks,footer:t('This is a quotation summary, not an invoice. Final scope, price and timing are confirmed after the documents are reviewed.'),pageLabel:(n,total)=>t('Page {n} of {total}',{n,total})});
}

export async function notifyOrderCustomer(c:Ctx,o:OrderRow,template:'order_submitted'|'payment_received'|'status',origin:string,extra:Record<string,string>={}){
  const owner=await db().prepare('SELECT email,name,phone,language,notify FROM accounts WHERE id=?').bind(o.owner).first<{email:string;name:string;phone:string|null;language:string;notify:string}>();
  if(!owner)return;
  const lang:Lang=owner.language==='he'?'he':'en';const t=makeT(lang);
  const payload=normalizeOrder(JSON.parse(o.payload));const q=quote(payload,c.pricing);
  await notify(c.workspace.id,{email:owner.email,phone:owner.phone,lang,notify:owner.notify},template,{name:owner.name,reference:o.reference,total:money(o.total,payload.currency,c.pricing,lang),summary:summaryText(payload,q,t,lang),link:`${origin}/studio?order=${o.id}`,...extra});
}
export const shipmentRef=shipmentReference;
// Confirmation to the customer and a work-order notice to the company (spec: SMTP "sending a work order").
export async function afterSubmit(c:Ctx,id:string,r:Request){
  const row=await db().prepare('SELECT * FROM orders WHERE id=?').bind(id).first<OrderRow>();if(!row)return;const origin=siteOrigin(r);
  await notifyOrderCustomer(c,row,'order_submitted',origin);
  const to=c.config.notifyEmail||(await db().prepare("SELECT email FROM members WHERE workspace=? AND role='admin' ORDER BY id LIMIT 1").bind(c.workspace.id).first<{email:string}>())?.email;
  if(to){const o=publicOrder(row).payload;await notify(c.workspace.id,{email:to,notify:'["email"]'},'order_admin',{reference:row.reference,summary:`${o.name} <${o.email}>\n`+summaryText(o,quote(o,c.pricing),makeT('en'),'en'),total:money(row.total,'EUR'),link:`${origin}/studio?order=${id}`});}
}

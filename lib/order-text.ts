// Human-readable order summaries shared by the order screen, emails and PDFs.
import {hasCourier,hasNotary,translates,addressLine,money,type Order,type Quote,type Pricing,type Address} from './catalog';
import {countryName,displayPhone} from './geo';
import type {Lang,T} from './i18n/core';
export function formatAddress(a:Address,lang:Lang){return [addressLine(a),a.country?countryName(a.country,lang):''].filter(Boolean).join(', ');}
// Label/value rows describing an order, used by PDFs and emails.
export function orderRows(o:Order,q:Quote,t:T,lang:Lang):[string,string][]{
  const rows:[string,string][]=[[t('Service'),t(o.service)]];
  if(o.service==='Additional services')return [...rows,[t('Type of service'),t(o.extraType)],[t('Description'),o.description||'—']];
  if(translates(o.service))rows.push([t('Translation field'),t(o.sector)],[t('What is translated'),t(o.subject)],[t('Languages'),t('{from} → {to}',{from:t(o.source),to:o.targets.map(x=>t(x)).join(', ')})]);
  if(o.description)rows.push([t('Document description'),o.description]);
  if(o.documents.length&&o.service!=='Courier only')rows.push([t('Documents'),o.documents.map(d=>`${d.name} (${t(d.type)}, ${d.quantity>1?d.quantity+' × ':''}${t('{n} pages',{n:d.pages})}, ${t('{n} words',{n:d.words||d.pages*250})}, ${d.format})`).join('; ')]);
  if(translates(o.service)&&o.service!=='Translation validation')rows.push([t('Service level'),t(o.level)]);
  if(translates(o.service))rows.push([t('Language review'),o.validation||o.service==='Translation validation'?t('Yes'):t('No')],[t('Layout and formatting (DTP)'),o.dtp?t('Yes'):t('No')],[t('Urgency'),t(o.urgency)]);
  if(hasNotary(o))rows.push([t('Notary service'),`${t(o.notaryType)} · ${t('{n} copies',{n:o.copies})} · ${t(o.notaryUrgency)}`],[t('Physical arrival'),o.physical?t('Yes'):t('No')]);
  if(hasCourier(o)){
    if(o.collect||o.service==='Courier only')rows.push([o.service==='Courier only'?t('Collect from'):t('Collection by courier'),o.collect||o.service==='Courier only'?formatAddress(o.pickup,lang)+` · ${o.pickup.contact} ${displayPhone([o.pickup.phonePrefix,o.pickup.phone].join(''))} · ${t(o.pickup.window)}`:t('No')]);
    if(o.deliver)rows.push([o.service==='Courier only'?t('Deliver to'):t('Return by courier'),formatAddress(o.dropoff,lang)+` · ${o.dropoff.contact} ${displayPhone([o.dropoff.phonePrefix,o.dropoff.phone].join(''))} · ${t(o.dropoff.window)}`]);
    rows.push([t('Delivery timing'),t(o.timing)],[t('Carrier'),t(q.carrier)]);
    if(o.service==='Courier only')rows.push([t('Invoice requested'),o.invoice?t('Yes'):t('No')]);
  }
  rows.push([t('Requested turnaround'),t('{n} business days',{n:q.days})]);
  return rows;
}
export function priceRows(q:Quote,currency:string,p:Pricing,t:T,lang:Lang):string[][]{return q.lines.map(l=>[t(l.label),money(Math.round(l.amount*100),currency,p,lang)]);}

export function summaryText(o:Order,q:Quote,t:T,lang:Lang){return orderRows(o,q,t,lang).map(([k,v])=>`${k}: ${v}`).join('\n');}

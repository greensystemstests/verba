import {requireUser} from '@/lib/account';
import {context,access,publicOrder} from '@/lib/server';
import {money,quote} from '@/lib/catalog';
import {orderRows} from '@/lib/order-text';
import {getLang,serverT} from '@/lib/i18n-server';
import PrintButton from '@/components/print-button';
export const dynamic='force-dynamic';
export default async function Summary({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProtectedSummary id={id}/>;}
async function ProtectedSummary({id}:{id:string}){await requireUser('/studio/summary/'+id);const c=await context();const lang=await getLang();const t=await serverT(lang);
  let row;try{row=await access(c,id);}catch{return <main className="legal-page"><h1>{t('Order unavailable')}</h1><p>{t('You may not have permission to view this order.')}</p><a href="/studio">{t('Return to your workspace')}</a></main>;}
  const order=publicOrder(row,c);const p=order.payload;const q=quote(p,c.pricing);
  return <main className="order-print"><header><div className="brand">verba.</div><span>{t('ORDER SUMMARY')}</span><PrintButton/></header><h1>{p.title}</h1><p>{order.reference} · {new Date(order.created).toLocaleDateString(lang==='he'?'he-IL':'en-GB')} · {t(order.status)}</p>
    {c.role!=='courier'?<table><tbody>{orderRows(p,q,t,lang).map(([k,v])=><tr key={k}><th>{k}</th><td>{v}</td></tr>)}<tr><th>{t('Customer')}</th><td>{p.name} · {p.email}</td></tr><tr><th>{t('Total (before applicable tax)')}</th><td><strong className="print-total">{money(order.total,p.currency,c.pricing,lang)}</strong></td></tr><tr><th>{t('Payment')}</th><td>{t(order.payment)}</td></tr></tbody></table>:<p>{t('Delivery details are available in your courier area.')}</p>}
    {p.notes&&c.role!=='courier'&&<><h2>{t('Instructions')}</h2><p className="preserve-lines">{p.notes}</p></>}
    <footer>{t('This is an order summary, not an invoice or a certificate of translation. Final scope, price and timing are confirmed after review.')}</footer><a href="/studio" className="button secondary no-print">{t('Back to workspace')}</a></main>;}

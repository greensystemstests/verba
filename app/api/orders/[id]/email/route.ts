import {context,failure,access,publicOrder,HttpError,siteOrigin} from '@/lib/server';
import {quote,money} from '@/lib/catalog';
import {summaryText} from '@/lib/order-flow';
import {notify} from '@/lib/notify';
import {makeT} from '@/lib/i18n/core';
import {authLimit} from '@/lib/account';
// Sends a copy of the quote to the customer's email (spec: SMTP "send a copy of a quote").
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context(r);const row=await access(c,(await params).id);
  if(c.role==='courier')throw new HttpError(403,'Not available');if(!await authLimit('quote-mail:'+c.u.userId,10,60))throw new HttpError(429,'Too many requests. Try again later.');
  const o=publicOrder(row,c).payload;const lang=c.u.language==='he'?'he':'en';const t=makeT(lang);
  const [sent]=await notify(c.workspace.id,{email:o.email||c.u.email,lang,notify:'["email"]'},'quote',{name:o.name,reference:row.reference,summary:summaryText(o,quote(o,c.pricing),t,lang),total:money(row.total,o.currency,c.pricing,lang),link:`${siteOrigin(r)}/studio?order=${row.id}`});
  return Response.json({ok:true,sent:!!sent});}catch(e){return failure(e);}}

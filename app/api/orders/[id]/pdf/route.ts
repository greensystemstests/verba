import {context,failure,access,publicOrder,HttpError} from '@/lib/server';
import {quote} from '@/lib/catalog';
import {quotePdf} from '@/lib/order-flow';
import {withLiveRates} from '@/lib/rates';
// Order summary as a PDF file (spec: "OK button will show the customer a file to download with all order details").
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context();if(c.role==='courier')throw new HttpError(403,'Order documents are not available to couriers');
  const row=await access(c,(await params).id);const o=publicOrder(row,c).payload;const lang=new URL(r.url).searchParams.get('lang')==='he'||(!new URL(r.url).searchParams.get('lang')&&c.u.language==='he')?'he':'en';
  const pricing=await withLiveRates(c.pricing,c.config.liveRates!==false);const q=quote(o,pricing);q.total=row.total;
  const saved=(JSON.parse(row.payload) as {_quote?:{lines:typeof q.lines}})._quote;if(saved?.lines)q.lines=saved.lines;
  const pdf=await quotePdf(o,q,pricing,lang,{reference:row.reference,status:row.status,created:row.created,payment:row.payment});
  return new Response(Buffer.from(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${row.reference}.pdf"`,'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}

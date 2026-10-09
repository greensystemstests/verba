import {optionalContext,db,failure,HttpError,sameOrigin,clientAddress,primaryWorkspace,customerKindFor} from '@/lib/server';
import {normalizeOrder,normalizePricing,quote} from '@/lib/catalog';
import {withLiveRates} from '@/lib/rates';
import {quotePdf} from '@/lib/order-flow';
import {authLimit} from '@/lib/account';
// Quotation summary PDF for an order that has not been saved yet (visitors included).
export async function POST(r:Request){try{sameOrigin(r);if(!await authLimit('quote-pdf:'+clientAddress(r),60,60))throw new HttpError(429,'Too many requests. Try again later.');
  const b=await r.json() as {payload?:unknown;lang?:string};const o=normalizeOrder(b.payload);const lang=b.lang==='he'?'he':'en';
  const c=await optionalContext();
  let pricing;let kind:'new'|'existing'|'organization'='new';
  if(c){pricing=await withLiveRates(c.pricing,c.config.liveRates!==false);kind=await customerKindFor(c);}
  else{const id=await primaryWorkspace();const w=id?await db().prepare('SELECT pricing,config FROM workspaces WHERE id=?').bind(id).first<{pricing:string;config:string}>():null;pricing=await withLiveRates(normalizePricing(w?JSON.parse(w.pricing):{}),JSON.parse(w?.config||'{}').liveRates!==false);}
  const pdf=await quotePdf(o,quote(o,pricing,kind),pricing,lang);
  return new Response(Buffer.from(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="verba-quotation.pdf"','Cache-Control':'no-store'}});}catch(e){return failure(e);}}

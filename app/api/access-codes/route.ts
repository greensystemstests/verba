import {context,failure,admin,HttpError} from '@/lib/server';
import {configured,storedCodes,saveCodes,wordsUsed,isExpired,expiryTime,codeId,DEFAULT_CODE_WORDS,type StoredCode} from '@/lib/access-codes';
import {z} from 'zod';
// Access codes (administrator): free translation up to a word limit. The owner decides when a code expires.
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null);
const input=z.object({code:z.string().trim().min(3).max(60).regex(/^[^\s:,]+$/,'No spaces, colons or commas'),maxWords:z.number().int().min(1).max(400000).default(DEFAULT_CODE_WORDS),budget:z.number().int().min(1).max(100000000).nullable().default(null),expires:date});
export async function GET(){try{const c=await context();admin(c);
  const items=await Promise.all((await configured()).map(async e=>({id:e.id,code:e.code,maxWords:e.maxWords,budget:e.budget,expires:e.expires,expiresAt:expiryTime(e.expires)?new Date(expiryTime(e.expires)!).toISOString():null,expired:isExpired(e.expires),used:await wordsUsed(e.id),source:e.source,created:e.created})));
  return Response.json({items},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
// Add a code, or change an existing one (same code text): word limit, total budget and expiry date.
export async function POST(r:Request){try{const c=await context(r);admin(c);const p=input.safeParse(await r.json());if(!p.success)throw new HttpError(400,p.error.issues[0].path[0]==='code'?'Use a code of 3–60 characters without spaces, colons or commas':'Check the word limit, budget and expiry date');
  const b=p.data;if(b.expires&&Number.isNaN(Date.parse(b.expires+'T00:00:00Z')))throw new HttpError(400,'Choose a valid expiry date');
  const list=await storedCodes();const id=codeId(b.code);const old=list.find(x=>codeId(x.code)===id);
  const next:StoredCode={code:b.code,maxWords:b.maxWords,budget:b.budget,expires:b.expires,created:old?.created||new Date().toISOString()};
  await saveCodes([...list.filter(x=>codeId(x.code)!==id),next]);return Response.json({ok:true,id},{status:old?200:201});}catch(e){return failure(e);}}
export async function DELETE(r:Request){try{const c=await context(r);admin(c);const id=new URL(r.url).searchParams.get('id')||'';
  const list=await storedCodes();if(!list.some(x=>codeId(x.code)===id))throw new HttpError(404,'This code is set on the server; remove it there.');
  await saveCodes(list.filter(x=>codeId(x.code)!==id));return Response.json({ok:true});}catch(e){return failure(e);}}

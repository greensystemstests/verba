import {createHash,timingSafeEqual} from 'node:crypto';
import {runtime,db} from './server';
// Access codes give free translation up to a word limit, in every translation language. The owner manages them in
// Studio → Settings → Access codes (stored in the database, so every host sees the same codes and nothing needs a
// redeploy). Codes can also be set on the server in ACCESS_CODES, for example "my-code:2000", "my-code:2000:100000"
// (total word budget) or "my-code:2000::2026-12-31" (last day). A code with no expiry date never expires on its own.
export type AccessCode={id:string;maxWords:number;budget:number|null;expires:string|null};
export type StoredCode={code:string;maxWords:number;budget:number|null;expires:string|null;created:string};
export const DEFAULT_CODE_WORDS=2000;
const digest=(code:string)=>createHash('sha256').update(code.trim().toLowerCase()).digest();
// Stable identifier stored with a job instead of the code itself.
export const codeId=(code:string)=>digest(code).toString('hex').slice(0,16);
const STORE='access_codes';
type Entry={code:string;id:string;digest:Buffer;maxWords:number;budget:number|null;expires:string|null;source:'database'|'server';created:string};
// A plain date ("2026-11-06") lasts to the end of that day (UTC); a full timestamp is used as it is.
export function expiryTime(expires:string|null){if(!expires)return null;const t=/^\d{4}-\d{2}-\d{2}$/.test(expires)?Date.parse(expires+'T23:59:59.999Z'):Date.parse(expires);return Number.isNaN(t)?null:t;}
export const isExpired=(expires:string|null)=>{const t=expiryTime(expires);return t!==null&&Date.now()>t;};
function entry(c:{code:string;maxWords:number;budget:number|null;expires:string|null;created?:string},source:Entry['source']):Entry{return {code:c.code,id:codeId(c.code),digest:digest(c.code),maxWords:Math.max(1,Math.floor(c.maxWords)||DEFAULT_CODE_WORDS),budget:c.budget&&c.budget>0?Math.floor(c.budget):null,expires:c.expires||null,source,created:c.created||''};}
function fromServer():Entry[]{
  return (runtime().ACCESS_CODES||'').split(',').map(part=>part.trim()).filter(Boolean).map(part=>{
    const [code,words,budget,expires]=part.split(':').map(x=>x.trim());
    return entry({code,maxWords:Number(words)||DEFAULT_CODE_WORDS,budget:Number(budget)>0?Number(budget):null,expires:expires||null},'server');
  }).filter(c=>c.code);
}
export async function storedCodes():Promise<StoredCode[]>{
  const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(STORE).first<{value:string}>();
  try{const list=JSON.parse(row?.value||'[]');return Array.isArray(list)?list.filter((c:StoredCode)=>c&&typeof c.code==='string'&&c.code):[];}catch{return [];}
}
export async function saveCodes(list:StoredCode[]){
  const now=new Date().toISOString();
  await db().prepare('INSERT INTO settings (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated').bind(STORE,JSON.stringify(list),now).run();
}
// Every configured code. A code in the database replaces a server setting with the same text.
export async function configured():Promise<Entry[]>{
  const stored=(await storedCodes()).map(c=>entry(c,'database'));const ids=new Set(stored.map(c=>c.id));
  return [...stored,...fromServer().filter(c=>!ids.has(c.id))];
}
const usageKey=(id:string)=>'access_usage:'+id;
export async function wordsUsed(id:string){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(usageKey(id)).first<{value:string}>();return Number(row?.value)||0;}
export type Found=AccessCode&{remaining:number|null};
// Looks a typed code up: its entry, or why there is none.
export async function lookupCode(input:string):Promise<{status:'ok';access:Found}|{status:'expired'|'unknown'}>{
  const typed=digest(input||'');
  const match=(await configured()).find(c=>timingSafeEqual(c.digest,typed));
  if(!match)return {status:'unknown'};
  if(isExpired(match.expires))return {status:'expired'};
  return {status:'ok',access:await withRemaining(match)};
}
// The code a person typed, or null when it is wrong, expired or its word budget is used up.
export async function findCode(input:string):Promise<Found|null>{const r=await lookupCode(input);return r.status==='ok'?r.access:null;}
// The code recorded with a job (by identifier), if it is still configured and has not expired.
export async function codeById(id:string|undefined){
  if(!id)return null;const match=(await configured()).find(c=>c.id===id);return match&&!isExpired(match.expires)?withRemaining(match):null;
}
async function withRemaining(c:{id:string;maxWords:number;budget:number|null;expires:string|null}){
  const remaining=c.budget===null?null:Math.max(0,c.budget-await wordsUsed(c.id));
  return {id:c.id,maxWords:c.maxWords,budget:c.budget,expires:c.expires,remaining};
}
// Counts the words of a translation against the code's budget.
export async function chargeWords(id:string,words:number){
  const now=new Date().toISOString();
  await db().prepare('INSERT INTO settings (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=((settings.value)::bigint+?::bigint)::text, updated=?').bind(usageKey(id),String(words),now,words,now).run();
}

import {createHash,timingSafeEqual} from 'node:crypto';
import {runtime,db} from './server';
// Access codes give free translation up to a word limit, in every DeepL language. They are set on the server in
// ACCESS_CODES, for example "my-code:2000" or "my-code:2000:100000", where the optional third number is a total word
// budget. The codes never appear in the source code or in the browser until a person types one.
export type AccessCode={id:string;maxWords:number;budget:number|null};
export const DEFAULT_CODE_WORDS=2000;
const digest=(code:string)=>createHash('sha256').update(code.trim().toLowerCase()).digest();
// Stable identifier stored with a job instead of the code itself.
export const codeId=(code:string)=>digest(code).toString('hex').slice(0,16);
function configured(){
  return (runtime().ACCESS_CODES||'').split(',').map(part=>part.trim()).filter(Boolean).map(part=>{
    const [code,words,budget]=part.split(':').map(x=>x.trim());
    return {code,digest:digest(code),id:codeId(code),maxWords:Math.max(1,Number(words)||DEFAULT_CODE_WORDS),budget:budget&&Number(budget)>0?Number(budget):null};
  }).filter(c=>c.code);
}
const usageKey=(id:string)=>'access_usage:'+id;
export async function wordsUsed(id:string){const row=await db().prepare('SELECT value FROM settings WHERE key=?').bind(usageKey(id)).first<{value:string}>();return Number(row?.value)||0;}
// The code a person typed, or null when it is wrong or its word budget is used up.
export async function findCode(input:string):Promise<(AccessCode&{remaining:number|null})|null>{
  const typed=digest(input||'');
  const match=configured().find(c=>timingSafeEqual(c.digest,typed));
  return match?withRemaining(match):null;
}
// The code recorded with a job (by identifier), if it is still configured.
export async function codeById(id:string|undefined){
  if(!id)return null;const match=configured().find(c=>c.id===id);return match?withRemaining(match):null;
}
async function withRemaining(c:{id:string;maxWords:number;budget:number|null}){
  const remaining=c.budget===null?null:Math.max(0,c.budget-await wordsUsed(c.id));
  return {id:c.id,maxWords:c.maxWords,budget:c.budget,remaining};
}
// Counts the words of a translation against the code's budget.
export async function chargeWords(id:string,words:number){
  const now=new Date().toISOString();
  await db().prepare('INSERT INTO settings (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=((settings.value)::bigint+?::bigint)::text, updated=?').bind(usageKey(id),String(words),now,words,now).run();
}

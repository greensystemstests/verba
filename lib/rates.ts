// Daily reference exchange rates from the European Central Bank (EUR base), cached in
// the settings table for 12 hours. Falls back to the administrator's rates.
import {db} from './runtime';
import {currencies,type Pricing} from './catalog';
type Cached={date:string;fetched:string;rates:Record<string,number>};
const ECB='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const state=globalThis as unknown as {__verbaRatesFailedAt?:number};
export async function liveRates():Promise<Cached|null>{
  const row=await db().prepare("SELECT value FROM settings WHERE key='fx_rates'").first<{value:string}>().catch(()=>null);
  let cached:Cached|null=null;try{cached=row?JSON.parse(row.value):null;}catch{}
  if(cached&&Date.now()-Date.parse(cached.fetched)<12*3600000)return cached;
  // After a failed attempt, wait 30 minutes before trying the rates service again.
  if(state.__verbaRatesFailedAt&&Date.now()-state.__verbaRatesFailedAt<1800000)return cached;
  try{
    const xml=await (await fetch(ECB,{signal:AbortSignal.timeout(4000)})).text();
    const rates:Record<string,number>={};
    for(const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g))if((currencies as readonly string[]).includes(m[1]))rates[m[1]]=Number(m[2]);
    const date=xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1]||'';
    if(Object.keys(rates).length<3)throw new Error('Unexpected rates format');
    const value:Cached={date,fetched:new Date().toISOString(),rates};
    await db().prepare("INSERT INTO settings (key,value,updated) VALUES ('fx_rates',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated").bind(JSON.stringify(value),value.fetched).run();
    return value;
  }catch{state.__verbaRatesFailedAt=Date.now();return cached;}
}
// Pricing with today's rates applied (when the workspace uses live rates).
export async function withLiveRates(p:Pricing,enabled=true):Promise<Pricing&{ratesDate?:string}>{
  if(!enabled)return p;
  const live=await liveRates();
  return live?{...p,factors:{...p.factors,rates:{...p.factors.rates,...live.rates}},ratesDate:live.date}:p;
}

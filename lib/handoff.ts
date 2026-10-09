// Sends paid orders to the main (back-office) system as a signed JSON webhook.
// Configure MAIN_SYSTEM_WEBHOOK_URL and MAIN_SYSTEM_WEBHOOK_SECRET to enable.
import {createHmac} from 'node:crypto';
export const handoffEnabled=()=>!!(process.env.MAIN_SYSTEM_WEBHOOK_URL&&process.env.MAIN_SYSTEM_WEBHOOK_SECRET);
export async function sendToMainSystem(kind:string,data:unknown):Promise<{ok:boolean;detail:string}>{
  if(!handoffEnabled())return {ok:false,detail:'Main system connection not configured'};
  const body=JSON.stringify({kind,sentAt:new Date().toISOString(),data});
  const signature=createHmac('sha256',process.env.MAIN_SYSTEM_WEBHOOK_SECRET!).update(body).digest('hex');
  try{const r=await fetch(process.env.MAIN_SYSTEM_WEBHOOK_URL!,{method:'POST',headers:{'Content-Type':'application/json','X-Verba-Signature':'sha256='+signature},body,signal:AbortSignal.timeout(10000)});return {ok:r.ok,detail:r.ok?'Delivered':'Main system answered '+r.status};}
  catch(e){return {ok:false,detail:e instanceof Error?e.message:'Delivery failed'};}
}

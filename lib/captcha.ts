// Cloudflare Turnstile. Active only when both keys are configured.
export const captchaSiteKey=()=>process.env.TURNSTILE_SITE_KEY||'';
export const captchaEnabled=()=>!!(process.env.TURNSTILE_SITE_KEY&&process.env.TURNSTILE_SECRET_KEY);
export async function verifyCaptcha(token:unknown,ip:string){
  if(!captchaEnabled())return true;
  if(typeof token!=='string'||!token||token.length>4096)return false;
  try{const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY!,response:token,remoteip:ip}),signal:AbortSignal.timeout(8000)});const b=await r.json() as {success?:boolean};return b.success===true;}
  catch{return false;}
}

import {siteOrigin} from '@/lib/server';
import {safeReturnPath} from '@/lib/account-crypto';
import {oauthProviders,enabledProviders,isProvider,pkce} from '@/lib/oauth';
import {randomBytes} from 'node:crypto';
// Starts social sign-in: stores state and the PKCE verifier in a short-lived cookie.
export async function GET(r:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;const origin=siteOrigin(r);
  if(!isProvider(provider)||!enabledProviders().includes(provider))return Response.redirect(origin+'/account#error=provider',302);
  const cfg=oauthProviders[provider];const state=randomBytes(24).toString('base64url');const {verifier,challenge}=pkce();
  const returnTo=safeReturnPath(new URL(r.url).searchParams.get('return_to')||'/');
  const url=new URL(cfg.authorize);
  url.search=new URLSearchParams({response_type:'code',client_id:cfg.id!,redirect_uri:`${origin}/api/auth/oauth/${provider}/callback`,scope:cfg.scope,state,code_challenge:challenge,code_challenge_method:'S256',...(provider==='google'?{prompt:'select_account'}:{})}).toString();
  const cookie=`verba_oauth=${encodeURIComponent(JSON.stringify({state,verifier,provider,returnTo}))}; Path=/api/auth/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return new Response(null,{status:302,headers:{Location:url.toString(),'Set-Cookie':cookie,'Cache-Control':'no-store'}});
}

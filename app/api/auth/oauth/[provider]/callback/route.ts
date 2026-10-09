import {db,siteOrigin,clientAddress} from '@/lib/server';
import {createSession,claimGuestFiles,readCookie,authLimit} from '@/lib/account';
import {exchange,isProvider,enabledProviders} from '@/lib/oauth';
import {createCustomerAccount} from '@/lib/accounts-server';
// Completes social sign-in. Links to an existing account only through a verified email.
export async function GET(r:Request,{params}:{params:Promise<{provider:string}>}){
  const {provider}=await params;const origin=siteOrigin(r);const url=new URL(r.url);
  const clear='verba_oauth=; Path=/api/auth/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  const fail=(code:string)=>new Response(null,{status:302,headers:{Location:`${origin}/account#error=${code}`,'Set-Cookie':clear}});
  try{
    if(!isProvider(provider)||!enabledProviders().includes(provider))return fail('provider');
    if(!await authLimit('auth-network:'+clientAddress(r),60))return fail('busy');
    const saved=JSON.parse(decodeURIComponent(readCookie(r.headers.get('cookie'),'verba_oauth')||'{}')) as {state?:string;verifier?:string;provider?:string;returnTo?:string};
    if(!saved.state||saved.state!==url.searchParams.get('state')||saved.provider!==provider||!saved.verifier)return fail('state');
    const code=url.searchParams.get('code');if(!code)return fail('cancelled');
    const profile=await exchange(provider,code,`${origin}/api/auth/oauth/${provider}/callback`,saved.verifier);
    const linked=await db().prepare('SELECT account_id FROM oauth_identities WHERE provider=? AND subject=?').bind(provider,profile.subject).first<{account_id:string}>();
    let accountId=linked?.account_id||null;
    if(!accountId){
      if(!profile.email||!profile.emailVerified)return fail('email');
      const email=profile.email.toLowerCase();
      const existing=await db().prepare('SELECT id FROM accounts WHERE email=?').bind(email).first<{id:string}>();
      accountId=existing?.id||(await createCustomerAccount({email,firstName:profile.firstName||profile.name||email,lastName:profile.lastName,verified:true})).id;
      await db().prepare('INSERT INTO oauth_identities (provider,subject,account_id,email,created) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(provider,profile.subject,accountId,email,new Date().toISOString()).run();
      if(existing)await db().prepare('UPDATE accounts SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(new Date().toISOString(),accountId).run();
    }
    const disabled=await db().prepare('SELECT disabled_at FROM accounts WHERE id=?').bind(accountId).first<{disabled_at:string|null}>();
    if(!disabled||disabled.disabled_at)return fail('disabled');
    const session=await createSession(accountId,true);await claimGuestFiles(accountId).catch(()=>0);
    const headers=new Headers({Location:origin+(saved.returnTo||'/'),'Cache-Control':'no-store'});headers.append('Set-Cookie',session);headers.append('Set-Cookie',clear);
    return new Response(null,{status:302,headers});
  }catch{return fail('failed');}
}

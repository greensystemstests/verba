// Sign in with Google, Facebook or X (spec 1.0). Each provider is offered only when its
// client ID and secret are configured. Uses the OAuth 2.0 authorization-code flow with PKCE.
import {createHash,randomBytes} from 'node:crypto';
export type ProviderId='google'|'facebook'|'x';
type Profile={subject:string;email:string|null;emailVerified:boolean;firstName:string;lastName:string;name:string};
type Provider={label:string;id:string|undefined;secret:string|undefined;authorize:string;token:string;scope:string;basicAuth?:boolean;profile:(token:string)=>Promise<Profile>};
const env=process.env;
async function getJson(url:string,token:string){const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Profile request failed');return r.json() as Promise<Record<string,unknown>>;}
const split=(name:string)=>{const [f,...l]=name.trim().split(/\s+/);return {firstName:f||'',lastName:l.join(' ')};};
export const oauthProviders:Record<ProviderId,Provider>={
  google:{label:'Google',id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET,authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email profile',
    profile:async t=>{const p=await getJson('https://openidconnect.googleapis.com/v1/userinfo',t);return {subject:String(p.sub),email:p.email?String(p.email):null,emailVerified:p.email_verified===true,firstName:String(p.given_name||''),lastName:String(p.family_name||''),name:String(p.name||'')};}},
  facebook:{label:'Facebook',id:env.FACEBOOK_CLIENT_ID,secret:env.FACEBOOK_CLIENT_SECRET,authorize:'https://www.facebook.com/v19.0/dialog/oauth',token:'https://graph.facebook.com/v19.0/oauth/access_token',scope:'email,public_profile',
    // Facebook only returns an email address that the person has confirmed.
    profile:async t=>{const p=await getJson('https://graph.facebook.com/me?fields=id,name,email,first_name,last_name',t);return {subject:String(p.id),email:p.email?String(p.email):null,emailVerified:!!p.email,firstName:String(p.first_name||''),lastName:String(p.last_name||''),name:String(p.name||'')};}},
  x:{label:'X (Twitter)',id:env.X_CLIENT_ID,secret:env.X_CLIENT_SECRET,authorize:'https://x.com/i/oauth2/authorize',token:'https://api.x.com/2/oauth2/token',scope:'users.read tweet.read users.email',basicAuth:true,
    profile:async t=>{const p=await getJson('https://api.x.com/2/users/me?user.fields=confirmed_email,name',t);const d=(p.data||{}) as Record<string,unknown>;const name=String(d.name||'');return {subject:String(d.id),email:d.confirmed_email?String(d.confirmed_email):null,emailVerified:!!d.confirmed_email,...split(name),name};}},
};
export const enabledProviders=()=>(Object.keys(oauthProviders) as ProviderId[]).filter(p=>oauthProviders[p].id&&oauthProviders[p].secret);
export const isProvider=(p:string):p is ProviderId=>p in oauthProviders;
export function pkce(){const verifier=randomBytes(32).toString('base64url');return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};}
export async function exchange(p:ProviderId,code:string,redirectUri:string,verifier:string){
  const cfg=oauthProviders[p];
  const form=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:verifier,client_id:cfg.id!});
  if(!cfg.basicAuth)form.set('client_secret',cfg.secret!);
  const r=await fetch(cfg.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json',...(cfg.basicAuth?{Authorization:'Basic '+Buffer.from(cfg.id+':'+cfg.secret).toString('base64')}:{})},body:form,signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('Token exchange failed');
  const b=await r.json() as {access_token?:string};if(!b.access_token)throw new Error('No access token');
  return cfg.profile(b.access_token);
}

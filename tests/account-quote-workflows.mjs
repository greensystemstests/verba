import assert from 'node:assert/strict';
import {startApp} from './support/harness.mjs';
import {createInvite} from '../scripts/lib/invite.mjs';
let n=0,providerCalls=0;const check=(a,b,label)=>{assert.equal(a,b,label);n++;};
const app=await startApp({name:'account_quote',env:{OPENAI_API_KEY:'fixture-only'}});
app.setProvider(async req=>{providerCalls++;const b=await req.json();const input=JSON.parse(b.input[0].content[0].text);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({segments:input.sourceSegments.map(s=>({id:s.id,translation:'Texte traduit 5 mg.'})),issues:[]})}]}]});});
let cookie='';const userHeaders={'oai-authenticated-user-id':'legacy-owner','oai-authenticated-user-email':'owner@example.test'};
async function request(route,{method='GET',body,auth=true,headers={}}={}){const h={...headers};if(auth&&cookie)h.cookie=cookie;const r=await fetch(app.base+route,{method,headers:{...h,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});const content=await r.text();let data;try{data=JSON.parse(content);}catch{data=content;}return {status:r.status,data,headers:r.headers};}
const post=(route,body,extra={})=>request(route,{method:'POST',body,...extra});
try{
// Hosting identity headers are never trusted; accounts start from an offline administrator invitation.
check((await request('/api/workspace',{headers:userHeaders})).status,401,'host identity alone never authenticates application');
check((await post('/api/auth/setup',{name:'Intruder',password:'Synthetic password 12345'})).status,403,'anonymous setup denied');
check((await post('/api/auth/setup',{name:'Spoof',password:'Synthetic password 12345'},{headers:userHeaders})).status,403,'self-hosting does not trust platform headers');
check((await request('/api/auth/status',{headers:userHeaders})).data.setup,null,'hosting adapter removed');
const ownerInvite=(await createInvite(app.db,{email:'owner@example.test',name:'Owner'})).token;
check((await post('/api/auth/setup',{invite:ownerInvite,name:'Owner',password:'short'})).status,400,'weak password denied');
check((await post('/api/auth/setup',{invite:ownerInvite,name:'Owner',password:'Long synthetic password 123!'},{headers:{origin:'https://evil.test'}})).status,403,'setup CSRF denied');
let r=await post('/api/auth/setup',{invite:ownerInvite,name:'Owner',password:'Long synthetic password 123!'});check(r.status,201,'account created');const recovery=r.data.recoveryCode;cookie=r.headers.get('set-cookie').split(';')[0];check(r.headers.get('set-cookie').includes('HttpOnly; Secure; SameSite=Lax'),true,'secure session attributes');
check((await request('/api/workspace')).status,200,'cookie signs in');check((await request('/api/workspace')).data.role,'admin','bootstrap invitation grants administrator');
const stored=(await app.db.query('SELECT * FROM accounts')).rows[0];check(stored.password_hash.startsWith('scrypt:'),true,'slow salted password hash');check(stored.recovery_hash===recovery,false,'recovery code hashed');const session=(await app.db.query('SELECT * FROM sessions')).rows[0];check(cookie.includes(session.token_hash),false,'session token hashed');
check((await post('/api/auth/setup',{invite:ownerInvite,name:'Owner',password:'Different password 123!'},{auth:false})).status,400,'bootstrap invitation is single-use');
await assert.rejects(createInvite(app.db,{email:'owner@example.test',name:'Owner'}),/already exists/);n++;
check((await post('/api/auth/login',{email:'owner@example.test',password:'Wrong password!'})).status,401,'incorrect password denied');
r=await post('/api/auth/login',{email:'OWNER@example.test',password:'Long synthetic password 123!'});check(r.status,200,'email normalization');cookie=r.headers.get('set-cookie').split(';')[0];
const p={requestKey:crypto.randomUUID(),title:'Test request',source:'English',target:'French',sector:'Medical',tone:'Faithful',text:'Take 5 mg daily.',consent:true,total:1};
r=await post('/api/translations',p);check(r.status,201,'request saved');let j=r.data;check(j.state,'quoting','request starts in quote stage');check(providerCalls,0,'no translation before quote');
const patch=(body)=>request('/api/translations/'+j.id,{method:'PATCH',body});
check((await patch({action:'accept_quote',accepted:true,quoteId:crypto.randomUUID(),version:j.version})).status,409,'cannot bypass quote calculation');
r=await post('/api/translations/'+j.id+'/advance',{});check(r.data.state,'quoted','analysis produces quote');j=r.data;check(j.quote.words,4,'source word count');check(j.quote.total,2516,'server price ignores client amount');check(j.quote.lines.reduce((s,l)=>s+l.amount,0),j.quote.total,'breakdown matches total');check(providerCalls,0,'quote uses rates, not invented provider output');
check((await post('/api/translations/'+j.id+'/advance',{})).data.state,'quoted','advance cannot bypass approval');check(providerCalls,0,'still zero provider calls');
check((await patch({action:'accept_quote',accepted:true,quoteId:crypto.randomUUID(),version:j.version})).status,409,'tampered quote identifier rejected');
const oldQuote=j.quote;const oldVersion=j.version;r=await patch({action:'refresh_quote'});j=r.data;check(j.quote.id!==oldQuote.id,true,'refresh produces new quote');check((await patch({action:'accept_quote',accepted:true,quoteId:oldQuote.id,version:oldVersion})).status,409,'stale approval rejected');
await app.db.query('UPDATE translations SET quote=$1 WHERE id=$2',[JSON.stringify({...j.quote,expiresAt:'2000-01-01T00:00:00.000Z'}),j.id]);check((await patch({action:'accept_quote',accepted:true,quoteId:j.quote.id,version:j.version})).status,409,'expired approval rejected');j=(await patch({action:'refresh_quote'})).data;
r=await patch({action:'accept_quote',accepted:true,quoteId:j.quote.id,version:j.version});check(r.data.state,'translating','explicit approval unlocks translation');check(!!r.data.quote_accepted_at,true,'approval recorded');check(providerCalls,0,'acceptance itself does not call model');check((await post('/api/translations/'+j.id+'/advance',{})).status,200,'translation now runs');check(providerCalls,1,'one model request after approval');
// Invited users cannot pick somebody else's email or role.
check((await post('/api/team',{email:'member@example.test',name:'Member',role:'customer',area:''})).status,200,'authorize member');r=await post('/api/auth/invite',{email:'member@example.test'});check(r.status,200,'invitation created');const token=r.data.path.split('invite=')[1];r=await post('/api/auth/setup',{invite:token,name:'Member',password:'Member synthetic password 123!'},{auth:false});check(r.status,201,'invited signup');const memberCookie=r.headers.get('set-cookie').split(';')[0];check((await post('/api/auth/setup',{invite:token,name:'Another',password:'Another synthetic password!'},{auth:false})).status,400,'single-use invite');
check((await request('/api/workspace',{auth:false,headers:{cookie:memberCookie}})).data.role,'customer','member role retained');check((await request('/api/translations/'+j.id,{auth:false,headers:{cookie:memberCookie}})).status,403,'invited customer cannot read owner request');
const oldCookie=cookie;r=await post('/api/auth/recover',{email:'owner@example.test',recoveryCode:recovery,password:'Replacement password 12345!'});check(r.status,200,'recovery works');check(r.data.recoveryCode!==recovery,true,'recovery code rotates');cookie=r.headers.get('set-cookie').split(';')[0];check((await request('/api/workspace',{auth:false,headers:{cookie:oldCookie}})).status,401,'recovery revokes prior sessions');
check((await post('/api/auth/recover',{email:'owner@example.test',recoveryCode:recovery,password:'Another replacement password!'})).status,401,'old recovery code invalid');
check((await post('/api/auth/logout',{}, {headers:{origin:'https://evil.test'}})).status,403,'logout CSRF denied');check((await post('/api/auth/logout',{})).status,200,'logout');check((await request('/api/workspace')).status,401,'logout invalidates session');
for(let i=0;i<10;i++)await post('/api/auth/login',{email:'missing@example.test',password:'Not a valid password'});check((await post('/api/auth/login',{email:'missing@example.test',password:'Not a valid password'})).status,429,'login attempts limited');
for(const route of ['/','/account','/order','/privacy']){const page=await request(route,{auth:false});check(page.status,200,'SSR '+route);check(/Sign in with ChatGPT|signin-with-chatgpt|signout-with-chatgpt/.test(String(page.data)),false,'no branded sign-in in '+route);}
console.log(`PASS: ${n} independent account, recovery, invitation and quote-approval checks`);
}catch(e){console.error(app.logs().slice(-4000));throw e;}finally{await app.stop();}

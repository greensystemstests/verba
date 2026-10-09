// Spec 1.1.4 workflows: open sign-up, phone login, email/SMS reset links, social sign-in,
// visitor and chunked uploads, the upload safety scan, service-aware orders, running
// numbers, payments recorded by staff, deliveries and the courier pool, chat, inquiries,
// PDFs, interface texts in Hebrew and member removal. External services are mocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {startApp} from './support/harness.mjs';
let n=0;const check=(a,b,label)=>{assert.equal(a,b,label);n++;};const ok=(v,label)=>{assert.ok(v,label);n++;};
// Minimal SMTP server that records messages.
const mails=[];
const smtp=createServer(sock=>{let data=false,buf='';sock.write('220 test ESMTP\r\n');sock.on('data',chunk=>{buf+=chunk.toString('latin1');let i;while((i=buf.indexOf('\r\n'))>=0){if(data){const end=buf.indexOf('\r\n.\r\n');if(end<0)return;mails.push(Buffer.from(buf.slice(0,end),'latin1').toString('utf8'));buf=buf.slice(end+5);data=false;sock.write('250 OK\r\n');continue;}const line=buf.slice(0,i);buf=buf.slice(i+2);const cmd=line.slice(0,4).toUpperCase();if(cmd==='EHLO'||cmd==='HELO')sock.write('250-test\r\n250 OK\r\n');else if(cmd==='DATA'){data=true;sock.write('354 go\r\n');}else if(cmd==='QUIT'){sock.write('221 bye\r\n');sock.end();}else sock.write('250 OK\r\n');}});});
await new Promise(r=>smtp.listen(0,'127.0.0.1',r));
const app=await startApp({name:'spec',env:{SMTP_URL:`smtp://127.0.0.1:${smtp.address().port}`,MAIL_FROM:'Verba <no-reply@example.test>',TWILIO_ACCOUNT_SID:'AC1',TWILIO_AUTH_TOKEN:'tok',TWILIO_FROM:'+15550000000',TURNSTILE_SITE_KEY:'site-key',TURNSTILE_SECRET_KEY:'secret',GOOGLE_CLIENT_ID:'g-id',GOOGLE_CLIENT_SECRET:'g-secret'}});
const sms=[];
app.setProvider(async req=>{const u=new URL(req.url);const p=u.pathname;
  if(p.startsWith('/challenges.cloudflare.com/')){const f=new URLSearchParams(await req.text());return Response.json({success:f.get('response')==='ok'});}
  if(p.startsWith('/api.twilio.com/')){sms.push(Object.fromEntries(new URLSearchParams(await req.text())));return Response.json({sid:'SM1'},{status:201});}
  if(p==='/oauth2.googleapis.com/token'){const f=new URLSearchParams(await req.text());return f.get('code')==='good'&&f.get('client_secret')==='g-secret'&&f.get('code_verifier')?Response.json({access_token:'at'}):Response.json({error:'bad'},{status:400});}
  if(p==='/openidconnect.googleapis.com/v1/userinfo')return Response.json({sub:'g-123',email:'social@example.test',email_verified:true,given_name:'Sofia',family_name:'Social',name:'Sofia Social'});
  return Response.json({error:'unmocked '+p},{status:500});});
const jar={};
async function call(route,{as,method='GET',body,headers={},raw}={}){const h={...headers};if(as&&jar[as])h.cookie=jar[as];if(body!==undefined&&!(body instanceof FormData)&&!raw){h['Content-Type']='application/json';body=JSON.stringify(body);}const r=await fetch(app.base+route,{method,headers:h,body,redirect:'manual'});const bytes=new Uint8Array(await r.arrayBuffer());const text=new TextDecoder().decode(bytes);let data;try{data=JSON.parse(text);}catch{data=text;}const set=r.headers.getSetCookie?.()||[];for(const c of set){const [pair]=c.split(';');const [k,v]=pair.split('=');if(as){const others=(jar[as]||'').split('; ').filter(x=>x&&!x.startsWith(k+'='));jar[as]=[...others,v?pair:null].filter(Boolean).join('; ');}}return {status:r.status,data,bytes,headers:r.headers,cookies:set};}
const waitMail=async(pred)=>{for(let i=0;i<50;i++){const m=mails.find(pred);if(m)return m;await new Promise(r=>setTimeout(r,100));}throw new Error('mail not received');};
const decode=m=>m.replace(/=\r\n/g,'').replace(/=([0-9A-F]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
try{
  jar.owner=await app.sessionFor('owner',{owner:['owner','owner@example.test']});
  // Public settings and open sign-up
  let r=await call('/api/public-config');check(r.status,200,'public config');check(r.data.captcha,'site-key','captcha key published');ok(r.data.pricing.factors.sectors.Medical>1,'public price factors');
  const reg={firstName:'Dana',lastName:'Levi',email:'dana@example.test',phonePrefix:'+972',phone:'050-123-4567',password:'Blue river morning 42',agreed:true,language:'en'};
  check((await call('/api/auth/register',{as:'dana',method:'POST',body:reg})).status,400,'captcha required');
  check((await call('/api/auth/register',{as:'dana',method:'POST',body:{...reg,captcha:'bad'}})).status,400,'failed captcha rejected');
  check((await call('/api/auth/register',{as:'dana',method:'POST',body:{...reg,password:'short',captcha:'ok'}})).status,400,'weak password rejected');
  check((await call('/api/auth/register',{as:'dana',method:'POST',body:{...reg,agreed:false,captcha:'ok'}})).status,400,'terms required');
  r=await call('/api/auth/register',{as:'dana',method:'POST',body:{...reg,captcha:'ok'}});check(r.status,201,'customer registers');check(r.data.verificationSent,true,'verification email sent');check(r.data.recoveryCode,undefined,'no recovery code when email reset is available');
  check((await call('/api/auth/register',{method:'POST',body:{...reg,captcha:'ok'}})).status,409,'duplicate email refused');
  check((await call('/api/auth/register',{method:'POST',body:{...reg,email:'other@example.test',captcha:'ok'}})).status,409,'duplicate phone refused');
  r=await call('/api/workspace',{as:'dana'});check(r.data.role,'customer','self-registered user is a customer of the company');check(r.data.user.emailVerified,false,'email not yet confirmed');
  const verifyMail=decode(await waitMail(m=>m.includes('dana@example.test')&&m.includes('verify=')));const vtoken=verifyMail.match(/verify=([a-f0-9]{64})/)[1];
  check((await call('/api/auth/verify',{method:'POST',body:{token:vtoken}})).status,200,'email confirmed by link');check((await call('/api/auth/verify',{method:'POST',body:{token:vtoken}})).status,400,'confirmation link single use');
  check((await call('/api/profile',{as:'dana'})).data.emailVerified,true,'profile shows confirmed email');check((await call('/api/profile',{as:'dana'})).data.phone,'+972501234567','phone stored in international form');
  // Phone login, remember me
  r=await call('/api/auth/login',{as:'dana2',method:'POST',body:{identifier:'0501234567',phonePrefix:'+972',password:'Blue river morning 42',remember:false}});check(r.status,200,'login with phone number');check(r.cookies.some(c=>c.includes('verba_session')&&!c.includes('Max-Age')),true,'without remember me the session ends with the browser');
  check((await call('/api/auth/login',{method:'POST',body:{identifier:'+972501234567',password:'wrong password here'}})).status,401,'wrong password by phone');
  r=await call('/api/auth/login',{method:'POST',body:{identifier:'DANA@example.test',password:'Blue river morning 42'}});check(r.cookies.some(c=>c.includes('Max-Age=2592000')),true,'remember me keeps 30 days');
  // Forgot password by email and by phone (SMS)
  check((await call('/api/auth/forgot',{method:'POST',body:{identifier:'dana@example.test'}})).status,400,'reset needs captcha');
  r=await call('/api/auth/forgot',{method:'POST',body:{identifier:'dana@example.test',captcha:'ok'}});check(r.data.delivery,true,'reset link available');
  check((await call('/api/auth/forgot',{method:'POST',body:{identifier:'nobody@example.test',captcha:'ok'}})).status,200,'same answer for unknown accounts');
  const resetMail=decode(await waitMail(m=>m.includes('dana@example.test')&&m.includes('reset=')));const rtoken=resetMail.match(/reset=([a-f0-9]{64})/)[1];
  check((await call('/api/auth/reset',{method:'POST',body:{token:rtoken,password:'aaaaaaaaaaaa'}})).status,400,'reset rejects predictable password');
  check((await call('/api/auth/reset',{as:'dana',method:'POST',body:{token:rtoken,password:'Green valley evening 77'}})).status,200,'password reset');
  check((await call('/api/auth/login',{method:'POST',body:{identifier:'dana@example.test',password:'Blue river morning 42'}})).status,401,'old password no longer works');
  check((await call('/api/auth/reset',{method:'POST',body:{token:rtoken,password:'Another valley 7777'}})).status,400,'reset link single use');
  await call('/api/auth/forgot',{method:'POST',body:{identifier:'050 123 4567',phonePrefix:'+972',captcha:'ok'}});for(let i=0;i<30&&!sms.length;i++)await new Promise(r=>setTimeout(r,100));
  ok(sms.some(s=>s.To==='+972501234567'&&/reset=[a-f0-9]{64}/.test(s.Body)),'reset link sent by SMS to the phone');
  r=await call('/api/auth/login',{as:'dana',method:'POST',body:{identifier:'dana@example.test',password:'Green valley evening 77'}});check(r.status,200,'new password works');
  // Visitor upload, then sign in claims it; word count from the file
  const guestForm=new FormData();guestForm.set('file',new File(['Take five milligrams daily with water.'],'note.txt',{type:'text/plain'}));
  r=await call('/api/files',{as:'guest',method:'POST',body:guestForm});check(r.status,201,'visitor can upload before signing in');check(r.data.stats.words,6,'words counted from the file');const guestFile=r.data.id;
  ok(jar.guest.includes('verba_guest='),'visitor gets a private upload token');
  r=await call('/api/auth/login',{as:'guest',method:'POST',body:{identifier:'dana@example.test',password:'Green valley evening 77'}});check(r.status,200,'visitor signs in');
  // Chunked upload (large file in pieces)
  const big=new TextEncoder().encode('word '.repeat(1_400_000));const id=crypto.randomUUID();const pieces=Math.ceil(big.length/(3*1024*1024));let last;
  for(let i=0;i<pieces;i++)last=await call('/api/files/chunk',{as:'dana',method:'POST',raw:true,body:big.slice(i*3*1024*1024,(i+1)*3*1024*1024),headers:{'x-upload-id':id,'x-chunk-index':String(i),'x-chunk-count':String(pieces),'x-file-name':'big.txt','x-file-size':String(big.length),'content-type':'application/octet-stream'}});
  check(last.status,201,'large file stored from pieces');check(last.data.size,big.length,'all pieces joined');check(last.data.stats.words,1_400_000,'large file word count');
  // Safety scan
  const d=await PDFDocument.create();const f=await d.embedFont(StandardFonts.Helvetica);d.addPage().drawText('Hello',{x:50,y:700,font:f});d.addJavaScript('x','app.alert(1)');
  const evil=new FormData();evil.set('file',new File([await d.save()],'evil.pdf',{type:'application/pdf'}));r=await call('/api/files',{as:'dana',method:'POST',body:evil});check(r.status,400,'PDF with script rejected');ok(/active content/.test(r.data.error),'clear reason for rejection');
  // Orders: service-aware rules, running numbers
  const base={firstName:'Dana',lastName:'Levi',email:'dana@example.test',phonePrefix:'+972',phone:'0501234567',agreed:true};
  r=await call('/api/orders',{as:'dana',method:'POST',body:{payload:{...base,service:'Document translation',sector:'Medical',targets:['Hebrew'],documents:[{name:'Note',type:'Medical report',pages:1,words:6,format:'TXT',fileIds:[guestFile]}]},submit:true}});check(r.status,201,'order with the claimed visitor upload');ok(/^VB-\d{4}-001001$/.test(r.data.reference),'first order gets running number 001001');const orderA=r.data.id;
  r=await call('/api/orders',{as:'dana',method:'POST',body:{payload:{...base,service:'Notary only',documents:[{name:'Deed',type:'Document',pages:2,words:0,format:'PDF'}],notaryType:'Signature verification',copies:2,notaryUrgency:'Express'},submit:true}});check(r.status,201,'notary-only order needs no languages');ok(r.data.reference.endsWith('001002'),'numbers run in sequence');ok(r.data.total>0,'notary priced');
  r=await call('/api/orders',{as:'dana',method:'POST',body:{payload:{...base,service:'Courier only',collect:true,deliver:false,pickup:{country:'IL',city:'Tel Aviv-Yafo',street:'Herzl',number:'5',contact:'Dana',phonePrefix:'+972',phone:'0501234567'}},submit:true}});check(r.status,201,'one-way courier order accepted');const courierOrder=r.data.id;
  check((await call('/api/orders',{as:'dana',method:'POST',body:{payload:{...base,service:'Additional services',freeText:'Please design a brochure'}}})).status,400,'additional services go to the inquiry form');
  // E1: empty or unknown updates are refused and leave no history
  check((await call('/api/orders/'+orderA,{as:'owner',method:'PATCH',body:{}})).status,400,'empty update refused');
  check((await call('/api/orders/'+orderA,{as:'owner',method:'PATCH',body:{foo:'bar'}})).status,400,'unknown field refused');
  check((await call('/api/orders/'+orderA,{as:'dana',method:'PATCH',body:{payment:'Paid'}})).status,403,'customer cannot mark paid');
  check((await call('/api/orders/'+orderA,{as:'owner',method:'PATCH',body:{payment:'Paid'}})).status,200,'staff records payment');
  r=await call('/api/orders/'+orderA,{as:'owner'});check(r.data.payment,'Paid','payment saved');check(r.data.events.some(e=>e.action==='Terms accepted'),false,'no false history entry');ok(r.data.events.some(e=>e.action.includes('payment: Paid')),'payment in history');ok(r.data.due_date,'project delivery date set on submission');
  ok(await waitMail(m=>m.includes('dana@example.test')&&/Payment received/.test(m)),'customer emailed about payment');
  // Deliveries: courier pool by area, take, steps, stop
  check((await call('/api/team',{as:'owner',method:'POST',body:{email:'rider@example.test',name:'Rider One',role:'courier',area:'Tel Aviv-Yafo, Ramat Gan',phone:'+972521111111',businessNumber:'515151',address:'Holon'}})).status,200,'courier added with card details');
  check((await call('/api/team',{as:'owner',method:'POST',body:{email:'far@example.test',name:'Far Rider',role:'courier',area:'Eilat'}})).status,200,'second courier in another area');
  jar.rider=await app.sessionFor('rider',{rider:['rider','rider@example.test']});jar.far=await app.sessionFor('far',{far:['far','far@example.test']});
  r=await call('/api/shipments',{as:'rider'});const job=r.data.find(s=>s.order_id===courierOrder);ok(job&&job.available,'open delivery visible to courier in the area');
  check((await call('/api/shipments',{as:'far'})).data.some(s=>s.order_id===courierOrder),false,'courier outside the area does not see it');
  check((await call('/api/shipments/'+job.id,{as:'rider',method:'PATCH',body:{status:'Collected'}})).status,403,'cannot start before taking');
  check((await call('/api/shipments/'+job.id,{as:'rider',method:'PATCH',body:{action:'take'}})).status,200,'courier takes the delivery');
  check((await call('/api/shipments/'+job.id,{as:'far',method:'PATCH',body:{action:'take'}})).status,403,'another courier cannot take it');
  check((await call('/api/orders/'+courierOrder,{as:'owner'})).data.shipment,'Assigned','order mirrors the delivery status');
  check((await call('/api/shipments/'+job.id,{as:'rider',method:'PATCH',body:{status:'In transit'}})).status,409,'steps in order');
  check((await call('/api/shipments/'+job.id,{as:'rider',method:'PATCH',body:{status:'Collected'}})).status,200,'collected');
  check((await call('/api/shipments/'+job.id,{as:'rider',method:'PATCH',body:{status:'Stopped'}})).status,403,'courier cannot stop a delivery');
  check((await call('/api/shipments/'+job.id,{as:'owner',method:'PATCH',body:{status:'Stopped'}})).status,200,'staff stop a delivery');
  r=await call('/api/shipments',{as:'owner',method:'POST',body:{customerName:'Walk-in Client',type:'2 way',urgency:'Priority',sameDay:true,origin:{country:'IL',city:'Haifa',street:'Hanamal',number:'1'},destination:{country:'IL',city:'Haifa',street:'Herzl',number:'9'},courier:'rider@example.test',sum:30}});check(r.status,201,'staff create a delivery (Save)');ok(r.data.reference.startsWith('SH-'),'delivery running number');
  const couriers=(await call('/api/couriers',{as:'owner'})).data;const rider=couriers.find(c=>c.email==='rider@example.test');check(rider.business_number,'515151','courier card details');ok(rider.total>=2&&rider.open>=1,'courier delivery counts');
  const customers=(await call('/api/customers',{as:'owner'})).data;ok(customers.some(c=>c.email==='dana@example.test'&&c.orders>=3),'customer card with order count');ok(customers.some(c=>c.name==='Walk-in Client'&&c.shipments===1),'delivery-only customer listed');
  check((await call('/api/couriers',{as:'dana'})).status,403,'customers cannot see courier cards');
  // E7: assigning a courier moves the order's delivery to Assigned
  r=await call('/api/orders',{as:'dana',method:'POST',body:{payload:{...base,service:'Translation + notary',sector:'Legal',targets:['French'],documents:[{name:'Contract',type:'Contract',pages:2,words:500,format:'PDF'}],collect:true,deliver:true,pickup:{country:'IL',city:'Haifa',street:'Herzl',number:'3'},dropoff:{country:'IL',city:'Haifa',street:'Herzl',number:'3'}},submit:true}});check(r.status,201,'translation + notary with two-way courier');
  check((await call('/api/orders/'+r.data.id,{as:'owner',method:'PATCH',body:{courier:'rider@example.test'}})).status,200,'assign courier');check((await call('/api/orders/'+r.data.id,{as:'owner'})).data.shipment,'Assigned','assignment moves delivery to Assigned');
  // Chat: visitor, staff reply, customer service inbox
  check((await call('/api/chat',{as:'visitor',method:'POST',body:{body:'Hi, how much for a birth certificate?',name:'Visitor',email:'visitor@example.test'}})).status,400,'visitor chat needs captcha');
  r=await call('/api/chat',{as:'visitor',method:'POST',body:{body:'Hi, how much for a birth certificate?',name:'Visitor',email:'visitor@example.test',captcha:'ok'}});check(r.status,201,'visitor starts a chat while ordering');const conv=r.data.id;
  r=await call('/api/chat',{as:'owner'});const inbox=r.data.find(c=>c.id===conv);check(Number(inbox.unread),1,'staff inbox shows unread message');
  check((await call('/api/chat/'+conv,{as:'owner',method:'POST',body:{body:'About 30 EUR per page.'}})).status,201,'staff reply');
  r=await call('/api/chat/'+conv,{as:'visitor'});check(r.data.messages.length,2,'visitor sees the reply');check(r.data.messages[1].sender_kind,'staff','reply from customer service');
  check((await call('/api/chat/'+conv,{as:'dana'})).status,404,'other people cannot read the chat');
  ok(await waitMail(m=>m.includes('owner@example.test')&&/New chat message/.test(m)),'staff emailed about the new chat');
  r=await call('/api/chat',{as:'dana',method:'POST',body:{body:'Question about my order',orderId:orderA}});check(r.status,201,'customer chat about an order');
  r=await call('/api/chat/'+r.data.id,{as:'owner'});ok(r.data.history.length>=3,'staff see the customer booking history');
  // Additional services inquiry
  check((await call('/api/inquiries',{method:'POST',body:{extraType:'Graphics and DTP',freeText:'Brochure design'}})).status,401,'inquiry needs an account');
  check((await call('/api/inquiries',{as:'dana',method:'POST',body:{extraType:'Graphics and DTP',description:'Brochure',freeText:'Please design a 4 page brochure'}})).status,201,'inquiry sent');
  ok((await call('/api/chat',{as:'owner'})).data.some(c=>c.kind==='inquiry'),'inquiry in the customer service inbox');
  // PDFs
  r=await call('/api/quote/pdf',{method:'POST',body:{payload:{service:'Certificate + notary',targets:['English'],source:'Hebrew',documents:[{name:'Birth',type:'Birth certificate',pages:1,words:0,format:'PDF'}]},lang:'he'}});check(r.status,200,'visitor downloads a quotation PDF');check(new TextDecoder().decode(r.bytes.slice(0,5)),'%PDF-','quotation is a PDF');
  r=await call('/api/orders/'+orderA+'/pdf',{as:'dana'});check(r.headers.get('content-type'),'application/pdf','order details as PDF');
  check((await call('/api/orders/'+orderA+'/pdf',{as:'rider'})).status,403,'couriers do not get order documents');
  r=await call('/api/reports/pdf',{as:'owner',method:'POST',body:{title:'Deliveries report',head:['Status','Customer'],rows:[['Process','Dana']],lang:'en'}});check(new TextDecoder().decode(r.bytes.slice(0,5)),'%PDF-','report PDF');
  r=await call('/api/orders/'+orderA+'/email',{as:'dana',method:'POST',body:{}});check(r.data.sent,true,'quote copy emailed');
  // Interface language and administrator texts
  check((await call('/api/texts',{as:'owner',method:'PUT',body:{lang:'he',source:'Translate',value:'תרגמו עכשיו'}})).status,200,'administrator edits a Hebrew text');
  r=await call('/order',{headers:{cookie:'verba_lang=he'}});ok(String(r.data).includes('dir="rtl"')&&String(r.data).includes('lang="he"'),'Hebrew pages are right-to-left');ok(String(r.data).includes('תרגמו עכשיו'),'administrator text shown');
  check((await call('/api/texts',{as:'dana',method:'PUT',body:{lang:'he',source:'Translate',value:'x'}})).status,403,'only administrators edit texts');
  // Social sign-in (Google, mocked)
  r=await call('/api/auth/oauth/google?return_to=/studio',{as:'social'});check(r.status,302,'social sign-in starts');const auth=new URL(r.headers.get('location'));check(auth.hostname,'accounts.google.com','redirects to Google');ok(auth.searchParams.get('code_challenge'),'PKCE used');const state=auth.searchParams.get('state');
  r=await call(`/api/auth/oauth/google/callback?code=good&state=wrong`,{as:'social'});ok(r.headers.get('location').includes('#error=state'),'wrong state refused');
  r=await call('/api/auth/oauth/google?return_to=/studio',{as:'social'});const state2=new URL(r.headers.get('location')).searchParams.get('state');void state;
  r=await call(`/api/auth/oauth/google/callback?code=good&state=${state2}`,{as:'social'});check(r.status,302,'callback completes');ok(r.headers.get('location').endsWith('/studio'),'returns to the requested page');
  r=await call('/api/workspace',{as:'social'});check(r.data.role,'customer','social account is a customer');check(r.data.user.emailVerified,true,'Google-confirmed email');
  // Profile and notifications log
  check((await call('/api/profile',{as:'dana',method:'PATCH',body:{firstName:'Dana',lastName:'Cohen',phonePrefix:'+972',phone:'0501234567',company:'Cohen Ltd',customerType:'Business',country:'IL',address:{country:'IL',city:'Haifa',street:'Herzl',number:'3'},language:'he',notify:['email','sms','whatsapp'],currency:'ILS'}})).status,200,'personal information saved');
  r=await call('/api/workspace',{as:'dana'});check(r.data.customerKind,'organization','business customers get organization pricing');
  r=await call('/api/notifications',{as:'owner'});ok(r.data.some(x=>x.channel==='email'&&x.status==='sent'),'email log');check((await call('/api/notifications',{as:'dana'})).status,403,'log is for administrators');
  // Member removal: history keeps them as deactivated
  r=await call('/api/team?email=rider@example.test',{as:'owner',method:'DELETE'});check(r.data.deactivated,true,'courier with history is deactivated');check((await call('/api/workspace',{as:'rider'})).status,401,'deactivated courier is signed out');
  check((await call('/api/team',{as:'owner',method:'POST',body:{email:'temp@example.test',name:'Temp',role:'staff'}})).status,200,'staff member added');r=await call('/api/team?email=temp@example.test',{as:'owner',method:'DELETE'});check(r.data.deactivated,false,'member without history is removed');
  check((await call('/api/team?email=owner@example.test',{as:'owner',method:'DELETE'})).status,400,'administrator cannot remove themselves');
  console.log(`PASS: ${n} spec 1.1.4 workflow assertions (sign-up, reset, social sign-in, uploads, deliveries, chat, PDFs, languages)`);
}catch(e){console.error(app.logs().slice(-5000));throw e;}finally{await app.stop();smtp.close();}

// Translation memory (learning, reuse, analysis, import/export, quotes) and the customer-service assistant
// (OpenAI mocked at the HTTP boundary): permissions, hand-off to a person, staff take-over and failures.
import assert from 'node:assert/strict';
import {startApp,caller} from './support/harness.mjs';
let count=0,deeplCalls=0,openaiCalls=0,openaiMode='normal',lastOpenai=null;
const check=(a,b,label)=>{assert.equal(a,b,label);count++;};
const app=await startApp({name:'memory',env:{DEEPL_API_KEY:'isolated-test-key-never-real',OPENAI_API_KEY:'isolated-openai-test-key'}});
app.setProvider(async req=>{const u=new URL(req.url);
  if(u.pathname==='/api.openai.com/v1/responses'){openaiCalls++;assert.equal(req.headers.get('authorization'),'Bearer isolated-openai-test-key');const b=await req.json();lastOpenai=b;
    if(openaiMode==='down')return new Response('{}',{status:500});
    if(openaiMode==='noreasoning'&&b.reasoning)return Response.json({error:{message:'Unsupported parameter: reasoning'}},{status:400});
    const last=[...b.input].reverse().find(m=>m.role==='user')?.content||'';const handoff=/refund/i.test(last);
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:handoff?'A member of our team will help with the refund.':'Prices start from €0.14 per word. Start at /order.',handoff})}]}]});}
  assert.equal(u.pathname,'/v2/translate');deeplCalls++;const b=await req.json();
  return Response.json({translations:b.text.map(t=>({text:'FR: '+t.trim(),billed_characters:t.length}))});});
const ids={owner:['o','owner@test.example'],customer:['c','customer@test.example'],staff:['s','staff@test.example'],other:['x','other@test.example']};
const call=caller(app,ids);
const job={title:'Synthetic memory text',source:'English',target:'French',sector:'General',tone:'Faithful',consent:true};
async function translate(text){const r=await call('/api/translations',{method:'POST',body:{...job,text,requestKey:crypto.randomUUID()}});const q=await call('/api/translations/'+r.data.id+'/advance',{method:'POST',body:{}});await call('/api/translations/'+r.data.id,{method:'PATCH',body:{action:'accept_quote',accepted:true,version:q.data.version,quoteId:q.data.quote.id}});let s;for(let i=0;i<10;i++){s=await call('/api/translations/'+r.data.id+'/advance',{method:'POST',body:{}});if(!['translating','reading','quoting'].includes(s.data.state))break;}return {quoted:q.data,done:s.data};}
const body=(n)=>Array.from({length:n},(_,i)=>`Synthetic sentence number ${i+1} describes the shipment of documents to the office.`).join(' ');
try{
  for(const [role,actor] of [['customer','customer'],['staff','staff']])check((await call('/api/team',{method:'POST',body:{name:'Synthetic '+role,email:ids[actor][1],role,area:''}})).status,200,'create '+role);
  // ---------- learning and exact reuse ----------
  const text='Take the tablets after breakfast.\n\nStore below 25 °C. Keep away from children.';
  let r=await translate(text);check(r.done.result.length>0,true,'first job translated');const first=deeplCalls;check(first>0,true,'first job used DeepL');
  const learned=(await app.db.query("SELECT quality,source_text FROM memory WHERE source_language='English' AND target_language='French'")).rows;
  check(learned.length>=3,true,'finished job taught the memory (sections and sentences)');check(learned.every(x=>x.quality==='machine'),true,'machine quality until approved');
  r=await translate(text);check(deeplCalls,first,'identical text reused from memory without DeepL');check(r.done.result.every(x=>x.memory===true),true,'sections marked as memory matches');check(r.done.usage.memory.sections,r.done.result.length,'reuse counted');
  check(r.quoted.quote.memory.bands.exact>0,true,'quote shows exact matches');
  r=await translate('Keep away from children. Take the tablets after breakfast.');check(deeplCalls,first,'every sentence found: section rebuilt from memory');// The mock prefixes "FR:" once per section, so the learned second sentence of "Store below 25 °C. Keep away…" has no prefix.
  check(r.done.result[0].translation,'Keep away from children. FR: Take the tablets after breakfast.','sentences joined in order from aligned memory entries');
  r=await translate('Take the tablets after lunch.');check(deeplCalls,first+1,'new sentence goes to DeepL');
  const uses=(await app.db.query('SELECT SUM(uses) AS n FROM memory')).rows[0].n;check(Number(uses)>0,true,'reuse counter updated');
  // approval upgrades the memory
  const approvedJob=(await translate('Approved wording sentence for the memory.')).done;
  check((await call('/api/translations/'+approvedJob.id,{method:'PATCH',body:{action:'edit',version:approvedJob.version,segments:[{id:approvedJob.result[0].id,translation:'Formulation approuvée.'}]}})).status,200,'reviewer edit');
  const edited=(await call('/api/translations/'+approvedJob.id)).data;
  check((await call('/api/translations/'+approvedJob.id,{method:'PATCH',body:{action:'approve',version:edited.version,attestation:true,note:'Synthetic approval of edited memory text.',resolutions:edited.issues.filter(i=>!i.resolved&&i.severity!=='info').map(i=>({id:i.id,note:'Synthetic resolution note for the memory test.'}))}})).status,200,'approved');
  const row=(await app.db.query("SELECT quality,target_text FROM memory WHERE source_text='Approved wording sentence for the memory.'")).rows[0];check(row.quality,'approved','approval upgrades the entry');check(row.target_text,'Formulation approuvée.','approved wording replaces machine output');
  // ---------- staff tools: import, search, match, export, edit, delete ----------
  const csv='source,target\n"The certificate was issued in Tel Aviv.","Le certificat a été délivré à Tel Aviv."\n"Blood pressure was 120/80 mmHg.","La tension artérielle était de 120/80 mmHg."\n"Please sign the form and return it within 14 days.","Veuillez signer le formulaire."';
  let fd=new FormData();fd.set('file',new File([csv],'tm.csv',{type:'text/csv'}));fd.set('source','English');fd.set('target','French');fd.set('sector','Legal');
  check((await call('/api/memory',{method:'POST',body:fd,actor:'customer'})).status,403,'customers cannot import');
  r=await call('/api/memory',{method:'POST',body:fd});check(r.status,201,'CSV imported');check(r.data.imported,3,'header row skipped');
  const tmx='<?xml version="1.0"?><tmx version="1.4"><body><tu><tuv xml:lang="en-US"><seg>The office is closed on Fridays.</seg></tuv><tuv xml:lang="fr-FR"><seg>Le bureau est fermé le vendredi &amp; samedi.</seg></tuv></tu><tu><tuv xml:lang="en"><seg>Only English here.</seg></tuv></tu></body></tmx>';
  fd=new FormData();fd.set('file',new File([tmx],'old.tmx'));fd.set('source','English');fd.set('target','French');r=await call('/api/memory',{method:'POST',body:fd});check(r.data.imported,1,'TMX units for the pair imported');
  const tmxRow=(await app.db.query("SELECT target_text,quality FROM memory WHERE source_text='The office is closed on Fridays.'")).rows[0];check(tmxRow.target_text,'Le bureau est fermé le vendredi & samedi.','TMX entities decoded');check(tmxRow.quality,'imported','imported quality');
  r=await call('/api/memory?q=certificate');check(r.data.total,1,'search finds entries');check(r.data.pairs[0].source_language,'English','pair statistics');
  check((await call('/api/memory',{actor:'customer'})).status,403,'memory list is staff only');check((await call('/api/memory',{actor:'staff'})).status,200,'staff can read the memory');
  r=await call('/api/memory/match',{method:'POST',body:{text:'The certificate was issued in Tel Aviv. Blood pressure was 130/85 mmHg. The certificate was issued in Tel Aviv. A brand new sentence here.',source:'English',target:'French'}});
  check(r.status,200,'match check');check(r.data.units[0].band,'exact','exact match');check(r.data.units[1].band,'high','numbers count as placeholders (95–99%)');check(r.data.units[2].band,'exact','repeat of a memory match still exact');check(r.data.units[3].band,'new','no match');check(r.data.summary.bands.repeat,7,'repetition inside the text counted');
  check(r.data.summary.effective<r.data.summary.words,true,'weighted words lower than total');
  const exp=await call('/api/memory/export?source=English&target=French');check(exp.status,200,'TMX export');check(exp.headers.get('content-type').includes('tmx'),true,'TMX type');check(new TextDecoder().decode(exp.bytes).includes('<seg>Le certificat a été délivré à Tel Aviv.</seg>'),true,'export contains entries');
  const entry=(await call('/api/memory?q=Fridays')).data.items[0];
  check((await call('/api/memory',{method:'PATCH',body:{id:entry.id,source_text:'The office is closed on Fridays.',target_text:'Le bureau est fermé le vendredi.'}})).status,200,'entry edited');
  check((await call('/api/memory',{method:'PATCH',body:{id:entry.id,source_text:'The certificate was issued in Tel Aviv.',target_text:'x'}})).status,409,'duplicate source refused');
  check((await call('/api/memory?id='+entry.id,{method:'DELETE'})).status,200,'entry deleted');check((await call('/api/memory?q=Fridays')).data.total,0,'entry gone');
  // ---------- orders: analysis and discount, recalculated on the server ----------
  const doc=body(40);fd=new FormData();fd.set('file',new File([doc],'repeat.txt',{type:'text/plain'}));const up=await call('/api/files',{method:'POST',body:fd,actor:'customer'});check(up.status,201,'customer upload');
  const order={service:'Document translation',sector:'General',source:'English',targets:['French'],documents:[{name:'Doc',type:'Document',pages:2,words:up.data.stats.words,format:'TXT',fileIds:[up.data.id]}],level:'Professional',firstName:'Syn',lastName:'Customer',email:ids.customer[1],phone:'500000000',agreed:true};
  r=await call('/api/memory/analyse',{method:'POST',actor:'customer',body:{service:'Document translation',source:'English',targets:['French'],fileIds:[up.data.id]}});check(r.data.memory.French.bands.new,up.data.stats.words,'nothing matched yet');
  check((await call('/api/memory/analyse',{method:'POST',actor:'other',body:{service:'Document translation',source:'English',targets:['French'],fileIds:[up.data.id]}})).data.memory,null,'other people cannot analyse my files');
  const plain=await call('/api/orders',{method:'POST',actor:'customer',body:{payload:{...order,memory:{French:{words:up.data.stats.words,bands:{exact:up.data.stats.words}}}}}});check(plain.status,201,'order saved');
  const saved=(await app.db.query('SELECT payload,total FROM orders WHERE id=$1',[plain.data.id])).rows[0];check(JSON.parse(saved.payload).memory.French.bands.exact||0,0,'browser-sent memory values ignored');
  fd=new FormData();fd.set('file',new File([body(40)],'tm2.csv'));
  const half=Array.from({length:20},(_,i)=>`"Synthetic sentence number ${i+1} describes the shipment of documents to the office.","FR ${i+1}"`).join('\n');fd=new FormData();fd.set('file',new File([half],'half.csv'));fd.set('source','English');fd.set('target','French');check((await call('/api/memory',{method:'POST',body:fd})).data.imported,20,'half of the document in memory');
  const fd2=new FormData();fd2.set('file',new File([doc],'repeat.txt',{type:'text/plain'}));const up2=await call('/api/files',{method:'POST',body:fd2,actor:'customer'});
  const discounted=await call('/api/orders',{method:'POST',actor:'customer',body:{payload:{...order,documents:[{...order.documents[0],fileIds:[up2.data.id]}]}}});check(discounted.status,201,'order with memory matches');
  const d=(await app.db.query('SELECT payload,total FROM orders WHERE id=$1',[discounted.data.id])).rows[0];const dp=JSON.parse(d.payload);
  check(dp.memory.French.bands.exact>0,true,'server analysed the uploaded file');check(dp._quote.lines.some(l=>l.key==='memory'&&l.amount<0),true,'memory discount line');check(Number(d.total)<Number(saved.total),true,'discounted total is lower');
  const pdf=await call('/api/quote/pdf',{method:'POST',actor:'customer',body:{payload:{...order,documents:[{...order.documents[0],fileIds:[up2.data.id]}]}}});check(pdf.status,200,'quotation PDF with memory');
  // ---------- assistant ----------
  r=await call('/api/chat',{method:'POST',actor:'customer',body:{body:'How much is a translation?',subject:'Prices and quotes'}});check(r.status,201,'conversation started');const conv=r.data.id;
  let t=await call('/api/chat/'+conv,{actor:'customer'});check(t.data.assistant.active,true,'assistant active for the conversation');check(t.data.conversation.assistant,'on','assistant handles it');
  r=await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'customer',body:{}});check(r.status,200,'assistant answered');check(r.data.assistant,'on','still with the assistant');
  check(lastOpenai.store,false,'conversations are not stored by OpenAI');check(lastOpenai.instructions.includes(dp._quote?'VB-':'VB-'),true,'customer orders in the instructions');check(lastOpenai.instructions.includes('Translation per word: Professional €0.14'),true,'price list in the instructions');check(lastOpenai.text.format.type,'json_schema','structured reply');check(lastOpenai.input.at(-1).content,'How much is a translation?','customer message sent');
  t=await call('/api/chat/'+conv,{actor:'customer'});const reply=t.data.messages.find(m=>m.sender_kind==='assistant');check(reply.body,'Prices start from €0.14 per word. Start at /order.','reply saved');check(reply.sender_name,'Verba assistant','assistant name');
  const before=openaiCalls;r=await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'customer',body:{}});check(r.data.skipped,true,'answered messages are not answered twice');check(openaiCalls,before,'no extra OpenAI call');
  check((await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'other',body:{}})).status,404,'other customers cannot use the conversation');
  let inbox=(await call('/api/chat?status=all',{actor:'staff'})).data.find(c=>c.id===conv);check(inbox.unread,0,'staff not alerted while the assistant handles it');check(inbox.last_sender,'assistant','last sender shown to staff');
  check((await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'customer',body:{draft:true}})).status,403,'customers cannot draft');
  r=await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'staff',body:{draft:true}});check(r.status,200,'staff draft');check(typeof r.data.draft,'string','draft text');
  // the assistant hands over (refund) — conversation waits for a person and staff are alerted
  await call('/api/chat/'+conv,{method:'POST',actor:'customer',body:{body:'I want a refund for my last order.'}});r=await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'customer',body:{}});check(r.data.assistant,'human','assistant handed over');
  t=await call('/api/chat/'+conv,{actor:'customer'});check(t.data.assistant.active,false,'assistant no longer active');check(t.data.messages.some(m=>m.sender_kind==='system'),true,'customer told a person will continue');
  await call('/api/chat/'+conv,{method:'POST',actor:'customer',body:{body:'Thank you, waiting.'}});inbox=(await call('/api/chat?status=all',{actor:'staff'})).data.find(c=>c.id===conv);check(inbox.unread>0,true,'staff alerted for a waiting customer');
  const calls2=openaiCalls;check((await call(`/api/chat/${conv}/assist`,{method:'POST',actor:'customer',body:{}})).data.skipped,true,'assistant stays quiet after hand-over');check(openaiCalls,calls2,'no OpenAI call after hand-over');
  check((await call('/api/chat/'+conv,{method:'PATCH',actor:'staff',body:{assistant:'on'}})).status,200,'staff can switch the assistant back on');
  await call('/api/chat/'+conv,{method:'POST',actor:'staff',body:{body:'Hello, this is the team.'}});check((await app.db.query('SELECT assistant FROM conversations WHERE id=$1',[conv])).rows[0].assistant,'human','a person replying takes over');
  // customer asks for a person; failures and models without reasoning
  r=await call('/api/chat',{method:'POST',actor:'customer',body:{body:'Hello again'}});const c2=r.data.id;
  r=await call(`/api/chat/${c2}/assist`,{method:'POST',actor:'customer',body:{handoff:true}});check(r.data.assistant,'human','customer asked for a person');
  openaiMode='noreasoning';r=await call('/api/chat',{method:'POST',actor:'customer',body:{body:'Question three'}});const c3=r.data.id;r=await call(`/api/chat/${c3}/assist`,{method:'POST',actor:'customer',body:{}});check(r.data.assistant,'on','retried without the reasoning option');check(lastOpenai.reasoning,undefined,'second request without reasoning');
  openaiMode='down';r=await call('/api/chat',{method:'POST',actor:'customer',body:{body:'Question four'}});const c4=r.data.id;r=await call(`/api/chat/${c4}/assist`,{method:'POST',actor:'customer',body:{}});check(r.data.ok,false,'assistant failure reported');check(r.data.assistant,'human','failure hands over to a person');openaiMode='normal';
  // visitors
  let res=await fetch(app.base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',origin:app.base},body:JSON.stringify({body:'Do you translate diplomas?',name:'Guest Person',email:'guest@test.example'})});check(res.status,201,'visitor conversation');const cookie=res.headers.get('set-cookie').split(';')[0];const g=(await res.json()).id;
  res=await fetch(app.base+`/api/chat/${g}/assist`,{method:'POST',headers:{'Content-Type':'application/json',origin:app.base,cookie},body:'{}'});check(res.status,200,'visitor gets an answer');check(lastOpenai.instructions.includes('visitor without an account'),true,'visitors have no orders in context');
  res=await fetch(app.base+`/api/chat/${g}/assist`,{method:'POST',headers:{'Content-Type':'application/json',origin:app.base},body:'{}'});check(res.status,404,'conversation private to its visitor');
  // switched off in settings
  const ws=(await call('/api/workspace')).data;check((await call('/api/workspace',{method:'PATCH',body:{name:ws.workspace,pricing:ws.pricing,config:{...ws.config,assistant:false}}})).status,200,'assistant switched off');
  r=await call('/api/chat',{method:'POST',actor:'customer',body:{body:'Anyone there?'}});check((await app.db.query('SELECT assistant FROM conversations WHERE id=$1',[r.data.id])).rows[0].assistant,'human','new conversations go to the team');check((await call(`/api/chat/${r.data.id}/assist`,{method:'POST',actor:'customer',body:{}})).data.skipped,true,'assistant does not answer when off');
  console.log(`PASS: ${count} translation-memory and assistant assertions (mock DeepL and OpenAI)`);
}catch(e){console.error(app.logs().slice(-4000));throw e;}finally{await app.stop();}

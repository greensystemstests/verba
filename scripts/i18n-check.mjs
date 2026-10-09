// Lists every interface text and checks that each has a Hebrew translation in
// lib/i18n/he.ts. Texts are the English strings passed to t('…'), error messages
// (HttpError and form validation), the order catalog values, and the sentence-like
// strings in the screen files below. Run: node scripts/i18n-check.mjs [--list]
import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const walk=d=>readdirSync(d).flatMap(f=>{const p=path.join(d,f);return statSync(p).isDirectory()?(f==='ui'||f==='node_modules'?[]:walk(p)):/\.(tsx?|mjs)$/.test(f)?[p]:[];});
const files=[...walk(path.join(root,'app')),...walk(path.join(root,'components')),...walk(path.join(root,'lib'))].filter(f=>!/pdf-fonts|lib\/i18n\//.test(f));
const texts=new Set();
const unescape=s=>s.replace(/\\'/g,"'").replace(/\\"/g,'"').replace(/\\n/g,'\n');
// Sentence-like literals in files that hold screen text in tables and maps.
const mapFiles=/components\/|app\/(privacy|terms|services)|lib\/(catalog|messages|order-text|notify|translation|translation-quote|accounts-server)\.ts/;
const sentence=s=>/^[A-Z0-9€£₪'(][^]*[a-z]/.test(s)&&(/\s/.test(s)||/^[A-Z][a-z]+$/.test(s))&&!/[<>=]|\$\{|^(Content|Cache|Set|Bearer|Basic|Apikey|Accept|Authorization|X-|application|text\/)/.test(s)&&s.length<=600&&!/^(INSERT|SELECT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/.test(s);
for(const f of files){
  const src=readFileSync(f,'utf8');
  for(const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g))texts.add(unescape(m[1]));
  for(const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g))texts.add(unescape(m[1]));
  for(const m of src.matchAll(/HttpError\(\d+,\s*'((?:[^'\\]|\\.)*)'/g))texts.add(unescape(m[1]));
  for(const m of src.matchAll(/HttpError\(\d+,\s*`([^`$]*)`/g))texts.add(m[1]);
  if(mapFiles.test(f.replaceAll('\\','/')))for(const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)){const s=unescape(m[1]);if(sentence(s)&&!(f.endsWith('lib/translation.ts')&&s.length>160))texts.add(s);}
}
const catalog=await import(path.join(root,'lib/catalog.ts'));
for(const k of ['services','sectors','languages','statuses','levels','urgencies','notaryTypes','subjects','documentTypes','certificateTypes','extraServices','timeWindows','deliveryTimings','paymentStates'])for(const v of catalog[k])texts.add(v);
for(const v of ['Awaiting assignment','Assigned','Collected','In transit','Delivered','Stopped','Cancelled','Open','admin','staff','customer','vendor','reviewer','notary','courier','sent','skipped','failed','1 way','2 way','Private','Business','DHL','UPS','FedEx','Machine translation','Professional translation','Student translation'])texts.add(v);
const ignore=new Set(JSON.parse(readFileSync(path.join(root,'scripts/i18n-ignore.json'),'utf8')));
const {he}=await import(path.join(root,'lib/i18n/he.ts'));
const missing=[...texts].filter(s=>!ignore.has(s)&&!(s in he)&&/[A-Za-z]/.test(s)).sort();
if(process.argv.includes('--list')){console.log(JSON.stringify(missing,null,1));process.exit(0);}
const placeholders=s=>(s.match(/\{\w+\}/g)||[]).sort().join();
const broken=Object.entries(he).filter(([en,h])=>placeholders(en)!==placeholders(h)).map(([en])=>en);
if(missing.length||broken.length){if(missing.length)console.error(`Missing Hebrew for ${missing.length} texts:\n`+missing.slice(0,50).join('\n'));if(broken.length)console.error('Placeholder mismatch:\n'+broken.join('\n'));process.exit(1);}
console.log(`PASS: ${texts.size} interface texts, all with Hebrew translations (${Object.keys(he).length} entries)`);

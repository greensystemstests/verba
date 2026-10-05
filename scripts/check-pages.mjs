// Verifies the built static site: every local link/asset resolves to a file, links to
// app pages use the app origin, and nothing points at localhost or a wrong base path.
import {readdirSync,readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'pages-dist');
const appOrigin=(process.env.PAGES_APP_ORIGIN||'https://verba-x863.onrender.com').replace(/\/+$/,'');
const base=(process.env.PAGES_BASE_PATH??'/verba').replace(/\/+$/,'');
const walk=d=>readdirSync(d).flatMap(f=>{const p=path.join(d,f);return statSync(p).isDirectory()?walk(p):[p];});
const files=walk(dist);const html=files.filter(f=>f.endsWith('.html'));
const problems=[];let checked=0;
const resolves=url=>{let p=decodeURIComponent(url.split('#')[0].split('?')[0]);if(!p.startsWith(base+'/')&&p!==base)return false;p=p.slice(base.length)||'/';const abs=path.join(dist,p);return [abs,path.join(abs,'index.html'),abs+'.html'].some(c=>existsSync(c)&&statSync(c).isFile());};
for(const file of html){const rel=path.relative(dist,file);const text=readFileSync(file,'utf8');
 if(/localhost|127\.0\.0\.1/.test(text))problems.push(`${rel}: contains a localhost address`);
 for(const m of text.matchAll(/\s(?:href|src)="([^"]+)"/g)){const url=m[1];checked++;
  if(url.startsWith('#')||url.startsWith('data:')||url.startsWith('mailto:'))continue;
  if(/^https?:\/\//.test(url)){if(url.startsWith(appOrigin)||/^https:\/\/(fonts\.googleapis|fonts\.gstatic)\./.test(url))continue;problems.push(`${rel}: unexpected external URL ${url}`);continue;}
  if(!url.startsWith('/')){problems.push(`${rel}: relative URL ${url}`);continue;}
  if(!resolves(url))problems.push(`${rel}: ${url} does not resolve to a file under ${base||'/'}`);}}
for(const need of ['index.html','services/index.html','privacy/index.html','terms/index.html','404.html','.nojekyll','favicon.svg'])if(!existsSync(path.join(dist,need)))problems.push('missing '+need);
const home=readFileSync(path.join(dist,'index.html'),'utf8');
for(const [label,href] of [['Translate',appOrigin+'/'],['Specialist services',appOrigin+'/order'],['My workspace',appOrigin+'/studio']])if(!home.includes(`href="${href}"`))problems.push(`header link "${label}" should point to ${href}`);
if(!home.includes(`href="${base}/services/#process"`)&&!home.includes(`href="${base}/services#process"`))problems.push('"How it works" should stay on the static site');
if(!files.some(f=>f.endsWith('.js')&&readFileSync(f,'utf8').includes(appOrigin+'/api/auth/status')||readFileSync(f,'utf8').includes('/api/auth/status')))problems.push('warm-up request missing from the bundle');
console.log(`Checked ${html.length} pages and ${checked} links/assets.`);
if(problems.length){console.error('\nProblems:\n - '+[...new Set(problems)].join('\n - '));process.exit(1);}
console.log('Static site checks passed.');

// Builds the static GitHub Pages site (services, privacy, terms) into ./pages-dist.
// Only pages that need no server are included. The translator, orders, accounts and
// workspace stay on the Render app; links to them point at PAGES_APP_ORIGIN, and the
// static pages quietly wake that app so it is ready by the time a visitor clicks.
//   PAGES_APP_ORIGIN  default https://verba-x863.onrender.com
//   PAGES_BASE_PATH   default /verba  (use "" for a custom domain at the root)
import {cpSync,rmSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.join(root,'.pages-build');
const dist=path.join(root,'pages-dist');
const appOrigin=(process.env.PAGES_APP_ORIGIN||'https://verba-x863.onrender.com').replace(/\/+$/,'');
const base=(process.env.PAGES_BASE_PATH??'/verba').replace(/\/+$/,'');
if(!/^https:\/\/[^/\s]+$/.test(appOrigin)){console.error('PAGES_APP_ORIGIN must be an https origin, e.g. https://verba-x863.onrender.com');process.exit(1);}
if(base&&!/^\/[\w.-]+(\/[\w.-]+)*$/.test(base)){console.error('PAGES_BASE_PATH must look like /verba (or be empty)');process.exit(1);}

rmSync(work,{recursive:true,force:true});rmSync(dist,{recursive:true,force:true});
mkdirSync(path.join(work,'app'),{recursive:true});
const copy=(from,to=from)=>cpSync(path.join(root,from),path.join(work,to),{recursive:true});
for(const page of ['services','privacy','terms'])copy('app/'+page);
for(const f of ['app/globals.css','components/verba-ui.tsx','components/ui','hooks','lib/utils.ts','lib/catalog.ts','lib/links.ts','vendor','public','postcss.config.mjs'])copy(f);
const write=(f,s)=>writeFileSync(path.join(work,f),s);
write('package.json',JSON.stringify({name:'verba-pages',private:true,type:'module'}));
write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',skipLibCheck:true,incremental:true,plugins:[{name:'next'}],paths:{'@/*':['./*']},types:['node']},include:['**/*.ts','**/*.tsx','next-env.d.ts'],exclude:['node_modules']}));
write('next.config.mjs',`export default {output:'export',trailingSlash:true,images:{unoptimized:true},basePath:${JSON.stringify(base)},turbopack:{root:${JSON.stringify(root)}}};\n`);
write('app/warm-up.tsx',`'use client';
import {useEffect} from 'react';
// Fire-and-forget request that wakes the (free-plan) app server while the visitor reads.
export default function WarmUp(){useEffect(()=>{const origin=process.env.NEXT_PUBLIC_APP_ORIGIN;if(!origin)return;fetch(origin+'/api/auth/status',{mode:'no-cors',cache:'no-store',credentials:'omit'}).catch(()=>{});},[]);return null;}
`);
write('app/layout.tsx',`import type {Metadata} from 'next';
import './globals.css';
import WarmUp from './warm-up';
export const metadata:Metadata={title:'Verba — Translation, without the back-and-forth',description:'Specialist translation in medical, legal, finance, technology and marketing. Estimate, manage and deliver every project in one workspace.',icons:{icon:(process.env.NEXT_PUBLIC_SITE_BASE||'')+'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className="antialiased">{children}<WarmUp/></body></html>;}
`);
write('app/page.tsx',"export {default} from './services/page';\n");

const result=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build'],{cwd:work,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_APP_ORIGIN:appOrigin,NEXT_PUBLIC_SITE_BASE:base,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production'}});
if(result.status!==0){console.error('Static build failed');process.exit(result.status||1);}
if(!existsSync(path.join(work,'out/index.html'))){console.error('Static build produced no index.html');process.exit(1);}
cpSync(path.join(work,'out'),dist,{recursive:true});
writeFileSync(path.join(dist,'.nojekyll'),'');
console.log(`\nStatic site written to pages-dist (base "${base||'/'}", app ${appOrigin})`);

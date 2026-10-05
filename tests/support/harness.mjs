// Starts the production build (`next start`) against a fresh PostgreSQL database
// with a mock AI provider at the outbound HTTP boundary. Requires `npm run build`
// and TEST_DATABASE_URL (a server where test databases may be created/dropped).
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../../scripts/migrate.mjs';
import {createInvite} from '../../scripts/lib/invite.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
async function freePort(){const s=createServer();const p=await listen(s);await new Promise(r=>s.close(r));return p;}
export async function startApp({name,env={}}){const admin=process.env.TEST_DATABASE_URL;if(!admin)throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL server');const dbName='verba_test_'+name.replace(/\W/g,'_')+'_'+process.pid;const adminClient=new pg.Client({connectionString:admin});await adminClient.connect();await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);await adminClient.query(`CREATE DATABASE ${dbName}`);const url=new URL(admin);url.pathname='/'+dbName;const databaseUrl=url.toString();await migrate(databaseUrl,{log:()=>{}});const db=new pg.Client({connectionString:databaseUrl});await db.connect();
let handler=async()=>Response.json({error:'No provider mock configured'},{status:500});
const mock=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('https://api.openai.com'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});try{const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(String(e));}});const mockPort=await listen(mock);
const port=await freePort();const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p',String(port),'-H','127.0.0.1'],{cwd:root,env:{...process.env,DATABASE_URL:databaseUrl,PROVIDER_TEST_REDIRECT:'http://127.0.0.1:'+mockPort,NODE_OPTIONS:'--import '+path.join(root,'tests/support/provider-redirect.mjs'),OPENAI_API_KEY:'',OPENAI_MODEL:'',NODE_ENV:'production',...env},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
const base='http://127.0.0.1:'+port;for(let i=0;;i++){try{const r=await fetch(base+'/api/auth/status');if(r.status===200)break;}catch{}if(i>150||child.exitCode!==null)throw new Error('App did not start:\n'+output);await new Promise(r=>setTimeout(r,200));}
const sessions=new Map();
async function sessionFor(actor,identities){if(sessions.has(actor))return sessions.get(actor);const email=identities[actor][1];const invite=await createInvite(db,{email,name:'Synthetic '+actor});const r=await fetch(base+'/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite:invite.token,name:'Synthetic '+actor,password:'Synthetic test password only 123!'})});if(r.status!==201)throw new Error('fixture signup failed '+r.status+' '+await r.text());const cookie=r.headers.get('set-cookie').split(';')[0];sessions.set(actor,cookie);return cookie;}
async function stop(){child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await new Promise(r=>mock.close(r));await db.end();await adminClient.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);await adminClient.end();}
return {base,db,setProvider:h=>{handler=h;},sessionFor,stop,logs:()=>output};}
// fetch wrapper returning {status,data,bytes,headers}.
export function caller(app,identities){return async function call(route,{actor='owner',method='GET',body,headers={}}={}){const h={...headers};if(actor)h.cookie=await app.sessionFor(actor,identities);if(body!==undefined&&!(body instanceof FormData)){h['Content-Type']='application/json';body=JSON.stringify(body);}const r=await fetch(app.base+route,{method,headers:h,body,redirect:'manual'});const bytes=new Uint8Array(await r.arrayBuffer());const text=new TextDecoder().decode(bytes);let data;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data,bytes,headers:r.headers};};}

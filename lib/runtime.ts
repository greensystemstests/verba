// Server runtime: environment, PostgreSQL (Neon) database and private file storage.
// The database wrapper keeps the prepare/bind/first/all/run/batch call shape the
// routes were written against, translating `?` placeholders to PostgreSQL `$n`.
/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped, matching the D1 API the routes use */
import pg from 'pg';

type Env={DATABASE_URL?:string;OPENAI_API_KEY?:string;OPENAI_MODEL?:string;APP_ORIGIN?:string;RENDER_EXTERNAL_URL?:string};
export const runtime=()=>({...(process.env as Env),DB:db(),BUCKET:bucket});

// COUNT(*) and other int8 values are returned as numbers, not strings.
pg.types.setTypeParser(20,v=>Number(v));

const globalPool=globalThis as unknown as {__verbaPool?:pg.Pool};
function pool(){if(!globalPool.__verbaPool){const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL is not configured');globalPool.__verbaPool=new pg.Pool({connectionString,max:Number(process.env.DATABASE_POOL_MAX||5),idleTimeoutMillis:30000,connectionTimeoutMillis:15000});globalPool.__verbaPool.on('error',e=>console.error('Database pool error',e.message));}return globalPool.__verbaPool;}

type Meta={changes:number};
export type RunResult={meta:Meta};
export type AllResult<T>={results:T[];meta:Meta};
type Queryable={query:(text:string,values?:unknown[])=>Promise<pg.QueryResult>};

function toPostgres(sql:string,previousChanges=0){let n=0;let out='';let quote:string|null=null;for(const ch of sql){if(quote){out+=ch;if(ch===quote)quote=null;continue;}if(ch==="'"||ch==='"'){quote=ch;out+=ch;continue;}out+=ch==='?'?'$'+(++n):ch;}
// SQLite's changes() reports rows changed by the previous statement in a batch.
return out.replace(/\bchanges\(\)/g,String(previousChanges));}

export class Statement{constructor(readonly sql:string,readonly values:unknown[]=[]){}
bind(...values:unknown[]){return new Statement(this.sql,values.map(v=>v===undefined?null:v));}
async execute(client:Queryable=pool(),previousChanges=0){return client.query(toPostgres(this.sql,previousChanges),this.values);}
async first<T=any>():Promise<T|null>{const r=await this.execute();return (r.rows[0]??null) as T|null;}
async all<T=any>():Promise<AllResult<T>>{const r=await this.execute();return {results:r.rows as T[],meta:{changes:r.rowCount??0}};}
async run():Promise<RunResult&{results:any[]}>{const r=await this.execute();return {results:r.rows,meta:{changes:r.rowCount??0}};}}

const database={prepare:(sql:string)=>new Statement(sql),
// Runs every statement in one transaction, like a D1 batch: all succeed or none apply.
async batch(statements:Statement[]){const client=await pool().connect();try{await client.query('BEGIN');const results:(AllResult<any>)[]=[];let previous=0;for(const s of statements){const r=await s.execute(client,previous);previous=r.command==='SELECT'?previous:(r.rowCount??0);results.push({results:r.rows,meta:{changes:r.rowCount??0}});}await client.query('COMMIT');return results;}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}};
export const db=()=>database;

// Private document storage kept in PostgreSQL (bytea). Files are limited to 10 MB.
export type StoredObject={body:ReadableStream<Uint8Array>;arrayBuffer:()=>Promise<ArrayBuffer>;contentType:string};
export const bucket={
async put(id:string,bytes:Uint8Array,options?:{httpMetadata?:{contentType?:string}}){await database.prepare('INSERT INTO file_objects (id,data,content_type,created) VALUES (?,?,?,?)').bind(id,Buffer.from(bytes),options?.httpMetadata?.contentType||'application/octet-stream',new Date().toISOString()).run();},
async get(id:string):Promise<StoredObject|null>{const row=await database.prepare('SELECT data,content_type FROM file_objects WHERE id=?').bind(id).first<{data:Buffer;content_type:string}>();if(!row)return null;const bytes=new Uint8Array(row.data);return {contentType:row.content_type,arrayBuffer:async()=>bytes.slice().buffer,get body(){return new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);c.close();}});}};},
async delete(id:string){await database.prepare('DELETE FROM file_objects WHERE id=?').bind(id).run();}};

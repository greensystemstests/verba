// Applies drizzle/*.sql migrations to DATABASE_URL in order. Applied files are
// recorded in verba_migrations; deployed migrations are immutable, so new
// changes must be appended as new files. Safe to run on every start.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../drizzle');
export async function migrate(connectionString,{log=console.log}={}){const client=new pg.Client({connectionString});await client.connect();try{await client.query('SELECT pg_advisory_lock(hashtext($1))',['verba-migrations']);await client.query('CREATE TABLE IF NOT EXISTS verba_migrations (name text PRIMARY KEY, applied text NOT NULL)');const done=new Set((await client.query('SELECT name FROM verba_migrations')).rows.map(r=>r.name));const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();let applied=0;for(const file of files){if(done.has(file))continue;const statements=(await readFile(path.join(dir,file),'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);await client.query('BEGIN');try{for(const s of statements)await client.query(s);await client.query('INSERT INTO verba_migrations (name,applied) VALUES ($1,$2)',[file,new Date().toISOString()]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw new Error(`Migration ${file} failed: ${e.message}`);}applied++;log(`Applied migration ${file}`);}log(applied?`Database schema up to date (${applied} applied).`:'Database schema up to date.');}finally{await client.query('SELECT pg_advisory_unlock(hashtext($1))',['verba-migrations']).catch(()=>{});await client.end();}}
if(process.argv[1]===fileURLToPath(import.meta.url)){const url=process.env.DATABASE_URL;if(!url){console.error('DATABASE_URL is not set');process.exit(1);}migrate(url).catch(e=>{console.error(e.message);process.exit(1);});}

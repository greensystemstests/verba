import {context,db,failure,HttpError,sameOrigin} from '@/lib/server';
import {languages,sectors} from '@/lib/catalog';
import {learn,parseTmx,parseColumns,memoryKey} from '@/lib/memory';
import {deeplLanguage} from '@/lib/deepl-languages';
import {z} from 'zod';
// Translation memory for staff: search, statistics per language pair, import (TMX, CSV, TSV), edit and delete.
const staffOnly=async(r?:Request)=>{const c=await context(r);if(!c.staff)throw new HttpError(403,'Staff access required');return c;};
export async function GET(r:Request){try{const c=await staffOnly();const u=new URL(r.url);
  const q=(u.searchParams.get('q')||'').trim().slice(0,200);const source=u.searchParams.get('source')||'';const target=u.searchParams.get('target')||'';const page=Math.max(0,Number(u.searchParams.get('page'))||0);
  const where=['workspace=?'];const args:unknown[]=[c.workspace.id];
  if(source){where.push('source_language=?');args.push(source);}if(target){where.push('target_language=?');args.push(target);}
  if(q){where.push('(source_text ILIKE ? OR target_text ILIKE ?)');const like='%'+q.replace(/[\\%_]/g,m=>'\\'+m)+'%';args.push(like,like);}
  const items=(await db().prepare(`SELECT id,source_language,target_language,sector,source_text,target_text,words,quality,uses,updated FROM memory WHERE ${where.join(' AND ')} ORDER BY updated DESC LIMIT 50 OFFSET ?`).bind(...args,page*50).all()).results;
  const total=Number((await db().prepare(`SELECT COUNT(*) AS n FROM memory WHERE ${where.join(' AND ')}`).bind(...args).first<{n:number}>())?.n||0);
  const pairs=(await db().prepare('SELECT source_language,target_language,COUNT(*) AS entries,SUM(words) AS words,SUM(uses) AS uses,MAX(updated) AS updated FROM memory WHERE workspace=? GROUP BY source_language,target_language ORDER BY entries DESC').bind(c.workspace.id).all()).results;
  return Response.json({items,total,page,pairs},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
// Import: multipart form with file, source, target, sector.
export async function POST(r:Request){try{sameOrigin(r);const c=await staffOnly(r);const form=await r.formData();
  const f=form.get('file');const source=String(form.get('source')||'');const target=String(form.get('target')||'');const sector=String(form.get('sector')||'General');
  if(!(languages as readonly string[]).includes(source)||!(languages as readonly string[]).includes(target)||source===target)throw new HttpError(400,'Choose two different languages');
  if(!(f instanceof File)||!f.size||f.size>20*1024*1024)throw new HttpError(400,'Choose a TMX, CSV or TSV file up to 20 MB');
  const text=await f.text();const ext=f.name.split('.').pop()?.toLowerCase();
  const code=(l:string)=>(deeplLanguage(l)?.source||l.slice(0,2)).toLowerCase();
  const pairs=ext==='tmx'||/<tmx[\s>]/.test(text.slice(0,2000))?parseTmx(text,code(source),code(target)):parseColumns(text);
  if(!pairs.length)throw new HttpError(422,ext==='tmx'?'No translation units for this language pair were found in the TMX file.':'No rows with two columns (source and target) were found.');
  const added=await learn(c.workspace.id,{source,target,sector:(sectors as readonly string[]).includes(sector)?sector:'General',quality:'imported',origin:'import:'+f.name.slice(0,120)},pairs.slice(0,50000));
  return Response.json({imported:added,skipped:Math.max(0,pairs.length-added)},{status:201});}catch(e){return failure(e);}}
const edit=z.object({id:z.string().uuid(),source_text:z.string().trim().min(1).max(8000),target_text:z.string().trim().min(1).max(12000)});
export async function PATCH(r:Request){try{sameOrigin(r);const c=await staffOnly(r);const p=edit.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Enter the source and the translation');
  const now=new Date().toISOString();
  const res=await db().prepare("UPDATE memory SET source_text=?,target_text=?,source_key=?,quality='approved',updated=? WHERE id=? AND workspace=? AND NOT EXISTS (SELECT 1 FROM memory m WHERE m.workspace=memory.workspace AND m.source_language=memory.source_language AND m.target_language=memory.target_language AND m.source_key=? AND m.id<>memory.id)").bind(p.data.source_text,p.data.target_text,memoryKey(p.data.source_text),now,p.data.id,c.workspace.id,memoryKey(p.data.source_text)).run();
  if(!res.meta.changes)throw new HttpError(409,'This source sentence is already in the memory for the language pair.');
  return Response.json({ok:true});}catch(e){return failure(e);}}
export async function DELETE(r:Request){try{sameOrigin(r);const c=await staffOnly(r);const u=new URL(r.url);const id=u.searchParams.get('id');const source=u.searchParams.get('source');const target=u.searchParams.get('target');
  if(id){await db().prepare('DELETE FROM memory WHERE id=? AND workspace=?').bind(id,c.workspace.id).run();return Response.json({ok:true});}
  if(source&&target&&c.admin){const res=await db().prepare('DELETE FROM memory WHERE workspace=? AND source_language=? AND target_language=?').bind(c.workspace.id,source,target).run();return Response.json({deleted:res.meta.changes});}
  throw new HttpError(400,'Choose an entry or a language pair');}catch(e){return failure(e);}}

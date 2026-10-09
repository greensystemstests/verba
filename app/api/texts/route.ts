import {context,db,failure,admin,HttpError} from '@/lib/server';
import {dictionaries} from '@/lib/i18n/core';
import {clearTextCache} from '@/lib/i18n-server';
import {z} from 'zod';
// Interface texts per language (spec: language definition is done by entering the data in the required language).
export async function GET(){try{const c=await context();admin(c);const rows=(await db().prepare('SELECT lang,source,value FROM ui_texts').all<{lang:string;source:string;value:string}>()).results;
  return Response.json({sources:Object.keys(dictionaries.he).sort((a,b)=>a.localeCompare(b)),builtin:dictionaries,overrides:rows});}catch(e){return failure(e);}}
export async function PUT(r:Request){try{const c=await context(r);admin(c);const p=z.object({lang:z.enum(['en','he']),source:z.string().min(1).max(2000),value:z.string().max(4000)}).safeParse(await r.json());if(!p.success)throw new HttpError(400,'Invalid text');
  const {lang,source,value}=p.data;
  if(!value.trim()||value===(dictionaries[lang][source]??source))await db().prepare('DELETE FROM ui_texts WHERE lang=? AND source=?').bind(lang,source).run();
  else await db().prepare('INSERT INTO ui_texts (lang,source,value,updated) VALUES (?,?,?,?) ON CONFLICT (lang,source) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(lang,source,value,new Date().toISOString()).run();
  clearTextCache();return Response.json({ok:true});}catch(e){return failure(e);}}

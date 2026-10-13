import {context,db,failure,HttpError} from '@/lib/server';
import {toTmx} from '@/lib/memory';
import {deeplLanguage} from '@/lib/deepl-languages';
// Exports one language pair of the translation memory as TMX 1.4.
export async function GET(r:Request){try{const c=await context();if(!c.staff)throw new HttpError(403,'Staff access required');
  const u=new URL(r.url);const source=u.searchParams.get('source')||'';const target=u.searchParams.get('target')||'';if(!source||!target)throw new HttpError(400,'Choose a language pair');
  const rows=(await db().prepare('SELECT source_text,target_text FROM memory WHERE workspace=? AND source_language=? AND target_language=? ORDER BY created LIMIT 200000').bind(c.workspace.id,source,target).all<{source_text:string;target_text:string}>()).results;
  const code=(l:string)=>(deeplLanguage(l)?.target||l.slice(0,2)).toLowerCase();
  const name=`verba-memory-${code(source)}-${code(target)}.tmx`;
  return new Response(toTmx(rows,code(source),code(target)),{headers:{'Content-Type':'application/x-tmx+xml; charset=utf-8','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'}});}catch(e){return failure(e);}}

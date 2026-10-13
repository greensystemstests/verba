import {context,failure,HttpError,sameOrigin} from '@/lib/server';
import {languages} from '@/lib/catalog';
import {matchText,analyse,memoryWeights} from '@/lib/memory';
import {z} from 'zod';
// Staff tool: checks a pasted text against the translation memory, sentence by sentence.
const input=z.object({text:z.string().trim().min(1).max(30000),source:z.enum(languages),target:z.enum(languages)});
export async function POST(r:Request){try{sameOrigin(r);const c=await context(r);if(!c.staff)throw new HttpError(403,'Staff access required');
  const p=input.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Paste a text up to 30,000 characters and choose two languages');
  const [units,summary]=await Promise.all([matchText(c.workspace.id,p.data.text,p.data.source,p.data.target),analyse(c.workspace.id,p.data.text,p.data.source,[p.data.target],memoryWeights(c.pricing.factors))]);
  return Response.json({units,summary:summary[p.data.target]});}catch(e){return failure(e);}}

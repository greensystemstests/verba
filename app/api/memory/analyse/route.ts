import {failure,HttpError,sameOrigin,clientAddress} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {basePricing,languages,services} from '@/lib/catalog';
import {orderMemory} from '@/lib/memory';
import {readableFiles} from '@/lib/upload-target';
import {z} from 'zod';
// Translation-memory analysis of uploaded files for the order form ("accurate analysis", spec 1.1). Visitors included.
const input=z.object({service:z.enum(services),source:z.enum(languages),targets:z.array(z.enum(languages)).max(8),fileIds:z.array(z.string().uuid()).max(20)});
export async function POST(r:Request){try{sameOrigin(r);
  if(!await authLimit('memory-analyse:'+clientAddress(r),120,60))throw new HttpError(429,'Too many requests. Try again later.');
  const p=input.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Invalid analysis request');
  const files=await readableFiles(p.data.fileIds);if(!files.workspace||!files.ids.length)return Response.json({memory:null});
  const memory=await orderMemory(files.workspace,{service:p.data.service,source:p.data.source,targets:p.data.targets,documents:[{fileIds:files.ids} as never]},files.pricing||basePricing);
  return Response.json({memory},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}

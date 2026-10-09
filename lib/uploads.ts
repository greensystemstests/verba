// Stores an uploaded document after format, size and safety checks, and counts its words.
import {db,runtime,HttpError,event,type Ctx,type OrderRow} from './server';
import {validDocx} from './file-validation';
import {scanUpload,documentStats,type DocStats} from './doc-scan';
export const MAX_UPLOAD=10*1024*1024;
export const allowedTypes:Record<string,string>={pdf:'application/pdf',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
export function checkName(name:string){const ext=name.split('.').pop()?.toLowerCase();if(!ext||!allowedTypes[ext])throw new HttpError(400,'Supported formats: PDF, DOCX, TXT, JPG, PNG');return ext;}
export type Target={ownerKey:string;workspace:string;actor:string;orderId:string|null;purpose:'source'|'delivery'};
// Decides who may attach a file to an order, and whether it can be a delivered result.
export function checkOrderUpload(c:Ctx,o:OrderRow,purpose:string){
  const me=c.member.email;
  if(!c.staff&&o.owner!==c.u.userId&&o.assignee!==me&&o.vendor!==me)throw new HttpError(403,'Document access is limited to the customer and assigned specialist');
  if(purpose==='delivery'&&!c.staff&&!(c.role==='notary'&&o.assignee===me)&&!(c.role==='vendor'&&o.vendor===me))throw new HttpError(403,'Only the assigned specialist can deliver a file');
}
export async function storeUpload(bytes:Uint8Array,name:string,t:Target):Promise<{id:string;name:string;size:number;stats:DocStats}>{
  if(bytes.length===0||bytes.length>MAX_UPLOAD)throw new HttpError(400,'Choose a file between 1 byte and 10 MB');
  const ext=checkName(name);
  const head=new TextDecoder().decode(bytes.slice(0,8));
  if((ext==='pdf'&&!head.startsWith('%PDF-'))||(ext==='png'&&!(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71))||(['jpg','jpeg'].includes(ext)&&!(bytes[0]===255&&bytes[1]===216))||(ext==='docx'&&!validDocx(bytes)))throw new HttpError(400,'The file content does not match its extension');
  const scan=await scanUpload(bytes,ext,name);if(!scan.ok)throw new HttpError(400,scan.reason);
  const stats=await documentStats(bytes,ext);
  const id=crypto.randomUUID();
  await runtime().BUCKET.put(id,bytes,{httpMetadata:{contentType:allowedTypes[ext]}});
  try{await db().prepare('INSERT INTO files (id,workspace,owner,order_id,name,type,size,purpose,created) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,t.workspace,t.ownerKey,t.orderId,name.slice(0,180),allowedTypes[ext],bytes.length,t.purpose,new Date().toISOString()).run();}
  catch(e){await runtime().BUCKET.delete(id);throw e;}
  if(t.orderId)await event(t.workspace,t.orderId,t.actor,t.purpose==='delivery'?'Completed file uploaded':'Source file uploaded').run();
  return {id,name,size:bytes.length,stats};
}
// Visitors' unclaimed uploads are removed after two days.
export async function purgeGuestFiles(){
  const cutoff=new Date(Date.now()-2*86400000).toISOString();
  const old=(await db().prepare("SELECT id FROM files WHERE owner LIKE 'guest:%' AND order_id IS NULL AND created < ? LIMIT 50").bind(cutoff).all<{id:string}>()).results;
  for(const f of old){await runtime().BUCKET.delete(f.id);await db().prepare('DELETE FROM files WHERE id=?').bind(f.id).run();}
  await db().prepare('DELETE FROM upload_chunks WHERE created < ?').bind(new Date(Date.now()-3600000).toISOString()).run();
}

import {context,db,failure,access,runtime,HttpError} from '@/lib/server';
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context();const f=await db().prepare('SELECT * FROM files WHERE id = ? AND workspace = ?').bind((await params).id,c.workspace.id).first<{id:string;owner:string;order_id:string|null;name:string}>();if(!f)throw new HttpError(404,'File not found');
  if(f.order_id){const o=await access(c,f.order_id);const me=c.member.email;if(!c.staff&&o.owner!==c.u.userId&&o.assignee!==me&&o.vendor!==me)throw new HttpError(403,'Document access is limited to the customer and assigned specialist');}
  else if(f.owner!==c.u.userId)throw new HttpError(403,'Access denied');
  const object=await runtime().BUCKET.get(f.id);if(!object)throw new HttpError(404,'File not found');
  return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return failure(e);}}

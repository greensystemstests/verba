import {optionalContext,db,failure,HttpError,sameOrigin,siteOrigin,clientAddress} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {viewer,conversationAccess,addMessage,tellCustomer} from '@/lib/chat';
import {z} from 'zod';
// Messages after a timestamp (the chat window asks every few seconds), plus, for staff,
// the customer's order history.
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await optionalContext();const {v}=await viewer(c);if(!v)throw new HttpError(404,'Conversation not found');
  const conv=await conversationAccess(v,(await params).id);const after=new URL(r.url).searchParams.get('after')||'';
  const messages=(await db().prepare('SELECT id,sender_kind,sender_name,body,created FROM conversation_messages WHERE conversation_id=? AND created>? ORDER BY created LIMIT 500').bind(conv.id,after).all()).results;
  const now=new Date().toISOString();
  await db().prepare(`UPDATE conversations SET ${v.kind==='staff'?'staff_read_at':'customer_read_at'}=? WHERE id=?`).bind(now,conv.id).run();
  let history:unknown[]=[];
  if(v.kind==='staff'&&conv.account_id)history=(await db().prepare('SELECT id,reference,status,total,payment,created FROM orders WHERE owner=? AND workspace=? ORDER BY created DESC LIMIT 50').bind(conv.account_id,conv.workspace).all()).results;
  return Response.json({conversation:{...conv,guest_hash:undefined},messages,history},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){try{sameOrigin(r);const c=await optionalContext(r);const {v}=await viewer(c);if(!v)throw new HttpError(404,'Conversation not found');
  if(!await authLimit('chat-send:'+(v.kind==='guest'?v.key:v.c.u.userId)+clientAddress(r),60,15))throw new HttpError(429,'You are sending messages too quickly.');
  const b=z.object({body:z.string().trim().min(1).max(4000)}).safeParse(await r.json());if(!b.success)throw new HttpError(400,'Write a message up to 4,000 characters');
  const conv=await conversationAccess(v,(await params).id);
  const sender=v.kind==='guest'?{kind:'customer' as const,email:conv.email,name:conv.name}:{kind:v.kind,email:v.c.u.email,name:v.c.u.fullName||v.c.member.name};
  const created=await addMessage(conv,sender,b.data.body);
  if(v.kind==='staff')await tellCustomer(conv,b.data.body,siteOrigin(r));
  return Response.json({ok:true,created},{status:201});}catch(e){return failure(e);}}
export async function PATCH(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await optionalContext(r);if(!c?.staff)throw new HttpError(403,'Staff access required');const p=z.object({status:z.enum(['open','closed']).optional(),assignee:z.string().email().nullable().optional()}).strict().safeParse(await r.json());if(!p.success||!Object.keys(p.data).length)throw new HttpError(400,'Invalid update');
  const conv=await conversationAccess({kind:'staff',c},(await params).id);
  await db().prepare('UPDATE conversations SET status=?, assignee=? WHERE id=?').bind(p.data.status||conv.status,p.data.assignee===undefined?conv.assignee:p.data.assignee,conv.id).run();
  return Response.json({ok:true});}catch(e){return failure(e);}}

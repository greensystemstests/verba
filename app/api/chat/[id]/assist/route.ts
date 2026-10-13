import {optionalContext,db,failure,HttpError,sameOrigin,siteOrigin,clientAddress} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {viewer,conversationAccess,addMessage,tellStaff,workspaceConfig,type Conversation} from '@/lib/chat';
import {assistantReply,assistantEnabled,assistantName} from '@/lib/assistant';
import {z} from 'zod';
// The assistant's turn in a support conversation. The chat window calls this after the customer writes.
//  {}              answer the customer's latest message (no-op when it was already answered or a person took over)
//  {handoff:true}  the customer asks for a person: the assistant steps back and the team is told
//  {draft:true}    staff only: a suggested reply to edit and send (nothing is saved)
const input=z.object({handoff:z.literal(true).optional(),draft:z.literal(true).optional()}).strict();
async function toPerson(conv:Conversation,origin:string,why:string){
  const changed=await db().prepare("UPDATE conversations SET assistant='human' WHERE id=? AND assistant<>'human'").bind(conv.id).run();
  if(!changed.meta.changes)return;
  await addMessage(conv,{kind:'system',email:'',name:assistantName},why);
  await tellStaff(conv.workspace,conv,'A customer is waiting for a person in the support chat.',origin,'chat_admin').catch(()=>{});
}
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){try{sameOrigin(r);
  const c=await optionalContext(r);const {v}=await viewer(c);if(!v)throw new HttpError(404,'Conversation not found');
  const p=input.safeParse(await r.json().catch(()=>({})));if(!p.success)throw new HttpError(400,'Invalid request');
  const conv=await conversationAccess(v,(await params).id);
  if(p.data.draft){if(v.kind!=='staff')throw new HttpError(403,'Staff access required');
    if(!assistantEnabled(await workspaceConfig(conv.workspace)))throw new HttpError(503,'The assistant is not connected.');
    const d=await assistantReply(conv,{draft:true});return Response.json({draft:d.reply});}
  if(v.kind==='staff')throw new HttpError(400,'Staff reply in person');
  if(p.data.handoff){await toPerson(conv,siteOrigin(r),'You asked for a person. A member of our team will continue here; we will also email you when they reply.');return Response.json({ok:true,assistant:'human'});}
  if(conv.assistant!=='on'||conv.status!=='open'||!assistantEnabled(await workspaceConfig(conv.workspace)))return Response.json({ok:true,skipped:true,assistant:conv.assistant});
  const key=(v.kind==='guest'?v.key:v.c.u.userId)+clientAddress(r);
  if(!await authLimit('assistant:'+key,40,60)||!await authLimit('assistant-conv:'+conv.id,60,1440)){await toPerson(conv,siteOrigin(r),'Our team will continue this conversation in person.');return Response.json({ok:true,assistant:'human'});}
  // Answer only the latest customer message, once.
  const last=await db().prepare('SELECT sender_kind,created FROM conversation_messages WHERE conversation_id=? ORDER BY created DESC LIMIT 1').bind(conv.id).first<{sender_kind:string;created:string}>();
  if(last?.sender_kind!=='customer')return Response.json({ok:true,skipped:true,assistant:conv.assistant});
  // One answer per customer message, even when two windows ask at once.
  const lock='assistant-turn:'+conv.id;const now=new Date().toISOString();
  const claim=await db().prepare("INSERT INTO settings (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated WHERE settings.value<>excluded.value OR settings.updated<?").bind(lock,last.created,now,new Date(Date.now()-60000).toISOString()).run();
  if(!claim.meta.changes)return Response.json({ok:true,skipped:true,assistant:conv.assistant});
  let answer;try{answer=await assistantReply(conv);}catch(e){await toPerson(conv,siteOrigin(r),'Our assistant is not available right now. A member of our team will reply here.');if(e instanceof HttpError)return Response.json({ok:false,assistant:'human'});throw e;}
  // A person may have replied meanwhile; then the assistant stays quiet.
  const fresh=await db().prepare('SELECT * FROM conversations WHERE id=?').bind(conv.id).first<Conversation>();
  if(!fresh||fresh.assistant!=='on'||fresh.last_message_at!==last.created)return Response.json({ok:true,skipped:true,assistant:fresh?.assistant});
  await addMessage(fresh,{kind:'assistant',email:'',name:assistantName},answer.reply);
  if(answer.handoff)await toPerson(fresh,siteOrigin(r),'A member of our team will continue here.');
  return Response.json({ok:true,assistant:answer.handoff?'human':'on'});
}catch(e){return failure(e);}}

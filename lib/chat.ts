// Customer-service chat (spec 1.17): visitors and customers talk to company staff while
// filling in an order or about an existing order; staff see the customer's order history.
import {db,HttpError,primaryWorkspace,type Ctx} from './server';
import {guestKey} from './account';
import {notify} from './notify';
export type Conversation={id:string;workspace:string;account_id:string|null;guest_hash:string|null;name:string;email:string;subject:string;kind:string;order_id:string|null;status:string;assignee:string|null;last_message_at:string;staff_read_at:string|null;customer_read_at:string|null;created:string};
export type Viewer={kind:'staff';c:Ctx}|{kind:'customer';c:Ctx}|{kind:'guest';key:string;workspace:string};
export async function viewer(c:Ctx|null,createGuest=false):Promise<{v:Viewer|null;cookie?:string}>{
  if(c)return {v:{kind:c.staff?'staff':'customer',c}};
  const g=await guestKey(createGuest);const workspace=await primaryWorkspace();
  if(!g.key||!workspace)return {v:null};
  return {v:{kind:'guest',key:g.key,workspace},cookie:g.cookie};
}
export async function conversationAccess(v:Viewer,id:string){
  const ws=v.kind==='guest'?v.workspace:v.c.workspace.id;
  const conv=await db().prepare('SELECT * FROM conversations WHERE id=? AND workspace=?').bind(id,ws).first<Conversation>();
  if(!conv)throw new HttpError(404,'Conversation not found');
  if(v.kind==='staff')return conv;
  if(v.kind==='customer'&&conv.account_id===v.c.u.userId)return conv;
  if(v.kind==='guest'&&conv.guest_hash===v.key)return conv;
  throw new HttpError(404,'Conversation not found');
}
export async function addMessage(conv:Conversation,sender:{kind:'customer'|'staff'|'system';email:string;name:string},body:string){
  const now=new Date().toISOString();
  const read=sender.kind==='staff'?'staff_read_at':sender.kind==='customer'?'customer_read_at':null;
  await db().batch([db().prepare('INSERT INTO conversation_messages (id,conversation_id,sender_kind,sender_email,sender_name,body,created) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),conv.id,sender.kind,sender.email,sender.name,body,now),read?db().prepare(`UPDATE conversations SET last_message_at=?, status='open', ${read}=? WHERE id=?`).bind(now,now,conv.id):db().prepare("UPDATE conversations SET last_message_at=?, status='open' WHERE id=?").bind(now,conv.id)]);
  return now;
}
export async function staffEmail(workspace:string){
  const w=await db().prepare('SELECT config FROM workspaces WHERE id=?').bind(workspace).first<{config:string}>();
  let cfg:{notifyEmail?:string}={};try{cfg=JSON.parse(w?.config||'{}');}catch{}
  return cfg.notifyEmail||(await db().prepare("SELECT email FROM members WHERE workspace=? AND role='admin' ORDER BY id LIMIT 1").bind(workspace).first<{email:string}>())?.email||null;
}
export async function tellStaff(workspace:string,conv:Conversation,body:string,origin:string,template:'chat_admin'|'inquiry_admin'){
  const to=await staffEmail(workspace);if(!to)return;
  await notify(workspace,{email:to,notify:'["email"]'},template,{name:conv.name,email:conv.email,subject:conv.subject,body,link:`${origin}/studio?view=inbox&conversation=${conv.id}`});
}
// Emails the customer when staff reply and the customer has not looked at the chat for a minute.
export async function tellCustomer(conv:Conversation,body:string,origin:string){
  if(conv.customer_read_at&&Date.now()-Date.parse(conv.customer_read_at)<60000)return;
  const account=conv.account_id?await db().prepare('SELECT email,name,phone,language,notify FROM accounts WHERE id=?').bind(conv.account_id).first<{email:string;name:string;phone:string|null;language:string;notify:string}>():null;
  const email=account?.email||conv.email;if(!email)return;
  await notify(conv.workspace,{email,phone:account?.phone,lang:account?.language,notify:account?.notify||'["email"]'},'chat_reply',{name:account?.name||conv.name,body:body.slice(0,1500),link:`${origin}/${conv.account_id?'studio?view=support':'order'}`});
}

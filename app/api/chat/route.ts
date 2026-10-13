import {optionalContext,db,failure,HttpError,sameOrigin,clientAddress,siteOrigin,access} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {verifyCaptcha} from '@/lib/captcha';
import {viewer,addMessage,tellStaff,workspaceConfig,type Conversation} from '@/lib/chat';
import {assistantEnabled} from '@/lib/assistant';
import {z} from 'zod';
export async function GET(r:Request){try{const c=await optionalContext();const {v}=await viewer(c);if(!v)return Response.json([]);
  const status=new URL(r.url).searchParams.get('status');
  const unread="(SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id=c.id AND m.sender_kind<>'%s' AND m.created>COALESCE(c.%s,''))";
  // Staff are alerted only for customer messages in conversations the assistant is not handling.
  const rows=v.kind==='staff'?(await db().prepare(`SELECT c.*,CASE WHEN c.assistant='on' THEN 0 ELSE (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id=c.id AND m.sender_kind='customer' AND m.created>COALESCE(c.staff_read_at,'')) END AS unread,(SELECT body FROM conversation_messages m WHERE m.conversation_id=c.id ORDER BY created DESC LIMIT 1) AS preview,(SELECT sender_kind FROM conversation_messages m WHERE m.conversation_id=c.id ORDER BY created DESC LIMIT 1) AS last_sender,(SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id=c.id) AS messages FROM conversations c WHERE c.workspace=? ${status==='closed'?"AND c.status='closed'":status==='all'?'':"AND c.status='open'"} ORDER BY c.last_message_at DESC LIMIT 300`).bind(v.c.workspace.id).all()).results
    :v.kind==='customer'?(await db().prepare(`SELECT c.*,${unread.replace('%s','customer').replace('%s','customer_read_at')} AS unread,(SELECT body FROM conversation_messages m WHERE m.conversation_id=c.id ORDER BY created DESC LIMIT 1) AS preview,(SELECT sender_kind FROM conversation_messages m WHERE m.conversation_id=c.id ORDER BY created DESC LIMIT 1) AS last_sender FROM conversations c WHERE c.workspace=? AND c.account_id=? ORDER BY c.last_message_at DESC LIMIT 50`).bind(v.c.workspace.id,v.c.u.userId).all()).results
    :(await db().prepare(`SELECT c.*,${unread.replace('%s','customer').replace('%s','customer_read_at')} AS unread FROM conversations c WHERE c.workspace=? AND c.guest_hash=? ORDER BY c.last_message_at DESC LIMIT 10`).bind(v.workspace,v.key).all()).results;
  return Response.json(rows.map(row=>({...row,guest_hash:undefined})),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
const start=z.object({body:z.string().trim().min(1).max(4000),subject:z.string().trim().max(160).default(''),orderId:z.string().uuid().optional(),name:z.string().trim().max(120).default(''),email:z.string().trim().max(254).default(''),captcha:z.string().max(4096).optional()});
export async function POST(r:Request){try{sameOrigin(r);const c=await optionalContext(r);const ip=clientAddress(r);
  if(!await authLimit('chat-start:'+ip,20,60))throw new HttpError(429,'Too many conversations. Try again later.');
  const p=start.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Write a message up to 4,000 characters');const b=p.data;
  const {v,cookie}=await viewer(c,true);if(!v)throw new HttpError(503,'Chat opens once the service is set up.');
  if(v.kind==='guest'){if(b.name.length<2||!z.string().email().safeParse(b.email).success)throw new HttpError(400,'Enter your name and email so we can reply');if(!await verifyCaptcha(b.captcha,ip))throw new HttpError(400,'Complete the security check and try again');}
  const ws=v.kind==='guest'?v.workspace:v.c.workspace.id;
  if(b.orderId&&v.kind!=='guest')await access(v.c,b.orderId);
  const id=crypto.randomUUID();const now=new Date().toISOString();
  const name=v.kind==='guest'?b.name:v.c.u.fullName;const email=v.kind==='guest'?b.email.toLowerCase():v.c.u.email;
  // The assistant handles the conversation when it is connected and switched on; otherwise the team does.
  const cfg=v.kind==='guest'?await workspaceConfig(ws):v.c.config;
  await db().prepare('INSERT INTO conversations (id,workspace,account_id,guest_hash,name,email,subject,kind,order_id,status,last_message_at,customer_read_at,created,assistant) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,ws,v.kind==='guest'?null:v.c.u.userId,v.kind==='guest'?v.key:null,name,email,b.subject||(b.orderId?'Order question':'Customer service'),'support',b.orderId||null,'open',now,now,now,assistantEnabled(cfg)&&v.kind!=='staff'?'on':'human').run();
  const conv=await db().prepare('SELECT * FROM conversations WHERE id=?').bind(id).first<Conversation>();
  await addMessage(conv!,{kind:v.kind==='staff'?'staff':'customer',email,name},b.body);
  // With the assistant answering, the team is emailed when a person is needed (see /api/chat/[id]/assist).
  if(!assistantEnabled(cfg)||v.kind==='staff')await tellStaff(ws,conv!,b.body,siteOrigin(r),'chat_admin');
  return Response.json({id},{status:201,headers:cookie?{'Set-Cookie':cookie}:{}});}catch(e){return failure(e);}}

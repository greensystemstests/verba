import {context,db,failure,HttpError,siteOrigin} from '@/lib/server';
import {extraServices,wordCount,MAX_FREE_TEXT_WORDS} from '@/lib/catalog';
import {addMessage,tellStaff,type Conversation} from '@/lib/chat';
import {authLimit} from '@/lib/account';
import {z} from 'zod';
// Additional services (spec 1.7): a signed-in customer's request is saved to the customer
// service inbox and emailed to the administrator.
export async function POST(r:Request){try{const c=await context(r);
  if(!await authLimit('inquiry:'+c.u.userId,10,60))throw new HttpError(429,'Too many requests. Try again later.');
  const p=z.object({extraType:z.enum(extraServices),description:z.string().trim().max(160).default(''),freeText:z.string().trim().min(3).max(5000),captcha:z.string().max(4096).optional()}).safeParse(await r.json());
  if(!p.success)throw new HttpError(400,'Choose a service type and describe what you need');const b=p.data;
  if(wordCount(b.freeText)>MAX_FREE_TEXT_WORDS)throw new HttpError(400,`Keep the description under ${MAX_FREE_TEXT_WORDS} words`);
  const id=crypto.randomUUID();const now=new Date().toISOString();const subject=`${b.extraType}${b.description?': '+b.description:''}`.slice(0,160);
  await db().prepare('INSERT INTO conversations (id,workspace,account_id,name,email,subject,kind,status,last_message_at,customer_read_at,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,c.workspace.id,c.u.userId,c.u.fullName,c.u.email,subject,'inquiry','open',now,now,now).run();
  const conv=await db().prepare('SELECT * FROM conversations WHERE id=?').bind(id).first<Conversation>();
  await addMessage(conv!,{kind:'customer',email:c.u.email,name:c.u.fullName},b.freeText);
  await tellStaff(c.workspace.id,conv!,b.freeText,siteOrigin(r),'inquiry_admin');
  return Response.json({id},{status:201});}catch(e){return failure(e);}}

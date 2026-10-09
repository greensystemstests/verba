import {db,sameOrigin,clientAddress,failure,HttpError,siteOrigin,primaryWorkspace} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {issueToken} from '@/lib/accounts-server';
import {verifyCaptcha} from '@/lib/captcha';
import {normalizePhone} from '@/lib/geo';
import {notify,providers} from '@/lib/notify';
import {z} from 'zod';
// Sends a one-hour password reset link by email (and by SMS when the phone number is used).
// The answer is the same whether or not an account exists.
export async function POST(r:Request){try{sameOrigin(r);const ip=clientAddress(r);
  if(!await authLimit('auth-network:'+ip,60))throw new HttpError(429,'Too many account requests. Try again in 15 minutes.');
  const b=z.object({identifier:z.string().trim().min(3).max(254),phonePrefix:z.string().max(8).default('+972'),captcha:z.string().max(4096).optional()}).parse(await r.json());
  if(!await verifyCaptcha(b.captcha,ip))throw new HttpError(400,'Complete the security check and try again');
  const id=b.identifier.toLowerCase();const phone=id.includes('@')?null:normalizePhone(b.phonePrefix,id);
  if(!await authLimit('forgot:'+(phone||id),3,60))throw new HttpError(429,'Too many reset requests. Try again later.');
  const available=providers.email()||(!!phone&&providers.sms());
  const row=phone?await db().prepare('SELECT id,email,name,phone,language FROM accounts WHERE phone=? AND disabled_at IS NULL').bind(phone).first<{id:string;email:string;name:string;phone:string;language:string}>():await db().prepare('SELECT id,email,name,phone,language FROM accounts WHERE email=? AND disabled_at IS NULL').bind(id).first<{id:string;email:string;name:string;phone:string;language:string}>();
  if(row&&available){const token=await issueToken(row.id,'reset',1);const link=`${siteOrigin(r)}/account#reset=${token}`;await notify(await primaryWorkspace(),{email:row.email,phone:phone?row.phone:null,lang:row.language,notify:phone?'["email","sms"]':'["email"]'},'reset',{name:row.name,link});}
  return Response.json({ok:true,delivery:available},{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Enter your email address or phone number'},{status:400});return failure(e);}}

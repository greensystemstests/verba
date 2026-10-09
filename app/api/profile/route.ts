import {context,db,failure,HttpError} from '@/lib/server';
import {verifyPassword,hashPassword} from '@/lib/account-crypto';
import {passwordProblem} from '@/lib/accounts-server';
import {normalizePhone} from '@/lib/geo';
import {addressSchema,currencies} from '@/lib/catalog';
import {channels} from '@/lib/notify';
import {z} from 'zod';
// Personal information (customer area): name, phone, company, customer type, address,
// language, notification channels and display currency. Also changes the password.
const patch=z.object({firstName:z.string().trim().min(1).max(60),lastName:z.string().trim().min(1).max(60),phonePrefix:z.string().max(8).default('+972'),phone:z.string().max(40).default(''),company:z.string().trim().max(120).default(''),customerType:z.enum(['Private','Business']),country:z.string().length(2),address:addressSchema,language:z.enum(['en','he']),notify:z.array(z.enum(channels as [string,...string[]])).max(5),currency:z.enum(currencies)});
export async function GET(){try{const c=await context();const u=c.u;let address={};try{address=JSON.parse(u.address||'{}');}catch{}let notify=['email'];try{notify=JSON.parse(u.notify);}catch{}
  const orders=await db().prepare("SELECT COUNT(*) AS n FROM orders WHERE owner=? AND status<>'Draft'").bind(u.userId).first<{n:number}>();
  return Response.json({firstName:u.firstName,lastName:u.lastName,email:u.email,emailVerified:u.emailVerified,phone:u.phone,company:u.company,customerType:u.customerType,country:u.country,address:addressSchema.parse(address),language:u.language,notify,currency:u.currency,role:c.role,orders:orders?.n||0},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function PATCH(r:Request){try{const c=await context(r);const body=await r.json() as Record<string,unknown>;
  if(body.newPassword!==undefined){const b=z.object({currentPassword:z.string().max(128),newPassword:z.string().max(128)}).parse(body);const row=await db().prepare('SELECT password_hash FROM accounts WHERE id=?').bind(c.u.userId).first<{password_hash:string}>();if(!row||!verifyPassword(b.currentPassword,row.password_hash))throw new HttpError(400,'Your current password is incorrect');const weak=passwordProblem(b.newPassword,[c.u.firstName,c.u.lastName,c.u.email.split('@')[0]]);if(weak)throw new HttpError(400,weak);await db().prepare('UPDATE accounts SET password_hash=? WHERE id=?').bind(hashPassword(b.newPassword),c.u.userId).run();return Response.json({ok:true});}
  const parsed=patch.safeParse(body);if(!parsed.success)throw new HttpError(400,'Check your personal information');const p=parsed.data;
  const phone=p.phone.trim()?normalizePhone(p.phonePrefix,p.phone):null;if(p.phone.trim()&&!phone)throw new HttpError(400,'Enter a valid phone number');
  if(phone&&await db().prepare('SELECT 1 FROM accounts WHERE phone=? AND id<>?').bind(phone,c.u.userId).first())throw new HttpError(409,'This phone number is already used by another account');
  const name=`${p.firstName} ${p.lastName}`.trim();
  await db().batch([db().prepare('UPDATE accounts SET first_name=?,last_name=?,name=?,phone=?,company=?,customer_type=?,country=?,address=?,language=?,notify=?,currency=? WHERE id=?').bind(p.firstName,p.lastName,name,phone,p.company,p.customerType,p.country,JSON.stringify(p.address),p.language,JSON.stringify(p.notify.length?p.notify:['email']),p.currency,c.u.userId),db().prepare('UPDATE members SET name=?, phone=? WHERE email=?').bind(name,phone||'',c.u.email)]);
  return Response.json({ok:true},{headers:{'Set-Cookie':`verba_lang=${p.language}; Path=/; Max-Age=31536000; SameSite=Lax`}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Enter your current and new password'},{status:400});return failure(e);}}

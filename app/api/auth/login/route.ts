import {db,sameOrigin,clientAddress,failure,HttpError} from '@/lib/server';
import {authLimit,createSession,claimGuestFiles} from '@/lib/account';
import {verifyPassword} from '@/lib/account-crypto';
import {normalizePhone} from '@/lib/geo';
import {z} from 'zod';
// Sign in with email or phone number (spec 1.0 "Username or phone", 1.14 notary login by phone).
const body=z.object({email:z.string().trim().max(254).optional(),identifier:z.string().trim().max(254).optional(),phonePrefix:z.string().max(8).default('+972'),password:z.string().min(1).max(128),remember:z.boolean().default(true)});
export async function POST(r:Request){try{sameOrigin(r);if(!await authLimit('auth-network:'+clientAddress(r),60))throw new HttpError(429,'Too many account requests. Try again in 15 minutes.');
  const b=body.parse(await r.json());const id=(b.identifier||b.email||'').toLowerCase();if(!id)throw new z.ZodError([]);
  const phone=id.includes('@')?null:normalizePhone(b.phonePrefix,id);
  if(!id.includes('@')&&!phone)throw new HttpError(400,'Enter a valid email address or phone number');
  if(!await authLimit('login:'+(phone||id)))throw new HttpError(429,'Too many attempts. Try again in 15 minutes.');
  const row=phone?await db().prepare('SELECT * FROM accounts WHERE phone=?').bind(phone).first<{id:string;password_hash:string;disabled_at:string|null}>():await db().prepare('SELECT * FROM accounts WHERE email=?').bind(id).first<{id:string;password_hash:string;disabled_at:string|null}>();
  const dummy='scrypt:16384:8:5:0123456789abcdef0123456789abcdef:'+('0'.repeat(64));
  const valid=verifyPassword(b.password,row?.password_hash||dummy);
  if(!row||!valid||row.disabled_at)throw new HttpError(401,phone?'Phone number or password is incorrect':'Email or password is incorrect');
  const cookie=await createSession(row.id,b.remember);await claimGuestFiles(row.id).catch(()=>0);
  return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Enter a valid email or phone number and your password'},{status:400});return failure(e);}}

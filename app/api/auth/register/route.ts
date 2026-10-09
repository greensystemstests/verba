import {sameOrigin,clientAddress,failure,HttpError,siteOrigin} from '@/lib/server';
import {authLimit,createSession,claimGuestFiles} from '@/lib/account';
import {createCustomerAccount,passwordProblem,sendVerification} from '@/lib/accounts-server';
import {verifyCaptcha} from '@/lib/captcha';
import {normalizePhone} from '@/lib/geo';
import {providers} from '@/lib/notify';
import {z} from 'zod';
// Open sign-up for customers (spec: users create an account independent of any third party).
const body=z.object({firstName:z.string().trim().min(1).max(60),lastName:z.string().trim().min(1).max(60),email:z.string().trim().email().max(254),phonePrefix:z.string().max(8).default('+972'),phone:z.string().max(40).default(''),password:z.string().min(1).max(128),agreed:z.literal(true),captcha:z.string().max(4096).optional(),language:z.enum(['en','he']).default('en'),remember:z.boolean().default(true)});
export async function POST(r:Request){try{
  sameOrigin(r);const ip=clientAddress(r);
  if(!await authLimit('auth-network:'+ip,60)||!await authLimit('register:'+ip,10,60))throw new HttpError(429,'Too many account requests. Try again later.');
  const parsed=body.safeParse(await r.json());
  if(!parsed.success)throw new HttpError(400,parsed.error.issues.some(i=>i.path[0]==='agreed')?'Accept the terms and privacy notice to create an account':'Enter your first name, last name, a valid email and a password');
  const b=parsed.data;
  if(!await verifyCaptcha(b.captcha,ip))throw new HttpError(400,'Complete the security check and try again');
  const problem=passwordProblem(b.password,[b.firstName,b.lastName,b.email.split('@')[0]]);if(problem)throw new HttpError(400,problem);
  const phone=b.phone.trim()?normalizePhone(b.phonePrefix,b.phone):null;
  if(b.phone.trim()&&!phone)throw new HttpError(400,'Enter a valid phone number');
  const account=await createCustomerAccount({email:b.email,firstName:b.firstName,lastName:b.lastName,phone,password:b.password,language:b.language});
  const cookie=await createSession(account.id,b.remember);
  await claimGuestFiles(account.id).catch(()=>0);
  const sent=await sendVerification({id:account.id,email:account.email,name:account.name,language:b.language},siteOrigin(r),account.workspace);
  return Response.json({ok:true,verificationSent:sent,recoveryCode:providers.email()?undefined:account.recovery},{status:201,headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}

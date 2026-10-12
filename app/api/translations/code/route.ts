import {context,failure,HttpError} from '@/lib/server';
import {authLimit} from '@/lib/account';
import {findCode} from '@/lib/access-codes';
import {z} from 'zod';
// Checks an access code a person typed. A valid code gives free translation up to a word limit in every DeepL language.
export async function POST(r:Request){try{const c=await context(r);if(!await authLimit('access-code:'+c.u.userId,10,15))throw new HttpError(429,'Too many attempts. Try again in 15 minutes.');
  const b=z.object({code:z.string().trim().min(1).max(100)}).parse(await r.json());const access=await findCode(b.code);
  if(!access)throw new HttpError(400,'This access code is not valid or has expired.');
  if(access.remaining!==null&&access.remaining<=0)throw new HttpError(429,'The word budget of this access code has been used.');
  return Response.json({ok:true,maxWords:access.maxWords,remaining:access.remaining},{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Enter your access code.'},{status:400});return failure(e);}}

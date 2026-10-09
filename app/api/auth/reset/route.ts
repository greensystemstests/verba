import {db,sameOrigin,clientAddress,failure,HttpError} from '@/lib/server';
import {authLimit,createSession} from '@/lib/account';
import {hashPassword} from '@/lib/account-crypto';
import {consumeToken,passwordProblem} from '@/lib/accounts-server';
import {z} from 'zod';
export async function POST(r:Request){try{sameOrigin(r);if(!await authLimit('auth-network:'+clientAddress(r),60))throw new HttpError(429,'Too many account requests. Try again in 15 minutes.');
  const b=z.object({token:z.string().max(64),password:z.string().max(128)}).parse(await r.json());
  const problem=passwordProblem(b.password);if(problem)throw new HttpError(400,problem);
  const accountId=await consumeToken(b.token,'reset');if(!accountId)throw new HttpError(400,'This reset link has expired or was already used. Request a new one.');
  // Opening the emailed link also proves the address belongs to the account holder.
  await db().batch([db().prepare('UPDATE accounts SET password_hash=?, email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(hashPassword(b.password),new Date().toISOString(),accountId),db().prepare('DELETE FROM sessions WHERE account_id=?').bind(accountId)]);
  return Response.json({ok:true},{headers:{'Set-Cookie':await createSession(accountId,false),'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Enter a new password'},{status:400});return failure(e);}}

import {db,sameOrigin,failure,HttpError,siteOrigin,context} from '@/lib/server';
import {consumeToken,sendVerification} from '@/lib/accounts-server';
import {authLimit} from '@/lib/account';
import {z} from 'zod';
// POST {token}: confirms the email address. PUT: sends a new confirmation email to the signed-in user.
export async function POST(r:Request){try{sameOrigin(r);const b=z.object({token:z.string().max(64)}).parse(await r.json());const id=await consumeToken(b.token,'verify');if(!id)throw new HttpError(400,'This confirmation link has expired or was already used.');await db().prepare('UPDATE accounts SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(new Date().toISOString(),id).run();return Response.json({ok:true});}catch(e){if(e instanceof z.ZodError)return Response.json({error:'Invalid confirmation link'},{status:400});return failure(e);}}
export async function PUT(r:Request){try{const c=await context(r);if(c.u.emailVerified)return Response.json({ok:true,alreadyVerified:true});if(!await authLimit('verify-mail:'+c.u.userId,3,60))throw new HttpError(429,'Too many requests. Try again later.');const sent=await sendVerification({id:c.u.userId,email:c.u.email,name:c.u.fullName,language:c.u.language},siteOrigin(r),c.workspace.id);return Response.json({ok:true,sent});}catch(e){return failure(e);}}

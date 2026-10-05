import {revokeSession,SESSION_COOKIE} from '@/lib/account';
import {sameOrigin,failure} from '@/lib/server';
export async function POST(r:Request){try{sameOrigin(r);await revokeSession();return Response.json({ok:true},{headers:{'Set-Cookie':`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,'Cache-Control':'no-store'}});}catch(e){return failure(e);}}

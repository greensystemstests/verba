import {context,db,failure,admin} from '@/lib/server';
export async function GET(){try{const c=await context();admin(c);return Response.json((await db().prepare('SELECT id,recipient,channel,template,subject,status,detail,created FROM notifications WHERE workspace=? OR workspace IS NULL ORDER BY created DESC LIMIT 200').bind(c.workspace.id).all()).results);}catch(e){return failure(e);}}

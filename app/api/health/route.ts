import {db} from '@/lib/server';
// Public health check: database reachability and the deployed commit. Reports only a
// short error code (never connection details) so a failing host can be diagnosed.
export async function GET(){
  const commit=(process.env.COMMIT_REF||process.env.RENDER_GIT_COMMIT||'').slice(0,7)||null;
  if(!process.env.DATABASE_URL)return Response.json({ok:false,database:'not configured',commit},{status:503,headers:{'Cache-Control':'no-store'}});
  try{await db().prepare('SELECT 1 AS ok').first();return Response.json({ok:true,database:'ok',commit},{headers:{'Cache-Control':'no-store'}});}
  catch(e){const code=String((e as {code?:unknown}).code||'')||(e instanceof Error&&/timeout/i.test(e.message)?'TIMEOUT':'UNKNOWN');return Response.json({ok:false,database:'unreachable',code:/^[A-Z0-9_]{2,20}$/.test(code)?code:'UNKNOWN',commit},{status:503,headers:{'Cache-Control':'no-store'}});}
}

// Usage: DATABASE_URL=... node scripts/create-admin-invite.mjs <email> "<Full name>" [https://your-site.example]
// Prints a single-use, 24-hour invitation link. Open it to choose a password.
import pg from 'pg';
import {createInvite} from './lib/invite.mjs';
const [email,name,origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||'']=process.argv.slice(2);
if(!process.env.DATABASE_URL||!email){console.error('Usage: DATABASE_URL=... node scripts/create-admin-invite.mjs <email> "<Full name>" [site origin]');process.exit(1);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{const r=await createInvite(client,{email,name});console.log(r.createdWorkspace?`Created a new workspace with ${email} as administrator.`:`${email} is already a ${r.role} member; invitation created for that workspace.`);console.log('Invitation link (single use, expires in 24 hours):');console.log((origin.replace(/\/$/,''))+r.path);}catch(e){console.error(e.message);process.exitCode=1;}finally{await client.end();}

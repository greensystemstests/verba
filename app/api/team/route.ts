import {context,db,failure,admin,HttpError,roles} from '@/lib/server';
import {z} from 'zod';
// Team and courier management (admin). Couriers carry the details of the courier card
// (spec 1.10): phone, address, business number, area of activity and active status.
const member=z.object({email:z.string().email(),name:z.string().trim().min(2).max(100),role:z.enum(roles),area:z.string().max(120).default(''),phone:z.string().max(40).default(''),address:z.string().max(200).default(''),businessNumber:z.string().max(40).default(''),active:z.boolean().default(true)});
export async function POST(r:Request){try{const c=await context(r);admin(c);const p=member.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Check the team member details');const b=p.data;const email=b.email.toLowerCase();
  if(email===c.u.email.toLowerCase())throw new HttpError(400,'Your administrator role cannot be replaced');
  const elsewhere=await db().prepare('SELECT id FROM members WHERE email = ? AND workspace != ?').bind(email,c.workspace.id).first();if(elsewhere)throw new HttpError(409,'This email already belongs to a different workspace');
  await db().prepare('INSERT INTO members (id,workspace,email,role,name,area,phone,address,business_number,active) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace,email) DO UPDATE SET role=excluded.role,name=excluded.name,area=excluded.area,phone=excluded.phone,address=excluded.address,business_number=excluded.business_number,active=excluded.active').bind(crypto.randomUUID(),c.workspace.id,email,b.role,b.name,b.area,b.phone,b.address,b.businessNumber,b.active?1:0).run();
  if(!b.active)await db().prepare('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email=?)').bind(email).run();
  return Response.json({ok:true});}catch(e){return failure(e);}}
// Removes access: members with history are deactivated (kept for reports); others are deleted.
export async function DELETE(r:Request){try{const c=await context(r);admin(c);const email=String(new URL(r.url).searchParams.get('email')||'').toLowerCase();
  if(!email)throw new HttpError(400,'Choose a member');if(email===c.u.email.toLowerCase())throw new HttpError(400,'You cannot remove your own administrator access');
  const m=await db().prepare('SELECT id FROM members WHERE workspace=? AND email=?').bind(c.workspace.id,email).first<{id:string}>();if(!m)throw new HttpError(404,'Member not found');
  const history=await db().prepare('SELECT 1 FROM orders WHERE workspace=? AND (assignee=? OR courier=? OR vendor=? OR owner IN (SELECT id FROM accounts WHERE email=?)) UNION SELECT 1 FROM shipments WHERE workspace=? AND (courier=? OR return_courier=?) LIMIT 1').bind(c.workspace.id,email,email,email,email,c.workspace.id,email,email).first();
  await db().batch([history?db().prepare('UPDATE members SET active=0 WHERE id=?').bind(m.id):db().prepare('DELETE FROM members WHERE id=?').bind(m.id),db().prepare('DELETE FROM account_invites WHERE email=? AND workspace=?').bind(email,c.workspace.id),db().prepare('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email=?)').bind(email),...(history?[]:[db().prepare('UPDATE accounts SET disabled_at=? WHERE email=?').bind(new Date().toISOString(),email)])]);
  return Response.json({ok:true,deactivated:!!history});}catch(e){return failure(e);}}

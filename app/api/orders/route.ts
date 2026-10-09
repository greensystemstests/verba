import {context,db,failure,publicOrder,event,HttpError,type OrderRow} from '@/lib/server';
import {orderSchema,orderReference,hasCourier,addBusinessDays} from '@/lib/catalog';
import {quoteFor,shipmentStatement,nextNumber,afterSubmit} from '@/lib/order-flow';
export async function GET(){try{const c=await context();const q=c.staff?db().prepare('SELECT * FROM orders WHERE workspace = ? ORDER BY created DESC LIMIT 1000').bind(c.workspace.id):db().prepare('SELECT * FROM orders WHERE workspace = ? AND (owner = ? OR assignee = ? OR courier = ? OR vendor = ? OR id IN (SELECT order_id FROM shipments WHERE workspace = ? AND (courier = ? OR return_courier = ?))) ORDER BY created DESC LIMIT 1000').bind(c.workspace.id,c.u.userId,c.member.email,c.member.email,c.member.email,c.workspace.id,c.member.email,c.member.email);return Response.json((await q.all<OrderRow>()).results.map(o=>publicOrder(o,c)));}catch(e){return failure(e);}}
export async function POST(r:Request){try{const c=await context(r);const b=await r.json() as {payload?:unknown;submit?:boolean};
  const parsed=orderSchema.safeParse(b.payload);if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);const o=parsed.data;
  if(o.service==='Additional services')throw new HttpError(400,'Send additional service requests with the inquiry form');
  if(b.submit&&!o.agreed)throw new HttpError(400,'Please accept the order terms');
  const ids=o.documents.flatMap(d=>d.fileIds);
  for(const id of ids){const f=await db().prepare('SELECT id FROM files WHERE id = ? AND workspace = ? AND owner = ? AND order_id IS NULL').bind(id,c.workspace.id,c.u.userId).first();if(!f)throw new HttpError(400,'A document upload is missing or already attached');}
  const id=crypto.randomUUID();const number=await nextNumber('order_number_seq');const ref=orderReference(number);const now=new Date();
  const q=await quoteFor(c,o);const status=b.submit?'Submitted':'Draft';const due=b.submit?addBusinessDays(now,q.days).toISOString().slice(0,10):null;
  const payload={...o,_quote:{lines:q.lines,total:q.total,days:q.days,carrier:q.carrier}};
  const statements=[db().prepare('INSERT INTO orders (id,workspace,owner,reference,payload,total,status,payment,shipment,number,due_date,currency,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,c.workspace.id,c.u.userId,ref,JSON.stringify(payload),q.total,status,'Not requested','Awaiting assignment',number,due,o.currency,now.toISOString(),now.toISOString()),...ids.map(fid=>db().prepare('UPDATE files SET order_id = ? WHERE id = ? AND owner = ? AND order_id IS NULL').bind(id,fid,c.u.userId)),event(c.workspace.id,id,c.u.email,status==='Draft'?'Quote saved':'Order submitted for review')];
  if(b.submit&&hasCourier(o))statements.push(shipmentStatement(c,id,c.u.userId,o,q,await nextNumber('shipment_number_seq')));
  await db().batch(statements);
  if(b.submit)await afterSubmit(c,id,r);
  return Response.json({id,reference:ref,total:q.total,status},{status:201});}catch(e){return failure(e);}}

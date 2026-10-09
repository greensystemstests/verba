import {context,db,failure,staff,HttpError} from '@/lib/server';
import {addressSchema,urgencies,shipmentReference} from '@/lib/catalog';
import {shipmentView,inArea,type ShipmentRow} from '@/lib/shipments';
import {nextNumber} from '@/lib/order-flow';
import {z} from 'zod';
// Delivery management (spec 1.9): staff see every shipment; couriers see their jobs and the
// open jobs in their area (1.13); customers see the deliveries for their own orders.
export async function GET(){try{const c=await context();const me=c.member.email;
  let rows:ShipmentRow[];
  if(c.staff)rows=(await db().prepare('SELECT * FROM shipments WHERE workspace=? ORDER BY CASE WHEN status IN (\'Delivered\',\'Cancelled\') THEN 1 ELSE 0 END, created DESC LIMIT 2000').bind(c.workspace.id).all<ShipmentRow>()).results;
  else if(c.role==='courier'){const all=(await db().prepare("SELECT * FROM shipments WHERE workspace=? AND (courier=? OR return_courier=? OR (courier IS NULL AND status='Awaiting assignment')) ORDER BY created DESC LIMIT 2000").bind(c.workspace.id,me,me).all<ShipmentRow>()).results;rows=all.filter(s=>s.courier===me||s.return_courier===me||inArea(c.member.area,s));}
  else rows=(await db().prepare('SELECT * FROM shipments WHERE workspace=? AND customer_account=? ORDER BY created DESC').bind(c.workspace.id,c.u.userId).all<ShipmentRow>()).results;
  const orders=new Map((await db().prepare('SELECT id,reference FROM orders WHERE workspace=?').bind(c.workspace.id).all<{id:string;reference:string}>()).results.map(o=>[o.id,o.reference]));
  return Response.json(rows.map(s=>shipmentView(s,{orderReference:s.order_id?orders.get(s.order_id)||'':'',available:c.role==='courier'&&!s.courier,sum:c.role==='courier'||c.staff?s.sum:0})));
}catch(e){return failure(e);}}
// "Save" in the delivery screen: staff create a new courier job (spec 1.9).
const create=z.object({customerName:z.string().trim().min(2).max(120),customerEmail:z.string().email().or(z.literal('')).default(''),customerPhone:z.string().max(40).default(''),type:z.enum(['1 way','2 way']),urgency:z.enum(urgencies).default('Standard'),sameDay:z.boolean().default(false),nextDay:z.boolean().default(false),deliveryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),operator:z.string().max(60).default(''),courier:z.string().email().nullable().default(null),returnCourier:z.string().email().nullable().default(null),origin:addressSchema,destination:addressSchema,sum:z.number().min(0).max(100000).default(0),notes:z.string().max(1000).default('')});
export async function POST(r:Request){try{const c=await context(r);staff(c);const p=create.safeParse(await r.json());if(!p.success)throw new HttpError(400,'Complete the customer name and both addresses');const b=p.data;
  if(!b.origin.city||!b.origin.street||!b.destination.city||!b.destination.street)throw new HttpError(400,'Complete the customer name and both addresses');
  for(const e of [b.courier,b.returnCourier])if(e){const m=await db().prepare("SELECT 1 FROM members WHERE workspace=? AND email=? AND role IN ('courier','admin') AND active=1").bind(c.workspace.id,e).first();if(!m)throw new HttpError(400,'Choose an active courier');}
  const id=crypto.randomUUID();const number=await nextNumber('shipment_number_seq');const now=new Date().toISOString();
  const account=b.customerEmail?await db().prepare('SELECT id FROM accounts WHERE email=?').bind(b.customerEmail.toLowerCase()).first<{id:string}>():null;
  await db().prepare('INSERT INTO shipments (id,workspace,number,order_id,customer_account,customer_name,customer_email,customer_phone,status,delivery_date,same_day,next_day,urgency,type,operator,courier,return_courier,origin,destination,sum,international,notes,created,updated) VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,c.workspace.id,number,account?.id||null,b.customerName,b.customerEmail.toLowerCase(),b.customerPhone,b.courier?'Assigned':'Awaiting assignment',b.deliveryDate,b.sameDay?1:0,b.nextDay?1:0,b.urgency,b.type,b.operator||c.pricing.localCarrier,b.courier,b.returnCourier,JSON.stringify(b.origin),JSON.stringify(b.destination),Math.round(b.sum*100),b.origin.country!==b.destination.country?1:0,b.notes,now,now).run();
  return Response.json({id,reference:shipmentReference(number)},{status:201});}catch(e){return failure(e);}}

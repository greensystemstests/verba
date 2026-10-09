import {context,db,failure,access,publicOrder,event,HttpError,siteOrigin,type OrderRow,type Ctx} from '@/lib/server';
import {orderSchema,paymentStates,hasCourier,addBusinessDays} from '@/lib/catalog';
import {quoteFor,shipmentStatement,nextNumber,afterSubmit,notifyOrderCustomer} from '@/lib/order-flow';
import {sendToMainSystem} from '@/lib/handoff';
import {z} from 'zod';
const shipmentSteps=['Awaiting assignment','Assigned','Collected','In transit','Delivered'];
const patch=z.object({
  status:z.enum(['Submitted','In review','Translating','Notary review','Ready','Delivered','Cancelled']).optional(),
  assignee:z.string().email().nullable().optional(),
  courier:z.string().email().nullable().optional(),
  vendor:z.string().email().nullable().optional(),
  shipment:z.enum(['Awaiting assignment','Assigned','Collected','In transit','Delivered','Cancelled','Stopped']).optional(),
  payment:z.enum(paymentStates).optional(),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  agreed:z.boolean().optional(),
}).strict();
const next:Record<string,string[]>={Draft:['Submitted','Cancelled'],Submitted:['In review','Cancelled'],'In review':['Translating','Notary review','Ready','Cancelled'],Translating:['Notary review','Ready','Cancelled'],'Notary review':['Ready','Cancelled'],Ready:['Delivered','In review'],Delivered:[],Cancelled:[]};
async function detail(c:Ctx,o:OrderRow){
  const raw=JSON.parse(o.payload) as {_quote?:unknown};
  if(c.role==='courier'){const shipments=(await db().prepare('SELECT * FROM shipments WHERE order_id=? AND (courier=? OR return_courier=?)').bind(o.id,c.member.email,c.member.email).all()).results;return {...publicOrder(o,c),files:[],messages:[],events:[],shipments};}
  const [files,messages,events,shipments]=await Promise.all([db().prepare('SELECT id,name,type,size,purpose,created FROM files WHERE order_id = ? ORDER BY created').bind(o.id).all(),db().prepare('SELECT id,sender,name,body,created FROM messages WHERE order_id = ? ORDER BY created LIMIT 500').bind(o.id).all(),db().prepare('SELECT actor,action,created FROM events WHERE order_id = ? ORDER BY created').bind(o.id).all(),db().prepare('SELECT * FROM shipments WHERE order_id = ? ORDER BY number').bind(o.id).all()]);
  return {...publicOrder(o,c),quote:raw._quote||null,files:files.results,messages:messages.results,events:events.results,shipments:shipments.results};
}
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context();const o=await access(c,(await params).id);return Response.json(await detail(c,o));}catch(e){return failure(e);}}

export async function PATCH(r:Request,{params}:{params:Promise<{id:string}>}){try{
  const c=await context(r);const o=await access(c,(await params).id);
  const result=patch.safeParse(await r.json());if(!result.success)throw new HttpError(400,'Invalid order update');
  const p=result.data;if(!Object.keys(p).length)throw new HttpError(400,'Nothing to update');
  const payload=JSON.parse(o.payload) as Record<string,unknown>&{service:string;delivery?:boolean;collect?:boolean;deliver?:boolean;agreed?:boolean};
  const me=c.member.email;const changes:string[]=[];
  if(p.status){
    if(!next[o.status]?.includes(p.status))throw new HttpError(409,'This status transition is not allowed');
    const own=o.owner===c.u.userId&&['Submitted','Cancelled'].includes(p.status)&&['Draft','Submitted'].includes(o.status);
    const notary=c.role==='notary'&&o.assignee===me&&o.status==='Notary review'&&p.status==='Ready';
    const vendor=c.role==='vendor'&&o.vendor===me&&o.status==='Translating'&&['Notary review','Ready'].includes(p.status);
    if(!c.staff&&!own&&!notary&&!vendor)throw new HttpError(403,'You cannot change this status');
    if(p.status==='Submitted'&&!payload.agreed&&!p.agreed)throw new HttpError(400,'Accept order terms before submission');
    if(['Ready','Delivered'].includes(p.status)&&!['Courier only','Additional services','Notary only'].includes(payload.service)){const f=await db().prepare("SELECT id FROM files WHERE order_id = ? AND purpose = 'delivery'").bind(o.id).first();if(!f)throw new HttpError(400,'Upload the completed translation before marking this order ready');}
    changes.push('status: '+p.status);
  }
  if(p.agreed)payload.agreed=true;
  for(const [key,roles] of [['assignee',['notary','admin']],['courier',['courier','admin']],['vendor',['vendor','staff','admin']]] as const){
    if(p[key]===undefined)continue;
    if(!c.staff)throw new HttpError(403,'Staff access required');
    if(p[key]){const m=await db().prepare('SELECT role,active FROM members WHERE workspace = ? AND email = ?').bind(c.workspace.id,p[key]).first<{role:string;active:number}>();if(!m||!m.active||!(roles as readonly string[]).includes(m.role))throw new HttpError(400,'Choose an eligible workspace member');}
    changes.push(`${key}: ${p[key]||'Unassigned'}`);
  }
  const courierJob=hasCourier({service:payload.service,collect:payload.collect??payload.delivery,deliver:payload.deliver??payload.delivery});
  let shipment=o.shipment;
  if(p.courier!==undefined||p.shipment){
    if(!courierJob)throw new HttpError(400,'This order does not include courier delivery');
    if(['Delivered','Cancelled'].includes(o.shipment)&&p.shipment)throw new HttpError(409,'This shipment is closed');
    if(p.courier&&shipment==='Awaiting assignment')shipment='Assigned';
    if(!p.courier&&p.courier!==undefined&&shipment==='Assigned')shipment='Awaiting assignment';
    if(p.shipment&&p.shipment!==shipment){
      if(!c.staff&&!(c.role==='courier'&&o.courier===me))throw new HttpError(403,'Courier access required');
      if(!['Cancelled','Stopped'].includes(p.shipment)&&shipmentSteps.indexOf(p.shipment)!==shipmentSteps.indexOf(o.shipment)+1)throw new HttpError(409,'Complete delivery steps in order');
      if(p.shipment==='Stopped'&&!c.staff)throw new HttpError(403,'Staff access required');
      if(!o.courier&&!p.courier)throw new HttpError(400,'Assign a courier first');
      shipment=p.shipment;
    }
    if(shipment!==o.shipment)changes.push('shipment: '+shipment);
  }
  if(p.payment!==undefined){if(!c.staff)throw new HttpError(403,'Staff access required');if(p.payment!==o.payment)changes.push('payment: '+p.payment);}
  if(p.dueDate!==undefined){if(!c.staff)throw new HttpError(403,'Staff access required');changes.push('delivery date: '+(p.dueDate||'not set'));}
  if(!changes.length&&!p.agreed)throw new HttpError(400,'Nothing to update');
  const now=new Date().toISOString();
  const courier=p.courier===undefined?o.courier:p.courier;
  const status=p.status||o.status;
  const due=p.dueDate!==undefined?p.dueDate:p.status==='Submitted'&&!o.due_date?null:o.due_date;
  const changed=await db().batch([
    db().prepare('UPDATE orders SET status = ?, assignee = ?, courier = ?, vendor = ?, shipment = ?, payment = ?, paid_at = ?, due_date = ?, payload = ?, updated = ? WHERE id = ? AND updated = ? AND status = ? AND shipment = ?').bind(status,p.assignee===undefined?o.assignee:p.assignee,courier,p.vendor===undefined?o.vendor:p.vendor,shipment,p.payment||o.payment,p.payment==='Paid'&&o.payment!=='Paid'?now:o.paid_at,due,JSON.stringify(payload),now,o.id,o.updated,o.status,o.shipment),
    db().prepare('INSERT INTO events (id,workspace,order_id,actor,action,created) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),c.workspace.id,o.id,c.u.email,changes.join(' · ')||'Terms accepted',now),
  ]);
  if(!changed[0].meta.changes)throw new HttpError(409,'This project changed. Refresh before updating it.');
  // Keep the order's courier job in step with the order.
  if(courierJob&&(p.courier!==undefined||shipment!==o.shipment))await db().prepare('UPDATE shipments SET courier = ?, status = ?, updated = ? WHERE order_id = ?').bind(courier,shipment,now,o.id).run();
  if(p.status==='Submitted'){
    const fresh=await db().prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first<OrderRow>();
    const order=orderSchema.safeParse(payload);
    if(fresh&&order.success){const q=await quoteFor(c,order.data);await db().prepare('UPDATE orders SET due_date=COALESCE(due_date,?) WHERE id=?').bind(addBusinessDays(new Date(),q.days).toISOString().slice(0,10),o.id).run();
      if(hasCourier(order.data)&&!await db().prepare('SELECT 1 FROM shipments WHERE order_id=?').bind(o.id).first())await shipmentStatement(c,o.id,o.owner,order.data,q,await nextNumber('shipment_number_seq')).run();}
    await afterSubmit(c,o.id,r);
  }
  const origin=siteOrigin(r);const after=await db().prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first<OrderRow>();
  if(after&&p.payment==='Paid'&&o.payment!=='Paid'){
    await notifyOrderCustomer(c,after,'payment_received',origin);
    const sent=await sendToMainSystem('order.paid',{...publicOrder(after),payload:JSON.parse(after.payload)});
    await event(c.workspace.id,o.id,'system',sent.ok?'Sent to the main system':'Main system handoff: '+sent.detail).run();
  }
  if(after&&p.status&&['Ready','Delivered','Cancelled'].includes(p.status)&&o.owner!==c.u.userId)await notifyOrderCustomer(c,after,'status',origin,{status:p.status});
  return Response.json({ok:true});
}catch(e){return failure(e);}}

export async function PUT(r:Request,{params}:{params:Promise<{id:string}>}){try{
  const c=await context(r);const o=await access(c,(await params).id);
  if(o.status!=='Draft')throw new HttpError(409,'Only a draft quote can be edited');
  if(!c.staff&&o.owner!==c.u.userId)throw new HttpError(403,'Only the quote owner can edit this draft');
  const b=await r.json() as {payload?:unknown;submit?:boolean};
  const parsed=orderSchema.safeParse(b.payload);if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
  if(parsed.data.service==='Additional services')throw new HttpError(400,'Send additional service requests with the inquiry form');
  if(b.submit&&!parsed.data.agreed)throw new HttpError(400,'Please accept the service terms');
  const ids=parsed.data.documents.flatMap(d=>d.fileIds);
  for(const id of ids){const f=await db().prepare('SELECT id FROM files WHERE id = ? AND workspace = ? AND (order_id = ? OR (owner = ? AND order_id IS NULL))').bind(id,c.workspace.id,o.id,c.u.userId).first();if(!f)throw new HttpError(400,'Invalid document attachment');}
  const q=await quoteFor(c,parsed.data);const status=b.submit?'Submitted':'Draft';const marker=crypto.randomUUID();const now=new Date();
  const payload={...parsed.data,_quote:{lines:q.lines,total:q.total,days:q.days,carrier:q.carrier}};
  const statements=[db().prepare('UPDATE orders SET payload = ?, total = ?, status = ?, currency = ?, due_date = ?, updated = ? WHERE id = ? AND status = ? AND updated = ? AND payload = ?').bind(JSON.stringify(payload),q.total,status,parsed.data.currency,b.submit?addBusinessDays(now,q.days).toISOString().slice(0,10):null,now.toISOString(),o.id,'Draft',o.updated,o.payload),db().prepare('INSERT INTO events (id,workspace,order_id,actor,action,created) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(marker,c.workspace.id,o.id,c.u.email,b.submit?'Edited quote submitted for review':'Draft quote updated',now.toISOString()),db().prepare("UPDATE files SET order_id=NULL WHERE order_id=? AND purpose='source' AND id NOT IN (SELECT jsonb_array_elements_text(?::jsonb)) AND EXISTS (SELECT 1 FROM events WHERE id=?)").bind(o.id,JSON.stringify(ids),marker),...ids.map(id=>db().prepare('UPDATE files SET order_id = ? WHERE id = ? AND workspace = ? AND EXISTS (SELECT 1 FROM events WHERE id=?)').bind(o.id,id,c.workspace.id,marker))];
  if(b.submit&&hasCourier(parsed.data))statements.push(shipmentStatement(c,o.id,o.owner,parsed.data,q,await nextNumber('shipment_number_seq')));
  const changed=await db().batch(statements);
  if(!changed[0].meta.changes)throw new HttpError(409,'This quote changed. Refresh before saving.');
  if(b.submit)await afterSubmit(c,o.id,r);
  return Response.json({id:o.id,reference:o.reference,total:q.total,status});
}catch(e){return failure(e);}}

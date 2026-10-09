import {context,db,failure,HttpError,event} from '@/lib/server';
import {addressSchema,urgencies} from '@/lib/catalog';
import {shipmentAccess,shipmentView,syncOrder,shipmentStatuses} from '@/lib/shipments';
import {z} from 'zod';
const steps=['Awaiting assignment','Assigned','Collected','In transit','Delivered'];
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context();const s=await shipmentAccess(c,(await params).id);return Response.json(shipmentView(s));}catch(e){return failure(e);}}
// Update (staff: all details while the job is open), take (courier: accept an open job in
// their area), status steps (assigned courier or staff), stop/cancel (staff).
const patch=z.object({action:z.enum(['take','release']).optional(),status:z.enum(shipmentStatuses).optional(),courier:z.string().email().nullable().optional(),returnCourier:z.string().email().nullable().optional(),deliveryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),sameDay:z.boolean().optional(),nextDay:z.boolean().optional(),urgency:z.enum(urgencies).optional(),type:z.enum(['1 way','2 way']).optional(),operator:z.string().max(60).optional(),tracking:z.string().max(80).optional(),notes:z.string().max(1000).optional(),origin:addressSchema.optional(),destination:addressSchema.optional(),customerName:z.string().trim().min(2).max(120).optional(),customerPhone:z.string().max(40).optional(),sum:z.number().min(0).max(100000).optional(),updated:z.string().optional()}).strict();
export async function PATCH(r:Request,{params}:{params:Promise<{id:string}>}){try{const c=await context(r);const s=await shipmentAccess(c,(await params).id);const parsed=patch.safeParse(await r.json());if(!parsed.success)throw new HttpError(400,'Invalid delivery update');const p=parsed.data;if(!Object.keys(p).length)throw new HttpError(400,'Nothing to update');
  const me=c.member.email;const next={...s};const changes:string[]=[];
  const closed=['Delivered','Cancelled'].includes(s.status);
  if(p.updated&&p.updated!==s.updated)throw new HttpError(409,'This delivery changed. Refresh before updating it.');
  if(p.action==='take'){if(c.role!=='courier')throw new HttpError(403,'Courier access required');if(s.courier||s.status!=='Awaiting assignment')throw new HttpError(409,'Another courier already took this delivery');next.courier=me;next.status='Assigned';changes.push('taken by '+me);}
  if(p.action==='release'){if(c.role!=='courier'||s.courier!==me||s.status!=='Assigned')throw new HttpError(409,'Only an assigned, not yet collected delivery can be released');next.courier=null;next.status='Awaiting assignment';changes.push('released by '+me);}
  const detailKeys=['courier','returnCourier','deliveryDate','sameDay','nextDay','urgency','type','operator','notes','origin','destination','customerName','customerPhone','sum'] as const;
  if(detailKeys.some(k=>p[k]!==undefined)){
    if(!c.staff)throw new HttpError(403,'Staff access required');
    if(closed)throw new HttpError(409,'Completed or cancelled deliveries cannot be changed');
    for(const e of [p.courier,p.returnCourier])if(e){const m=await db().prepare("SELECT 1 FROM members WHERE workspace=? AND email=? AND role IN ('courier','admin') AND active=1").bind(c.workspace.id,e).first();if(!m)throw new HttpError(400,'Choose an active courier');}
    if(p.courier!==undefined){next.courier=p.courier;if(p.courier&&next.status==='Awaiting assignment')next.status='Assigned';if(!p.courier&&next.status==='Assigned')next.status='Awaiting assignment';}
    if(p.returnCourier!==undefined)next.return_courier=p.returnCourier;
    if(p.deliveryDate!==undefined)next.delivery_date=p.deliveryDate;
    if(p.sameDay!==undefined)next.same_day=p.sameDay?1:0;if(p.nextDay!==undefined)next.next_day=p.nextDay?1:0;
    if(p.urgency)next.urgency=p.urgency;if(p.type)next.type=p.type;if(p.operator!==undefined)next.operator=p.operator;if(p.notes!==undefined)next.notes=p.notes;
    if(p.origin)next.origin=JSON.stringify(p.origin);if(p.destination)next.destination=JSON.stringify(p.destination);
    if(p.customerName)next.customer_name=p.customerName;if(p.customerPhone!==undefined)next.customer_phone=p.customerPhone;if(p.sum!==undefined)next.sum=Math.round(p.sum*100);
    changes.push('details updated');
  }
  if(p.tracking!==undefined){if(!c.staff&&s.courier!==me)throw new HttpError(403,'Courier access required');next.tracking=p.tracking;changes.push('tracking '+p.tracking);}
  if(p.status&&p.status!==next.status){
    if(['Stopped','Cancelled'].includes(p.status)||s.status==='Stopped'){if(!c.staff)throw new HttpError(403,'Staff access required');if(closed)throw new HttpError(409,'This delivery is closed');if(s.status==='Stopped'&&!['Cancelled','Assigned','Awaiting assignment'].includes(p.status))throw new HttpError(409,'Resume a stopped delivery before continuing');}
    else{
      if(!c.staff&&!(c.role==='courier'&&(next.courier===me||next.return_courier===me)))throw new HttpError(403,'Courier access required');
      if(steps.indexOf(p.status)!==steps.indexOf(next.status)+1)throw new HttpError(409,'Complete delivery steps in order');
      if(!next.courier)throw new HttpError(400,'Assign a courier first');
    }
    next.status=p.status;changes.push('status: '+p.status);
  }
  const now=new Date().toISOString();
  const res=await db().batch([db().prepare('UPDATE shipments SET courier=?,return_courier=?,status=?,delivery_date=?,same_day=?,next_day=?,urgency=?,type=?,operator=?,tracking=?,notes=?,origin=?,destination=?,customer_name=?,customer_phone=?,sum=?,updated=? WHERE id=? AND updated=?').bind(next.courier,next.return_courier,next.status,next.delivery_date,next.same_day,next.next_day,next.urgency,next.type,next.operator,next.tracking,next.notes,next.origin,next.destination,next.customer_name,next.customer_phone,next.sum,now,s.id,s.updated),...(s.order_id?[syncOrder(s,next.courier,next.status,now),event(c.workspace.id,s.order_id,c.u.email,'Delivery: '+changes.join(' · '))]:[])]);
  if(!res[0].meta.changes)throw new HttpError(409,'This delivery changed. Refresh before updating it.');
  return Response.json({ok:true});
}catch(e){return failure(e);}}

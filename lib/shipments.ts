import {db,HttpError,type Ctx} from './server';
import {normalizeAddress,shipmentReference} from './catalog';
export type ShipmentRow={id:string;workspace:string;number:number;order_id:string|null;customer_account:string|null;customer_name:string;customer_email:string;customer_phone:string;status:string;delivery_date:string|null;same_day:number;next_day:number;urgency:string;type:string;operator:string;courier:string|null;return_courier:string|null;origin:string;destination:string;sum:number;international:number;tracking:string;notes:string;created:string;updated:string};
export const shipmentStatuses=['Awaiting assignment','Assigned','Collected','In transit','Delivered','Stopped','Cancelled'] as const;
export function shipmentView(s:ShipmentRow,extra:Record<string,unknown>={}){return {...s,reference:shipmentReference(s.number),origin:normalizeAddress(JSON.parse(s.origin)),destination:normalizeAddress(JSON.parse(s.destination)),...extra};}
// A courier sees jobs assigned to them, plus unassigned jobs in their area of activity.
export function inArea(area:string,s:ShipmentRow){
  if(!area.trim())return true;
  const words=area.toLowerCase().split(/[,;/]+|\s+and\s+/).map(w=>w.trim()).filter(w=>w.length>1);
  const o=normalizeAddress(JSON.parse(s.origin));
  const hay=[o.city,o.street,o.postcode].join(' ').toLowerCase();
  return words.some(w=>hay.includes(w)||w.includes(o.city.toLowerCase()||'\u0000'));
}
export async function shipmentAccess(c:Ctx,id:string){
  const s=await db().prepare('SELECT * FROM shipments WHERE id=? AND workspace=?').bind(id,c.workspace.id).first<ShipmentRow>();
  if(!s)throw new HttpError(404,'Shipment not found');
  if(c.staff)return s;
  const me=c.member.email;
  if(c.role==='courier'&&(s.courier===me||s.return_courier===me||(!s.courier&&s.status==='Awaiting assignment'&&inArea(c.member.area,s))))return s;
  if(s.customer_account===c.u.userId)return s;
  throw new HttpError(403,'This delivery is not assigned to you');
}
// Mirrors a shipment's courier and status onto its order (one courier job per order).
export function syncOrder(s:{order_id:string|null},courier:string|null,status:string,now:string){
  return db().prepare('UPDATE orders SET courier=?, shipment=?, updated=? WHERE id=?').bind(courier,status,now,s.order_id);
}

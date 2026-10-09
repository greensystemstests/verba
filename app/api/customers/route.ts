import {context,db,failure,staff} from '@/lib/server';
import {normalizeAddress,addressLine} from '@/lib/catalog';
// Customer cards (spec 1.11): registered customers and anyone who ordered or received a delivery.
type Row={key:string;name:string;email:string;phone:string;address:string;customerType:string;company:string;orders:number;shipments:number;registered:boolean;active:boolean;last:string};
export async function GET(){try{const c=await context();staff(c);const w=c.workspace.id;
  const map=new Map<string,Row>();
  const get=(email:string,name:string)=>{const key=(email||name).toLowerCase();let r=map.get(key);if(!r){r={key,name,email,phone:'',address:'',customerType:'Private',company:'',orders:0,shipments:0,registered:false,active:true,last:''};map.set(key,r);}return r;};
  const accounts=(await db().prepare("SELECT a.*,m.active FROM members m JOIN accounts a ON a.email=m.email WHERE m.workspace=? AND m.role='customer'").bind(w).all<{email:string;name:string;phone:string|null;address:string;customer_type:string;company:string;active:number;created:string}>()).results;
  for(const a of accounts){const r=get(a.email,a.name);r.registered=true;r.active=!!a.active;r.phone=a.phone||'';r.customerType=a.customer_type;r.company=a.company;try{r.address=addressLine(normalizeAddress(JSON.parse(a.address)));}catch{}r.last=a.created;}
  const orders=(await db().prepare("SELECT payload,created FROM orders WHERE workspace=? AND status<>'Draft'").bind(w).all<{payload:string;created:string}>()).results;
  for(const o of orders){const p=JSON.parse(o.payload) as {email?:string;name?:string;firstName?:string;lastName?:string;phone?:string;phonePrefix?:string;company?:string};const name=[p.firstName,p.lastName].filter(Boolean).join(' ')||p.name||'';if(!p.email&&!name)continue;const r=get(p.email||'',name);r.orders++;if(!r.phone&&p.phone)r.phone=[p.phonePrefix,p.phone].filter(Boolean).join(' ');if(!r.company&&p.company){r.company=p.company;}if(o.created>r.last)r.last=o.created;}
  const ships=(await db().prepare('SELECT customer_name,customer_email,customer_phone,origin,created FROM shipments WHERE workspace=?').bind(w).all<{customer_name:string;customer_email:string;customer_phone:string;origin:string;created:string}>()).results;
  for(const s of ships){const r=get(s.customer_email,s.customer_name);r.shipments++;if(!r.phone)r.phone=s.customer_phone;if(!r.address){try{r.address=addressLine(normalizeAddress(JSON.parse(s.origin)));}catch{}}if(s.created>r.last)r.last=s.created;}
  return Response.json([...map.values()].map(r=>({...r,customerType:r.registered?r.customerType:r.company?'Business':'Private'})).sort((a,b)=>b.last.localeCompare(a.last)));}catch(e){return failure(e);}}

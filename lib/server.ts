import {getUser,type AppUser} from '@/lib/account';
import {defaultPricing,normalizePricing,normalizeOrder,customerKind,type Pricing,type CustomerKind} from './catalog';
import {runtime,db} from './runtime';
export {runtime,db};
export function failure(e:unknown){if(e instanceof SyntaxError)return Response.json({error:'The request is not valid JSON.'},{status:400});console.error('Verba request failed',e instanceof Error?e.message:'Unknown error');return Response.json({error:e instanceof HttpError?e.message:'Unable to complete this request. Your changes have not been discarded; please try again.'},{status:e instanceof HttpError?e.status:503});}
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
// Accepts the browser Origin when it matches this site. Behind a TLS-terminating proxy
// (Render, Netlify), the public origin comes from the Host header and X-Forwarded-Proto.
export function allowedOrigins(r:Request){const h=r.headers;const set=new Set<string>([new URL(r.url).origin]);const host=h.get('x-forwarded-host')?.split(',')[0].trim()||h.get('host');const proto=h.get('x-forwarded-proto')?.split(',')[0].trim()||new URL(r.url).protocol.replace(':','');if(host)set.add(`${proto}://${host}`);for(const configured of [runtime().APP_ORIGIN,runtime().RENDER_EXTERNAL_URL,process.env.URL,process.env.DEPLOY_PRIME_URL])if(configured){try{set.add(new URL(configured).origin);}catch{}}return set;}
export function sameOrigin(r:Request){const origin=r.headers.get('origin');if(origin&&!allowedOrigins(r).has(origin))throw new HttpError(403,'Request origin not allowed');}
// Public origin of this site, for links in emails and sign-in redirects.
export function siteOrigin(r?:Request){const configured=runtime().APP_ORIGIN||process.env.URL||runtime().RENDER_EXTERNAL_URL;if(configured)try{return new URL(configured).origin;}catch{}if(!r)return '';const h=r.headers;const host=h.get('x-forwarded-host')?.split(',')[0].trim()||h.get('host');const proto=h.get('x-forwarded-proto')?.split(',')[0].trim()||new URL(r.url).protocol.replace(':','');return host?`${proto}://${host}`:new URL(r.url).origin;}
// Client address for rate limiting, as reported by the hosting proxy.
export function clientAddress(r:Request){const h=r.headers;return h.get('x-nf-client-connection-ip')||h.get('cf-connecting-ip')||h.get('true-client-ip')||h.get('x-forwarded-for')?.split(',')[0].trim()||'shared';}

export const roles=['admin','staff','customer','vendor','reviewer','notary','courier'] as const;
export type Role=typeof roles[number];
export type Member={id:string;workspace:string;email:string;role:Role;name:string;area:string;phone:string;address:string;business_number:string;active:number};
export type WorkspaceConfig={notifyEmail?:string;officeAddress?:Record<string,string>;bannerTitle?:string;bannerText?:string;liveRates?:boolean};
export type Workspace={id:string;owner:string;name:string;pricing:string;config:string;created:string};
export type Ctx={u:AppUser;member:Member;workspace:Workspace;pricing:Pricing;config:WorkspaceConfig;admin:boolean;staff:boolean;role:Role};

// The workspace that public sign-ups and visitors' orders belong to (the operating company).
export async function primaryWorkspace():Promise<string|null>{
  const set=await db().prepare("SELECT value FROM settings WHERE key='primary_workspace'").first<{value:string}>();
  if(set?.value&&await db().prepare('SELECT 1 FROM workspaces WHERE id=?').bind(set.value).first())return set.value;
  const first=await db().prepare('SELECT id FROM workspaces ORDER BY created, id LIMIT 1').first<{id:string}>();
  return first?.id||null;
}
export async function context(r?:Request):Promise<Ctx>{
  if(r&&r.method!=='GET')sameOrigin(r);
  const u=await getUser();if(!u)throw new HttpError(401,'Sign in to continue');
  const email=u.email.toLowerCase();
  let membership=await db().prepare("SELECT * FROM members WHERE email = ? ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END LIMIT 1").bind(email).first<Member>();
  if(!membership){
    // Accounts without a membership join the operating company as customers. The very
    // first account on an empty database becomes the administrator of a new workspace.
    const primary=await primaryWorkspace();const stamp=new Date().toISOString();
    if(primary)await db().prepare('INSERT INTO members (id,workspace,email,role,name,area) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),primary,email,'customer',u.fullName||email,'').run();
    else{const id=u.userId;await db().batch([db().prepare('INSERT INTO workspaces (id,owner,name,pricing,created) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id,id,'Verba workspace',JSON.stringify(defaultPricing),stamp),db().prepare('INSERT INTO members (id,workspace,email,role,name,area) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),id,email,'admin',u.fullName||email,'')]);}
    membership=await db().prepare('SELECT * FROM members WHERE email = ? LIMIT 1').bind(email).first<Member>();
    if(!membership)throw new HttpError(503,'Unable to prepare your workspace. Please try again.');
  }
  if(!membership.active)throw new HttpError(403,'Your access to this workspace has been deactivated. Contact the administrator.');
  const workspace=await db().prepare('SELECT * FROM workspaces WHERE id = ?').bind(membership.workspace).first<Workspace>();
  if(!workspace)throw new HttpError(503,'Workspace not found');
  let config:WorkspaceConfig={};try{config=JSON.parse(workspace.config||'{}');}catch{}
  const role=(roles as readonly string[]).includes(membership.role)?membership.role:'customer';
  return {u,member:membership,workspace,pricing:normalizePricing(JSON.parse(workspace.pricing)),config,admin:role==='admin',staff:role==='admin'||role==='staff',role};
}
// Optional session: returns null for visitors instead of failing.
export async function optionalContext(r?:Request){try{return await context(r);}catch(e){if(e instanceof HttpError&&e.status===401)return null;throw e;}}
export async function customerKindFor(c:Ctx):Promise<CustomerKind>{
  const row=await db().prepare("SELECT COUNT(*) AS n FROM orders WHERE owner=? AND status NOT IN ('Draft','Cancelled')").bind(c.u.userId).first<{n:number}>();
  return customerKind({business:c.u.customerType==='Business',previousOrders:row?.n||0});
}
export type OrderRow={id:string;workspace:string;owner:string;reference:string;payload:string;total:number;status:string;payment:string;assignee:string|null;courier:string|null;vendor:string|null;shipment:string;number:number|null;due_date:string|null;paid_at:string|null;currency:string;created:string;updated:string};
export async function access(c:Ctx,id:string){
  const o=await db().prepare('SELECT * FROM orders WHERE id = ? AND workspace = ?').bind(id,c.workspace.id).first<OrderRow>();
  if(!o)throw new HttpError(404,'Order not found');
  if(c.staff||o.owner===c.u.userId||o.assignee===c.member.email||o.vendor===c.member.email)return o;
  if(c.role==='courier'&&(o.courier===c.member.email||await db().prepare('SELECT 1 FROM shipments WHERE order_id=? AND (courier=? OR return_courier=?)').bind(o.id,c.member.email,c.member.email).first()))return o;
  throw new HttpError(403,'This order is not assigned to you');
}
export function publicOrder(o:OrderRow,c?:Ctx){
  const raw=normalizeOrder(JSON.parse(o.payload));const payload={...raw,title:raw.title||raw.service};
  if(c?.role==='courier'){return {...o,total:0,assignee:null,vendor:null,payload:{...payload,title:'Document delivery',service:'Courier only' as const,sector:'General' as const,targets:[],documents:[],description:'',notes:'',freeText:'',agreed:true}};}
  return {...o,payload};
}
export function admin(c:Ctx){if(!c.admin)throw new HttpError(403,'Administrator access required');}
export function staff(c:Ctx){if(!c.staff)throw new HttpError(403,'Staff access required');}
export function event(workspace:string,order:string,actor:string,action:string){return db().prepare('INSERT INTO events (id,workspace,order_id,actor,action,created) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),workspace,order,actor,action,new Date().toISOString());}

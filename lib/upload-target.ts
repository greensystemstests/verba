import {optionalContext,sameOrigin,clientAddress,primaryWorkspace,access,HttpError,db} from './server';
import {guestKey,authLimit} from './account';
import {checkOrderUpload,purgeGuestFiles,type Target} from './uploads';
// Resolves where an upload goes: a signed-in user's workspace (optionally an order), or a visitor's private holding area.
export async function uploadTarget(r:Request,orderId:string|null,purpose:string):Promise<{target:Target;cookie?:string}>{
  sameOrigin(r);
  const c=await optionalContext(r);
  if(c){
    if(orderId){const o=await access(c,orderId);checkOrderUpload(c,o,purpose);}
    else if(purpose==='delivery')throw new HttpError(400,'Select an order before uploading a result');
    return {target:{ownerKey:c.u.userId,workspace:c.workspace.id,actor:c.u.email,orderId,purpose:purpose==='delivery'?'delivery':'source'}};
  }
  if(orderId||purpose==='delivery')throw new HttpError(401,'Sign in to continue');
  const ip=clientAddress(r);
  if(!await authLimit('guest-upload:'+ip,30,1440))throw new HttpError(429,'Too many uploads. Sign in to continue uploading.');
  const workspace=await primaryWorkspace();if(!workspace)throw new HttpError(503,'Uploads open once the service is set up.');
  const g=await guestKey(true);
  if(!await authLimit('guest-files:'+g.key,20,1440))throw new HttpError(429,'Too many uploads. Sign in to continue uploading.');
  await purgeGuestFiles().catch(()=>{});
  return {target:{ownerKey:g.key!,workspace,actor:'visitor',orderId:null,purpose:'source'},cookie:g.cookie};
}
// Files the current person may analyse: their own uploads (visitors by their browser key), files of orders they can
// open, or any file in the workspace for staff. Returns the workspace and the allowed ids in the given order.
export async function readableFiles(ids:string[]):Promise<{workspace:string|null;ids:string[];pricing?:import('./catalog').Pricing}>{
  const unique=[...new Set(ids)].slice(0,20);
  const c=await optionalContext();
  if(c){const ok:string[]=[];for(const id of unique){const f=await db().prepare('SELECT owner,order_id FROM files WHERE id=? AND workspace=?').bind(id,c.workspace.id).first<{owner:string;order_id:string|null}>();if(!f)continue;
      if(c.staff||f.owner===c.u.userId){ok.push(id);continue;}
      if(f.order_id){try{await access(c,f.order_id);ok.push(id);}catch{}}}
    return {workspace:c.workspace.id,ids:ok,pricing:c.pricing};}
  const g=await guestKey(false);const workspace=await primaryWorkspace();if(!g.key||!workspace)return {workspace:null,ids:[]};
  const ok:string[]=[];for(const id of unique){const f=await db().prepare('SELECT id FROM files WHERE id=? AND workspace=? AND owner=?').bind(id,workspace,g.key).first();if(f)ok.push(id);}
  return {workspace,ids:ok};
}

import {optionalContext,sameOrigin,clientAddress,primaryWorkspace,access,HttpError} from './server';
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

import {failure,HttpError} from '@/lib/server';
import {storeUpload,MAX_UPLOAD} from '@/lib/uploads';
import {uploadTarget} from '@/lib/upload-target';
// Single-request upload (files up to about 4 MB; larger files use /api/files/chunk).
export async function POST(r:Request){try{
  if(Number(r.headers.get('content-length')||0)>MAX_UPLOAD+1024*1024)throw new HttpError(413,'Maximum file size is 10 MB');
  const form=await r.formData();const f=form.get('file');
  if(!(f instanceof File)||f.size===0||f.size>MAX_UPLOAD)throw new HttpError(400,'Choose a file between 1 byte and 10 MB');
  const {target,cookie}=await uploadTarget(r,String(form.get('orderId')||'')||null,String(form.get('purpose')||'source'));
  const result=await storeUpload(new Uint8Array(await f.arrayBuffer()),f.name,target);
  return Response.json(result,{status:201,headers:cookie?{'Set-Cookie':cookie}:{}});
}catch(e){return failure(e);}}

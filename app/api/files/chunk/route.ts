import {db,failure,HttpError} from '@/lib/server';
import {storeUpload,checkName,MAX_UPLOAD} from '@/lib/uploads';
import {uploadTarget} from '@/lib/upload-target';
// Uploads a large file in pieces of up to 3 MB, so each request stays within hosting
// limits (serverless functions accept about 6 MB per request). The last piece stores the file.
const CHUNK=3*1024*1024;
export async function POST(r:Request){try{
  const h=r.headers;const uploadId=h.get('x-upload-id')||'';const index=Number(h.get('x-chunk-index'));const count=Number(h.get('x-chunk-count'));
  const name=decodeURIComponent(h.get('x-file-name')||'');const size=Number(h.get('x-file-size'));
  if(!/^[0-9a-f-]{36}$/.test(uploadId)||!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>4||index<0||index>=count||!(size>0&&size<=MAX_UPLOAD))throw new HttpError(400,'Invalid upload');
  checkName(name);
  const {target,cookie}=await uploadTarget(r,h.get('x-order-id')||null,h.get('x-purpose')||'source');
  const bytes=new Uint8Array(await r.arrayBuffer());if(!bytes.length||bytes.length>CHUNK)throw new HttpError(400,'Invalid upload piece');
  const owner=await db().prepare('SELECT owner_key FROM upload_chunks WHERE upload_id=? LIMIT 1').bind(uploadId).first<{owner_key:string}>();
  if(owner&&owner.owner_key!==target.ownerKey)throw new HttpError(403,'Invalid upload');
  await db().prepare('INSERT INTO upload_chunks (upload_id,idx,owner_key,data,created) VALUES (?,?,?,?,?) ON CONFLICT (upload_id,idx) DO UPDATE SET data=excluded.data').bind(uploadId,index,target.ownerKey,Buffer.from(bytes),new Date().toISOString()).run();
  const parts=(await db().prepare('SELECT idx,length(data) AS n FROM upload_chunks WHERE upload_id=? ORDER BY idx').bind(uploadId).all<{idx:number;n:number}>()).results;
  if(parts.length<count)return Response.json({received:parts.length},{status:202,headers:cookie?{'Set-Cookie':cookie}:{}});
  const rows=(await db().prepare('SELECT data FROM upload_chunks WHERE upload_id=? ORDER BY idx').bind(uploadId).all<{data:Buffer}>()).results;
  await db().prepare('DELETE FROM upload_chunks WHERE upload_id=?').bind(uploadId).run();
  const whole=Buffer.concat(rows.map(x=>x.data));if(whole.length!==size)throw new HttpError(400,'The upload was incomplete. Please try again.');
  const result=await storeUpload(new Uint8Array(whole),name,target);
  return Response.json(result,{status:201,headers:cookie?{'Set-Cookie':cookie}:{}});
}catch(e){return failure(e);}}

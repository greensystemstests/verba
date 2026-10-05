import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {db} from './runtime';
import {randomToken,tokenHash,safeReturnPath} from './account-crypto';
export type AppUser={userId:string;displayName:string;fullName:string;email:string};
export const SESSION_COOKIE='__Host-verba_session';
export async function getUser():Promise<AppUser|null>{const h=await headers();const raw=h.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const row:any=await db().prepare('SELECT a.id,a.email,a.name FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires>?').bind(tokenHash(raw),new Date().toISOString()).first();return row?{userId:row.id,email:row.email,fullName:row.name,displayName:row.name}:null;}
export async function requireUser(returnTo:string){const u=await getUser();if(u)return u;redirect('/account?return_to='+encodeURIComponent(safeReturnPath(returnTo)));}
export async function createSession(accountId:string){const token=randomToken();await db().prepare('INSERT INTO sessions (token_hash,account_id,expires,created) VALUES (?,?,?,?)').bind(tokenHash(token),accountId,new Date(Date.now()+7*86400000).toISOString(),new Date().toISOString()).run();return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;}
export async function revokeSession(){const h=await headers();const token=h.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);if(token)await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash(token)).run();}
export async function authLimit(key:string,max=10){const bucket=Math.floor(Date.now()/900000);const id=tokenHash(key+':'+bucket);const row=await db().prepare('INSERT INTO auth_limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=auth_limits.count+1 RETURNING count').bind(id,new Date(Date.now()+1800000).toISOString()).first<{count:number}>();return (row?.count||0)<=max;}

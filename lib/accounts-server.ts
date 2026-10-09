// Account creation, email verification and password reset links.
import {db,primaryWorkspace,HttpError} from './server';
import {hashPassword,randomToken,tokenHash} from './account-crypto';
import {notify} from './notify';
import {providers} from './notify';

// Password rule shared by sign-up, invitations and resets: 10–128 characters and not an obvious pattern.
export function passwordProblem(password:string,personal:string[]=[]){
  if(password.length<10)return 'Use at least 10 characters.';
  if(password.length>128)return 'Use at most 128 characters.';
  const lower=password.toLowerCase();
  if(/^(.)\1+$/.test(password)||/^(0123456789|1234567890|qwertyuiop|password|passw0rd)/.test(lower))return 'Choose a less predictable password.';
  if(personal.some(p=>p&&p.length>=4&&lower.includes(p.toLowerCase())))return 'Do not use your name or email in the password.';
  return null;
}
export type NewAccount={email:string;firstName:string;lastName:string;phone?:string|null;password?:string;verified?:boolean;language?:string;company?:string;customerType?:string;country?:string};
// Creates an account and adds it as a customer of the operating company's workspace.
export async function createCustomerAccount(a:NewAccount){
  const workspace=await primaryWorkspace();
  if(!workspace)throw new HttpError(503,'Registration opens once the service administrator has set up the workspace.');
  const email=a.email.trim().toLowerCase();
  if(await db().prepare('SELECT 1 FROM accounts WHERE email=?').bind(email).first())throw new HttpError(409,'An account with this email already exists. Sign in instead.');
  if(a.phone&&await db().prepare('SELECT 1 FROM accounts WHERE phone=?').bind(a.phone).first())throw new HttpError(409,'This phone number is already registered. Sign in instead.');
  const existingMember=await db().prepare('SELECT workspace,role FROM members WHERE email=? LIMIT 1').bind(email).first<{workspace:string;role:string}>();
  const id=crypto.randomUUID();const now=new Date().toISOString();const recovery=randomToken();
  const name=[a.firstName,a.lastName].filter(Boolean).join(' ').trim()||email;
  const statements=[db().prepare('INSERT INTO accounts (id,email,name,password_hash,recovery_hash,first_name,last_name,phone,email_verified_at,company,customer_type,country,language,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,email,name,hashPassword(a.password||randomToken()),tokenHash(recovery),a.firstName.trim(),a.lastName.trim(),a.phone||null,a.verified?now:null,a.company||'',a.customerType==='Business'?'Business':'Private',a.country||'IL',a.language==='he'?'he':'en',now)];
  if(!existingMember)statements.push(db().prepare('INSERT INTO members (id,workspace,email,role,name,area,phone) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),workspace,email,'customer',name,'',a.phone||''));
  await db().batch(statements);
  return {id,email,name,recovery,workspace:existingMember?.workspace||workspace};
}
export async function issueToken(accountId:string,purpose:'verify'|'reset',hours:number){
  const token=randomToken();const now=new Date().toISOString();
  await db().batch([db().prepare('DELETE FROM email_tokens WHERE account_id=? AND purpose=?').bind(accountId,purpose),db().prepare('INSERT INTO email_tokens (token_hash,account_id,purpose,expires,created) VALUES (?,?,?,?,?)').bind(tokenHash(token),accountId,purpose,new Date(Date.now()+hours*3600000).toISOString(),now)]);
  return token;
}
// Marks a link as used and returns its account, or null when it is unknown, used or expired.
export async function consumeToken(token:string,purpose:'verify'|'reset'){
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const now=new Date().toISOString();
  const row=await db().prepare('UPDATE email_tokens SET used_at=? WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires>? RETURNING account_id').bind(now,tokenHash(token),purpose,now).first<{account_id:string}>();
  return row?.account_id||null;
}
export async function sendVerification(account:{id:string;email:string;name:string;language?:string},origin:string,workspace:string|null){
  if(!providers.email())return false;
  const token=await issueToken(account.id,'verify',24);
  const [r]=await notify(workspace,{email:account.email,lang:account.language,notify:'["email"]'},'verify',{name:account.name,link:`${origin}/account#verify=${token}`});
  return !!r;
}

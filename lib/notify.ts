// Email (SMTP), SMS and WhatsApp (Twilio) notifications. Each provider is used only
// when its settings are present; otherwise the message is logged as "skipped" so the
// administrator can see what would have been sent (Settings → Notifications).
import nodemailer,{type Transporter} from 'nodemailer';
import {db} from './runtime';
import {makeT,type Lang} from './i18n/core';
import {template,type TemplateName} from './messages';
export type Channel='email'|'sms'|'whatsapp'|'viber'|'wechat';
export const channels:Channel[]=['email','sms','whatsapp','viber','wechat'];
const env=process.env;
export const providers={
  email:()=>!!(env.SMTP_URL||env.SMTP_HOST),
  sms:()=>!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&(env.TWILIO_FROM||env.TWILIO_MESSAGING_SERVICE_SID)),
  whatsapp:()=>!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_WHATSAPP_FROM),
  viber:()=>false,
  wechat:()=>false,
};
async function record(workspace:string|null,recipient:string,channel:Channel,name:string,subject:string,status:'sent'|'skipped'|'failed',detail=''){
  try{await db().prepare('INSERT INTO notifications (id,workspace,recipient,channel,template,subject,status,detail,created) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),workspace,recipient,channel,name,subject.slice(0,300),status,detail.slice(0,500),new Date().toISOString()).run();}catch(e){console.error('Notification log failed',e instanceof Error?e.message:e);}
}
let transport:Transporter|null=null;
function mailer(){
  if(transport)return transport;
  transport=env.SMTP_URL?nodemailer.createTransport(env.SMTP_URL):nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true'||env.SMTP_PORT==='465',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined});
  return transport;
}
export async function sendEmail(workspace:string|null,to:string,subject:string,text:string,name:string){
  if(!providers.email()){await record(workspace,to,'email',name,subject,'skipped','Email provider not connected');return false;}
  try{await Promise.race([mailer().sendMail({from:env.MAIL_FROM||'Verba <no-reply@verba.local>',to,subject,text,replyTo:env.MAIL_REPLY_TO||undefined}),new Promise((_,no)=>setTimeout(()=>no(new Error('Timed out')),10000))]);await record(workspace,to,'email',name,subject,'sent');return true;}
  catch(e){await record(workspace,to,'email',name,subject,'failed',e instanceof Error?e.message:'Send failed');return false;}
}
export async function sendText(workspace:string|null,channel:Channel,to:string,body:string,name:string){
  if(channel==='email')return false;
  if(!providers[channel]()){await record(workspace,to,channel,name,body.slice(0,80),'skipped',channel==='viber'||channel==='wechat'?'Requires a Viber or WeChat business account':'Messaging provider not connected');return false;}
  const form=new URLSearchParams({To:channel==='whatsapp'?'whatsapp:'+to:to,Body:body.slice(0,1500)});
  if(channel==='whatsapp')form.set('From',env.TWILIO_WHATSAPP_FROM!.startsWith('whatsapp:')?env.TWILIO_WHATSAPP_FROM!:'whatsapp:'+env.TWILIO_WHATSAPP_FROM);
  else if(env.TWILIO_MESSAGING_SERVICE_SID)form.set('MessagingServiceSid',env.TWILIO_MESSAGING_SERVICE_SID);else form.set('From',env.TWILIO_FROM!);
  try{const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('Provider answered '+r.status);await record(workspace,to,channel,name,body.slice(0,80),'sent');return true;}
  catch(e){await record(workspace,to,channel,name,body.slice(0,80),'failed',e instanceof Error?e.message:'Send failed');return false;}
}
export type Recipient={email?:string|null;phone?:string|null;lang?:string|null;notify?:string|null};
// Sends one template to a person on email plus the messaging channels they chose.
export async function notify(workspace:string|null,to:Recipient,name:TemplateName,vars:Record<string,string|number>){
  const lang:Lang=to.lang==='he'?'he':'en';
  const msg=template(name,vars,makeT(lang));
  let chosen:Channel[]=['email'];try{const parsed=JSON.parse(to.notify||'["email"]');if(Array.isArray(parsed))chosen=parsed.filter((c:string):c is Channel=>(channels as string[]).includes(c));}catch{}
  const jobs:Promise<boolean>[]=[];
  if(to.email&&(chosen.includes('email')||msg.always))jobs.push(sendEmail(workspace,to.email,msg.subject,msg.text,name));
  if(to.phone&&!msg.emailOnly)for(const c of chosen)if(c!=='email')jobs.push(sendText(workspace,c,to.phone,msg.short,name));
  return Promise.all(jobs);
}

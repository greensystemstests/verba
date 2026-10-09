'use client';
// Customer-service chat (spec 1.17). The same thread component is used in the floating
// chat button (visitors and customers), the customer's support page and the staff inbox.
import {useCallback,useEffect,useRef,useState} from 'react';
import {MessageCircle,X,Send,Loader2} from 'lucide-react';
import {api,json,Field} from './verba-ui';
import {useT} from './i18n';
import Captcha from './captcha';
export type ChatMessage={id:string;sender_kind:string;sender_name:string;body:string;created:string};
export type ChatConversation={id:string;name:string;email:string;subject:string;kind:string;status:string;order_id:string|null;last_message_at:string;unread?:number;preview?:string;account_id?:string|null};
export function ChatThread({id,staff=false,onLoaded}:{id:string;staff?:boolean;onLoaded?:(d:{conversation:ChatConversation;history:{id:string;reference:string;status:string;total:number;created:string}[]})=>void}){
  const {t,lang}=useT();const [messages,setMessages]=useState<ChatMessage[]>([]);const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const last=useRef('');const end=useRef<HTMLDivElement>(null);const loaded=useRef(onLoaded);useEffect(()=>{loaded.current=onLoaded;},[onLoaded]);
  const poll=useCallback(async()=>{try{const d=await api(`/api/chat/${id}?after=${encodeURIComponent(last.current)}`);const fresh=d.messages as ChatMessage[];if(fresh.length){last.current=fresh[fresh.length-1].created;setMessages(m=>[...m,...fresh.filter(f=>!m.some(x=>x.id===f.id))]);}loaded.current?.(d as never);}catch(e){setErr(t((e as Error).message));}},[id,t]);
  useEffect(()=>{void poll();const timer=setInterval(()=>{if(document.visibilityState==='visible')void poll();},4000);return ()=>clearInterval(timer);},[id,poll]);
  useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[messages.length]);
  async function send(){if(!text.trim())return;setBusy(true);setErr('');try{await api('/api/chat/'+id,json({body:text}));setText('');await poll();}catch(e){setErr(t((e as Error).message));}finally{setBusy(false);}}
  const mine=(m:ChatMessage)=>staff?m.sender_kind==='staff':m.sender_kind==='customer';
  return <div className="chat-thread"><div className="chat-messages" aria-live="polite">{messages.map(m=><div key={m.id} className={'chat-bubble '+(mine(m)?'own':'')+(m.sender_kind==='system'?' system':'')}><b>{m.sender_kind==='staff'&&!staff?t('Customer service'):m.sender_name}</b><p>{m.body}</p><time>{new Date(m.created).toLocaleTimeString(lang==='he'?'he-IL':'en-GB',{hour:'2-digit',minute:'2-digit'})}</time></div>)}<div ref={end}/></div>
    {err&&<p className="chat-error" role="alert">{err}</p>}
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><textarea aria-label={t('Message')} rows={2} value={text} maxLength={4000} placeholder={t('Write a message…')} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/><button className="button primary small" disabled={busy||!text.trim()} aria-label={t('Send')}>{busy?<Loader2 size={15} className="spin"/>:<Send size={15} className="flip-rtl"/>}</button></form></div>;
}
export function StartChat({onStarted,guest,captchaKey,orderId,subject}:{onStarted:(id:string)=>void;guest:boolean;captchaKey?:string|null;orderId?:string;subject?:string}){
  const {t}=useT();const [name,setName]=useState('');const [email,setEmail]=useState('');const [body,setBody]=useState('');const [captcha,setCaptcha]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const onToken=useCallback((v:string)=>setCaptcha(v),[]);
  return <form className="chat-start" onSubmit={async e=>{e.preventDefault();setBusy(true);setErr('');try{const r=await api('/api/chat',json({body,name,email,captcha,orderId,subject}));onStarted(String(r.id));}catch(x){setErr(t((x as Error).message));}finally{setBusy(false);}}}>
    {guest&&<><Field label={t('Your name')}><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></Field><Field label={t('Email address')}><input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></Field></>}
    <Field label={t('How can we help?')}><textarea required rows={3} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></Field>
    {guest&&<Captcha siteKey={captchaKey} onToken={onToken}/>}
    {err&&<p className="chat-error" role="alert">{err}</p>}
    <button className="button primary" disabled={busy||!body.trim()||(guest&&!!captchaKey&&!captcha)}>{busy?<Loader2 size={15} className="spin"/>:<MessageCircle size={15}/>}{t('Start chat')}</button></form>;
}
// Floating "Chat with us" button, available while filling in an order.
export default function ChatWidget(){
  const {t}=useT();const [open,setOpen]=useState(false);const [conv,setConv]=useState<string|null>(null);const [guest,setGuest]=useState(true);const [captchaKey,setCaptchaKey]=useState<string|null>(null);const [ready,setReady]=useState(false);
  useEffect(()=>{if(!open||ready)return;Promise.all([api('/api/auth/status'),api('/api/chat')]).then(([s,list])=>{setGuest(!s.user);setCaptchaKey(s.captcha);const recent=(list as unknown as ChatConversation[]).find(c=>c.status==='open');if(recent)setConv(recent.id);}).catch(()=>{}).finally(()=>setReady(true));},[open,ready]);
  return <div className={'chat-widget'+(open?' open':'')}>{open&&<div className="chat-panel" role="dialog" aria-label={t('Customer service chat')}><div className="chat-head"><div><b>{t('Customer service')}</b><small>{t('We usually reply within a few minutes during business hours.')}</small></div><button aria-label={t('Close chat')} onClick={()=>setOpen(false)}><X size={18}/></button></div>{!ready?<Loader2 className="spin chat-loading"/>:conv?<ChatThread key={conv} id={conv}/>:<StartChat guest={guest} captchaKey={captchaKey} onStarted={setConv} subject={t('Question while ordering')}/>}</div>}
    <button className="chat-fab" onClick={()=>setOpen(o=>!o)} aria-expanded={open}><MessageCircle size={20}/><span>{t('Chat with us')}</span></button></div>;
}

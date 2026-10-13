'use client';
// Customer-service chat (spec 1.17). One thread component serves the floating "Chat with us" window (visitors and
// customers), the customer's help page and the staff inbox. When the assistant is on, it answers right away and a
// person can take over at any time.
import {Fragment,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {MessageCircle,X,Send,Loader2,Sparkles,UserRound,Headset,Receipt,PackageSearch,Stamp,Truck,ArrowRight,WandSparkles} from 'lucide-react';
import {api,json,Field} from './verba-ui';
import {useT} from './i18n';
import Captcha from './captcha';
export type ChatMessage={id:string;sender_kind:string;sender_name:string;body:string;created:string};
export type ChatConversation={id:string;name:string;email:string;subject:string;kind:string;status:string;order_id:string|null;last_message_at:string;created?:string;unread?:number;preview?:string;last_sender?:string;messages?:number;account_id?:string|null;assistant?:string};
export type AssistantState={available:boolean;active:boolean;name:string};
export type ThreadData={conversation:ChatConversation;history:{id:string;reference:string;status:string;total:number;created:string}[];assistant:AssistantState};

const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
export function Avatar({kind,name,size=34}:{kind:string;name:string;size?:number}){
  return <span className={'chat-avatar kind-'+kind} style={{width:size,height:size}} aria-hidden>{kind==='assistant'?<Sparkles size={size*0.48}/>:kind==='staff'?<Headset size={size*0.48}/>:initials(name)}</span>;
}
// Links in messages: web addresses and the site's own pages (/order, /services, /studio…).
function rich(text:string){
  const parts=text.split(/(https?:\/\/[^\s)]+|(?<![\w/])\/(?:order|services|studio|account|privacy|terms)(?:\?[^\s).,]*)?)/g);
  return parts.map((p,i)=>i%2?<a key={i} href={p} target={p.startsWith('http')?'_blank':undefined} rel="noreferrer">{p}</a>:<Fragment key={i}>{p}</Fragment>);
}
function dayLabel(iso:string,lang:string,t:(s:string)=>string){
  const d=new Date(iso);const today=new Date();const y=new Date();y.setDate(today.getDate()-1);
  const same=(a:Date,b:Date)=>a.toDateString()===b.toDateString();
  return same(d,today)?t('Today'):same(d,y)?t('Yesterday'):d.toLocaleDateString(lang==='he'?'he-IL':'en-GB',{weekday:'long',day:'numeric',month:'long'});
}

export function ChatThread({id,staff=false,onLoaded,suggestions=true,greeting}:{id:string;staff?:boolean;onLoaded?:(d:ThreadData)=>void;suggestions?:boolean;greeting?:ReactNode}){
  const {t,lang}=useT();const [messages,setMessages]=useState<ChatMessage[]>([]);const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const [assistant,setAssistant]=useState<AssistantState|null>(null);const [typing,setTyping]=useState(false);const [drafting,setDrafting]=useState(false);
  const last=useRef('');const scroller=useRef<HTMLDivElement>(null);const box=useRef<HTMLTextAreaElement>(null);const loaded=useRef(onLoaded);const asked=useRef('');
  useEffect(()=>{loaded.current=onLoaded;},[onLoaded]);
  const poll=useCallback(async()=>{try{const d=await api(`/api/chat/${id}?after=${encodeURIComponent(last.current)}`) as unknown as ThreadData&{messages:ChatMessage[]};const fresh=d.messages;
    if(fresh.length){last.current=fresh[fresh.length-1].created;setMessages(m=>[...m,...fresh.filter(f=>!m.some(x=>x.id===f.id))]);}
    setAssistant(d.assistant);loaded.current?.(d);return d;}catch(e){setErr(t((e as Error).message));return null;}},[id,t]);
  // The assistant answers the customer's latest message (once per message).
  const assist=useCallback(async(body?:{handoff:true})=>{setTyping(!body);try{await api(`/api/chat/${id}/assist`,json(body||{}));}catch(e){setErr(t((e as Error).message));}finally{setTyping(false);await poll();}},[id,poll,t]);
  useEffect(()=>{void poll();const timer=setInterval(()=>{if(document.visibilityState==='visible')void poll();},4000);return ()=>clearInterval(timer);},[id,poll]);
  useEffect(()=>{if(staff||!assistant?.active||typing)return;const lastMessage=messages[messages.length-1];
    if(lastMessage?.sender_kind==='customer'&&asked.current!==lastMessage.id){asked.current=lastMessage.id;void assist();}},[messages,assistant,staff,typing,assist]);
  useEffect(()=>{const el=scroller.current;if(el)el.scrollTo({top:el.scrollHeight,behavior:'smooth'});},[messages.length,typing]);
  useEffect(()=>{const el=box.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(160,el.scrollHeight)+'px';},[text]);
  async function send(body=text){if(!body.trim())return;setBusy(true);setErr('');try{await api('/api/chat/'+id,json({body}));setText('');await poll();}catch(e){setErr(t((e as Error).message));}finally{setBusy(false);box.current?.focus();}}
  async function draft(){setDrafting(true);setErr('');try{const r=await api(`/api/chat/${id}/assist`,json({draft:true}));setText(String(r.draft||''));box.current?.focus();}catch(e){setErr(t((e as Error).message));}finally{setDrafting(false);}}
  const mine=(m:ChatMessage)=>staff?m.sender_kind==='staff':m.sender_kind==='customer';
  const label=(m:ChatMessage)=>m.sender_kind==='assistant'?(assistant?.name?t(assistant.name):t('Verba assistant')):m.sender_kind==='staff'&&!staff?`${m.sender_name} · ${t('Customer service')}`:m.sender_name;
  const lastMessage=messages[messages.length-1];
  const quick=!staff&&suggestions&&assistant?.active&&!typing&&!busy&&(!lastMessage||lastMessage.sender_kind!=='customer');
  const prompts=[t('How much does a certified translation cost?'),t('Where is my order?'),t('How does notarization work?'),t('Can you collect my documents?')];
  return <div className="chat-thread">
    <div className="chat-messages" ref={scroller} aria-live="polite">
      {greeting&&!messages.length&&<div className="chat-greeting">{greeting}</div>}
      {messages.map((m,i)=>{const prev=messages[i-1];const newDay=!prev||new Date(prev.created).toDateString()!==new Date(m.created).toDateString();const grouped=!newDay&&prev&&prev.sender_kind===m.sender_kind&&prev.sender_name===m.sender_name&&Date.parse(m.created)-Date.parse(prev.created)<5*60000;
        return <Fragment key={m.id}>{newDay&&<div className="chat-day"><span>{dayLabel(m.created,lang,t)}</span></div>}
          {m.sender_kind==='system'?<div className="chat-system" dir="auto">{t(m.body)}</div>:
          <div className={'chat-row'+(mine(m)?' own':'')+(grouped?' grouped':'')+' from-'+m.sender_kind}>
            {!mine(m)&&(grouped?<span className="chat-avatar-space"/>:<Avatar kind={m.sender_kind} name={m.sender_name}/>)}
            <div className="chat-bubble">{!grouped&&!mine(m)&&<b>{label(m)}</b>}<p dir="auto">{rich(m.body)}</p><time>{new Date(m.created).toLocaleTimeString(lang==='he'?'he-IL':'en-GB',{hour:'2-digit',minute:'2-digit'})}</time></div>
          </div>}</Fragment>;})}
      {typing&&<div className="chat-row from-assistant"><Avatar kind="assistant" name=""/><div className="chat-bubble typing" aria-label={t('The assistant is writing…')}><i/><i/><i/></div></div>}
    </div>
    {err&&<p className="chat-error" role="alert">{err}</p>}
    {quick&&<div className="chat-suggestions" aria-label={t('Suggestions')}>{prompts.map(p=><button key={p} type="button" onClick={()=>void send(p)}>{p}</button>)}<button type="button" className="to-person" onClick={()=>void assist({handoff:true})}><UserRound size={14}/>{t('Talk to a person')}</button></div>}
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send();}}>
      <textarea ref={box} aria-label={t('Message')} rows={1} value={text} maxLength={4000} placeholder={staff?t('Write a reply…'):t('Write a message…')} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/>
      <div className="chat-compose-actions">
        {staff&&assistant?.available&&<button type="button" className="chat-draft" onClick={()=>void draft()} disabled={drafting} title={t('Draft a reply with the assistant')}>{drafting?<Loader2 size={15} className="spin"/>:<WandSparkles size={15}/>}<span>{t('Draft with AI')}</span></button>}
        <button className="chat-send" disabled={busy||!text.trim()} aria-label={t('Send')}>{busy?<Loader2 size={17} className="spin"/>:<Send size={17} className="flip-rtl"/>}</button>
      </div>
    </form>
    <p className="chat-hint">{t('Enter to send · Shift + Enter for a new line')}</p>
  </div>;
}

export const topics=[
  {key:'price',icon:Receipt,title:'Prices and quotes',text:'What a translation, certificate or notarization costs.',prompt:'I would like to know the price for a translation.'},
  {key:'order',icon:PackageSearch,title:'My orders',text:'Status, delivery dates and documents.',prompt:'Can you tell me the status of my order?'},
  {key:'notary',icon:Stamp,title:'Notary and certificates',text:'Certified translations and notarial services.',prompt:'How does a notarized translation work?'},
  {key:'courier',icon:Truck,title:'Courier and delivery',text:'Collection and delivery of original documents.',prompt:'Can a courier collect and return my documents?'},
] as const;

export function StartChat({onStarted,guest,captchaKey,orderId,subject,name:greetName,variant='panel'}:{onStarted:(id:string)=>void;guest:boolean;captchaKey?:string|null;orderId?:string;subject?:string;name?:string;variant?:'panel'|'widget'}){
  const {t}=useT();const [name,setName]=useState('');const [email,setEmail]=useState('');const [body,setBody]=useState('');const [topic,setTopic]=useState<string>('');const [captcha,setCaptcha]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const onToken=useCallback((v:string)=>setCaptcha(v),[]);const input=useRef<HTMLTextAreaElement>(null);
  async function start(text=body,about=topic){if(!text.trim())return;setBusy(true);setErr('');try{const chosen=topics.find(x=>x.key===about);const r=await api('/api/chat',json({body:text,name,email,captcha,orderId,subject:subject||(chosen?t(chosen.title):undefined)}));onStarted(String(r.id));}catch(x){setErr(t((x as Error).message));}finally{setBusy(false);}}
  const ready=!guest||(name.trim().length>1&&/.+@.+\..+/.test(email)&&(!captchaKey||!!captcha));
  return <form className={'chat-start '+variant} onSubmit={e=>{e.preventDefault();void start();}}>
    <div className="chat-start-hello"><span className="chat-start-mark"><Sparkles size={22}/></span><div><h2>{greetName?t('Hi {name}, how can we help?',{name:greetName}):t('Hi, how can we help?')}</h2><p>{t('Our assistant answers right away, and a person from our team is always one click away.')}</p></div></div>
    {guest&&<div className="two-col"><Field label={t('Your name')}><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></Field><Field label={t('Email address')}><input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></Field></div>}
    <div className="topic-grid">{topics.map(x=>{const Icon=x.icon;return <button type="button" key={x.key} className={'topic-card'+(topic===x.key?' active':'')} disabled={busy} onClick={()=>{setTopic(x.key);const p=t(x.prompt);setBody(p);if(ready)void start(p,x.key);else input.current?.focus();}}><Icon size={20}/><b>{t(x.title)}</b><small>{t(x.text)}</small></button>;})}</div>
    <div className="chat-start-ask"><textarea ref={input} aria-label={t('How can we help?')} rows={2} maxLength={4000} value={body} placeholder={t('Or ask anything in your own words…')} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void start();}}}/>
      <button className="chat-send" disabled={busy||!body.trim()||!ready} aria-label={t('Start chat')}>{busy?<Loader2 size={17} className="spin"/>:<ArrowRight size={17} className="flip-rtl"/>}</button></div>
    {guest&&<Captcha siteKey={captchaKey} onToken={onToken}/>}
    {err&&<p className="chat-error" role="alert">{err}</p>}
  </form>;
}

// Floating "Chat with us" window, available on every public page and while filling in an order.
export default function ChatWidget(){
  const {t}=useT();const [open,setOpen]=useState(false);const [conv,setConv]=useState<string|null>(null);const [guest,setGuest]=useState(true);const [first,setFirst]=useState('');const [captchaKey,setCaptchaKey]=useState<string|null>(null);const [ready,setReady]=useState(false);const [assistant,setAssistant]=useState<AssistantState|null>(null);
  useEffect(()=>{if(!open||ready)return;Promise.all([api('/api/auth/status'),api('/api/chat')]).then(([s,list])=>{setGuest(!s.user);setFirst(String(s.user?.fullName||'').split(' ')[0]);setCaptchaKey(s.captcha);const recent=(list as unknown as ChatConversation[]).find(c=>c.status==='open');if(recent)setConv(recent.id);}).catch(()=>{}).finally(()=>setReady(true));},[open,ready]);
  const onLoaded=useCallback((d:ThreadData)=>setAssistant(d.assistant),[]);
  return <div className={'chat-widget'+(open?' open':'')}>{open&&<div className="chat-panel" role="dialog" aria-label={t('Customer service chat')}>
      <div className="chat-head"><Avatar kind={assistant?.active!==false?'assistant':'staff'} name="" size={38}/><div><b>{assistant?.active===false?t('Customer service'):t('Verba assistant')}</b><small><i className="online-dot"/>{assistant?.active===false?t('A person from our team will reply here'):t('Answers right away · a person can join any time')}</small></div>
        {conv&&<button className="chat-new" onClick={()=>setConv(null)}>{t('New chat')}</button>}<button aria-label={t('Close chat')} onClick={()=>setOpen(false)}><X size={18}/></button></div>
      {!ready?<Loader2 className="spin chat-loading"/>:conv?<ChatThread key={conv} id={conv} onLoaded={onLoaded}/>:<StartChat variant="widget" guest={guest} name={first} captchaKey={captchaKey} onStarted={setConv} subject={t('Question while ordering')}/>}</div>}
    <button className="chat-fab" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>{open?<X size={20}/>:<MessageCircle size={20}/>}<span>{open?t('Close'):t('Chat with us')}</span></button></div>;
}

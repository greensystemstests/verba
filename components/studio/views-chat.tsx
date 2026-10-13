'use client';
import {useCallback,useMemo,useState} from 'react';
import {Plus,Search,ArrowLeft,UserRound,Sparkles,Lock,LockOpen,Mail,FileText,MessageSquarePlus,Bot,Clock3} from 'lucide-react';
import {toast} from 'sonner';
import {Pill,api,json,date} from '../verba-ui';
import {useT} from '../i18n';
import {money} from '@/lib/catalog';
import {ChatThread,StartChat,Avatar,type ChatConversation,type ThreadData} from '../chat';
import type {WorkspaceInfo,OrderView} from './types';

const when=(iso:string,lang:string)=>{const d=new Date(iso);const now=new Date();return d.toDateString()===now.toDateString()?d.toLocaleTimeString(lang==='he'?'he-IL':'en-GB',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString(lang==='he'?'he-IL':'en-GB',{day:'numeric',month:'short'});};
const waiting=(c:ChatConversation)=>c.status==='open'&&c.last_sender==='customer'&&c.assistant!=='on';
function ConversationItem({c,active,onClick,staff}:{c:ChatConversation;active:boolean;onClick:()=>void;staff?:boolean}){
  const {t,lang}=useT();
  const who=c.last_sender==='assistant'?t('Assistant')+': ':c.last_sender==='staff'?(staff?t('You')+': ':t('Team')+': '):c.last_sender==='customer'&&!staff?t('You')+': ':'';
  return <button className={'convo'+(active?' active':'')+(Number(c.unread)>0?' unread':'')} onClick={onClick}>
    <Avatar kind={staff?'customer':c.assistant==='on'?'assistant':'staff'} name={staff?c.name:''} size={38}/>
    <span className="convo-main"><span className="convo-top"><b dir="auto">{staff?c.name:t(c.subject||'Customer service')}</b><time>{when(c.last_message_at,lang)}</time></span>
      <span className="convo-preview" dir="auto">{who}{c.preview||(staff?c.subject:'')}</span>
      <span className="convo-tags">{c.status==='closed'?<em className="tag muted">{t('Closed')}</em>:staff&&waiting(c)?<em className="tag warn"><Clock3 size={11}/>{t('Waiting for a person')}</em>:staff&&c.assistant==='on'?<em className="tag ai"><Sparkles size={11}/>{t('Assistant')}</em>:null}{staff&&!c.account_id&&<em className="tag">{t('Visitor')}</em>}{staff&&c.subject&&<em className="tag subtle">{t(c.subject)}</em>}</span></span>
    {Number(c.unread)>0&&<span className="convo-badge">{c.unread}</span>}
  </button>;
}

// Customer's help page: conversations on the left, the chat in the middle, their orders on the right.
export function SupportView({ws,conversations,orders,reload,open}:{ws:WorkspaceInfo;conversations:ChatConversation[];orders:OrderView[];reload:()=>void;open:(id:string)=>void}){
  const {t}=useT();const [sel,setSel]=useState<string|null>(conversations.find(c=>c.status==='open')?.id||null);const [about,setAbout]=useState<OrderView|null>(null);const [data,setData]=useState<ThreadData|null>(null);
  const creating=!sel;const current=conversations.find(c=>c.id===sel);
  const onLoaded=useCallback((d:ThreadData)=>setData(d),[]);
  const startNew=(o:OrderView|null=null)=>{setSel(null);setAbout(o);setData(null);};
  const active=data?.assistant.active;
  return <div className={'help-desk'+(sel?' has-thread':'')}>
    <aside className="help-list"><div className="help-list-head"><b>{t('Conversations')}</b><button className="icon-button" onClick={()=>startNew()} aria-label={t('New conversation')} title={t('New conversation')}><Plus size={17}/></button></div>
      <button className={'convo new'+(creating?' active':'')} onClick={()=>startNew()}><span className="convo-plus"><MessageSquarePlus size={18}/></span><span className="convo-main"><b>{t('New conversation')}</b><span className="convo-preview">{t('Ask about prices, orders or documents')}</span></span></button>
      {conversations.map(c=><ConversationItem key={c.id} c={c} active={sel===c.id} onClick={()=>{setSel(c.id);setData(null);}}/>)}</aside>
    <section className="help-thread">
      {creating?<StartChat guest={false} name={ws.user.firstName||ws.user.name.split(' ')[0]} orderId={about?.id} subject={about?t('Order {reference}',{reference:about.reference}):undefined} onStarted={id=>{setSel(id);setAbout(null);reload();}}/>:
      <><header className="thread-head"><button className="icon-button mobile-back" onClick={()=>setSel(null)} aria-label={t('Back')}><ArrowLeft size={17} className="flip-rtl"/></button>
          <Avatar kind={active?'assistant':'staff'} name="" size={40}/><div className="thread-title"><b>{t(current?.subject||'Customer service')}</b><small>{current?.status==='closed'?t('This conversation is closed. Write to reopen it.'):active?<><i className="online-dot"/>{t('Verba assistant answers right away · a person can join any time')}</>:<><i className="online-dot human"/>{t('A person from our team is handling this conversation')}</>}</small></div>
          {active&&<button className="button secondary small" onClick={async()=>{try{await api(`/api/chat/${sel}/assist`,json({handoff:true}));toast.success(t('A member of our team will continue here.'));reload();}catch(e){toast.error(t((e as Error).message));}}}><UserRound size={15}/>{t('Talk to a person')}</button>}</header>
        <ChatThread key={sel} id={sel!} onLoaded={onLoaded}/></>}
    </section>
    <aside className="help-side">
      <div className="side-card"><h3>{t('Your orders')}</h3>{orders.length?<ul className="side-orders">{orders.slice(0,6).map(o=><li key={o.id}><button onClick={()=>open(o.id)}><b>{o.reference}</b><span>{t(o.payload.service)}</span></button><Pill tone={o.status}>{o.status}</Pill><button className="text-link" onClick={()=>startNew(o)}>{t('Ask about it')}</button></li>)}</ul>:<p className="muted">{t('No orders yet.')}</p>}</div>
      <div className="side-card soft"><h3>{t('Good to know')}</h3><ul className="side-facts"><li><Sparkles size={15}/>{t('The assistant knows our services, prices and your orders.')}</li><li><UserRound size={15}/>{t('Ask for a person at any time; we reply by email too.')}</li><li><Mail size={15}/>{ws.user.email}</li></ul><a className="button primary small" href="/studio?view=new"><Plus size={15}/>{t('Create a new order')}</a></div>
    </aside>
  </div>;
}

type Filter='waiting'|'assistant'|'open'|'closed';
// Staff inbox: every conversation, the chat, and the customer's details and booking history.
export function InboxView({ws,conversations,reload,initial,open}:{ws:WorkspaceInfo;conversations:ChatConversation[];reload:()=>void;initial?:string|null;open:(id:string)=>void}){
  const {t,lang}=useT();const [sel,setSel]=useState<string|null>(initial||null);const [filter,setFilter]=useState<Filter>('open');const [q,setQ]=useState('');const [data,setData]=useState<ThreadData|null>(null);
  const counts=useMemo(()=>({waiting:conversations.filter(waiting).length,assistant:conversations.filter(c=>c.status==='open'&&c.assistant==='on').length,open:conversations.filter(c=>c.status==='open').length,closed:conversations.filter(c=>c.status==='closed').length}),[conversations]);
  const list=conversations.filter(c=>filter==='waiting'?waiting(c):filter==='assistant'?c.status==='open'&&c.assistant==='on':c.status===filter).filter(c=>!q||[c.name,c.email,c.subject,c.preview].some(v=>String(v||'').toLowerCase().includes(q.toLowerCase())));
  const conv=conversations.find(c=>c.id===sel);const onLoaded=useCallback((d:ThreadData)=>setData(d),[]);
  async function patch(body:Record<string,unknown>,done:string){if(!conv)return;try{await api('/api/chat/'+conv.id,json(body,'PATCH'));toast.success(t(done));reload();}catch(e){toast.error(t((e as Error).message));}}
  const assistantOn=(data?.conversation.assistant??conv?.assistant)==='on';
  const tabs:[Filter,string][]=[['waiting','Waiting'],['assistant','Assistant'],['open','All open'],['closed','Closed']];
  return <div className={'help-desk staff'+(sel?' has-thread':'')}>
    <aside className="help-list"><div className="help-search"><Search size={15}/><input aria-label={t('Search')} placeholder={t('Search conversations…')} value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div className="seg" role="tablist">{tabs.map(([k,l])=><button key={k} role="tab" aria-selected={filter===k} onClick={()=>setFilter(k)}>{t(l)}<span>{counts[k]}</span></button>)}</div>
      {list.length?list.map(c=><ConversationItem key={c.id} c={c} staff active={sel===c.id} onClick={()=>{setSel(c.id);setData(null);}}/>):<p className="help-empty">{filter==='waiting'?t('Nobody is waiting for a person.'):t('No conversations')}</p>}</aside>
    <section className="help-thread">{conv?<><header className="thread-head"><button className="icon-button mobile-back" onClick={()=>setSel(null)} aria-label={t('Back')}><ArrowLeft size={17} className="flip-rtl"/></button>
        <Avatar kind="customer" name={conv.name} size={40}/><div className="thread-title"><b>{conv.name}</b><small>{conv.email}{conv.subject?` · ${t(conv.subject)}`:''}</small></div>
        <div className="thread-actions">{data?.assistant.available&&<button className={'assistant-toggle'+(assistantOn?' on':'')} onClick={()=>void patch({assistant:assistantOn?'human':'on'},assistantOn?'You are handling this conversation':'The assistant will answer the next message')} title={t('Assistant answers this conversation')}><Bot size={15}/>{assistantOn?t('Assistant on'):t('Assistant off')}</button>}
          <button className="button secondary small" onClick={()=>void patch({status:conv.status==='open'?'closed':'open'},conv.status==='open'?'Conversation closed':'Conversation reopened')}>{conv.status==='open'?<><Lock size={14}/>{t('Close')}</>:<><LockOpen size={14}/>{t('Reopen')}</>}</button></div></header>
      <ChatThread key={conv.id} id={conv.id} staff onLoaded={onLoaded}/></>:
      <div className="help-placeholder"><span><MessageSquarePlus size={28}/></span><h3>{t('Choose a conversation')}</h3><p>{counts.waiting?t('{n} customers are waiting for a person.',{n:counts.waiting}):t('The assistant answers new questions. Conversations that need a person appear under Waiting.')}</p></div>}</section>
    <aside className="help-side">{conv?<>
      <div className="side-card"><div className="side-person"><Avatar kind="customer" name={conv.name} size={46}/><div><b>{conv.name}</b><small>{conv.email}</small></div></div>
        <dl className="side-facts-list"><dt>{t('Type')}</dt><dd>{conv.account_id?t('Customer account'):t('Visitor')}</dd><dt>{t('Started')}</dt><dd>{date(conv.created||conv.last_message_at,lang)}</dd><dt>{t('Last message')}</dt><dd>{when(conv.last_message_at,lang)}</dd><dt>{t('Handled by')}</dt><dd>{assistantOn?t('Assistant'):t('Team')}</dd></dl>
        {conv.email&&<a className="button secondary small" href={`mailto:${conv.email}`}><Mail size={14}/>{t('Email')}</a>}</div>
      <div className="side-card"><h3>{t('Booking history')}</h3>{data?.history.length?<ul className="side-orders">{data.history.map(h=><li key={h.id}><button onClick={()=>open(h.id)}><b>{h.reference}</b><span>{money(h.total,'EUR',ws.pricing,lang)}</span></button><Pill tone={h.status}>{h.status}</Pill></li>)}</ul>:<p className="muted">{conv.account_id?t('No orders yet.'):t('Visitor without an account.')}</p>}
        {conv.order_id&&<button className="text-link" onClick={()=>open(conv.order_id!)}><FileText size={14}/>{t('Open the order of this conversation')}</button>}</div></>:
      <div className="side-card soft"><h3>{t('How the inbox works')}</h3><ul className="side-facts"><li><Sparkles size={15}/>{t('The assistant answers with your prices, services and the customer’s orders.')}</li><li><Clock3 size={15}/>{t('When a customer asks for a person, the conversation moves to Waiting and you get an email.')}</li><li><UserRound size={15}/>{t('Replying yourself turns the assistant off for that conversation.')}</li></ul></div>}</aside>
  </div>;
}

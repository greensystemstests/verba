'use client';
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {toast} from 'sonner';
import {Pill,Empty,api,json,date} from '../verba-ui';
import {useT} from '../i18n';
import {money} from '@/lib/catalog';
import {ChatThread,StartChat,type ChatConversation} from '../chat';
import type {WorkspaceInfo} from './types';
// Staff inbox: every customer conversation, with the customer's order history beside it.
export function InboxView({ws,conversations,reload,initial,open}:{ws:WorkspaceInfo;conversations:ChatConversation[];reload:()=>void;initial?:string|null;open:(id:string)=>void}){
  const {t,lang}=useT();const [sel,setSel]=useState<string|null>(initial||null);const [filter,setFilter]=useState<'open'|'closed'>('open');const [history,setHistory]=useState<{id:string;reference:string;status:string;total:number;created:string}[]>([]);
  const list=conversations.filter(c=>c.status===filter);const conv=conversations.find(c=>c.id===sel);
  return <div className="inbox"><section className="panel inbox-list"><div className="inbox-tabs" role="tablist">{(['open','closed'] as const).map(f=><button key={f} role="tab" aria-selected={filter===f} onClick={()=>setFilter(f)}>{f==='open'?t('Open'):t('Closed')} ({conversations.filter(c=>c.status===f).length})</button>)}</div>
    {list.length?list.map(c=><button key={c.id} className={'inbox-item'+(sel===c.id?' active':'')} onClick={()=>setSel(c.id)}><div><b>{c.name}</b>{(c.unread||0)>0&&<span className="badge">{c.unread}</span>}</div><small>{c.kind==='inquiry'?t('Additional services')+': ':''}{c.subject}</small><p>{c.preview}</p><time>{date(c.last_message_at,lang)}</time></button>):<Empty title={t('No conversations')} text={t('Messages from customers appear here.')}/>}</section>
    <section className="panel inbox-thread">{conv?<><div className="panel-heading"><div><h2>{conv.name}</h2><p className="muted">{conv.email} · {conv.subject}</p></div><button className="button secondary small" onClick={async()=>{try{await api('/api/chat/'+conv.id,json({status:conv.status==='open'?'closed':'open'},'PATCH'));reload();}catch(e){toast.error(t((e as Error).message));}}}>{conv.status==='open'?t('Close conversation'):t('Reopen')}</button></div>
      <ChatThread key={conv.id} id={conv.id} staff onLoaded={d=>{setHistory(d.history);}}/>
      <h3 className="sub-heading">{t('Booking history')}</h3>{history.length?<div className="chip-list">{history.map(h=><button key={h.id} className="chip" onClick={()=>open(h.id)}>{h.reference} · {t(h.status)} · {money(h.total,'EUR',ws.pricing,lang)}</button>)}</div>:<p className="muted">{conv.account_id?t('No orders yet.'):t('Visitor without an account.')}</p>}</>:<Empty title={t('Choose a conversation')} text={t('Select a conversation to read and reply.')}/>}</section></div>;
}
// Customer's support page: their conversations and a way to start a new one.
export function SupportView({conversations,reload}:{conversations:ChatConversation[];reload:()=>void}){
  const {t,lang}=useT();const [sel,setSel]=useState<string|null>(conversations[0]?.id||null);const [creating,setCreating]=useState(!conversations.length);
  return <div className="inbox"><section className="panel inbox-list"><button className="button primary small" onClick={()=>{setCreating(true);setSel(null);}}><Plus size={15}/>{t('New conversation')}</button>
    {conversations.map(c=><button key={c.id} className={'inbox-item'+(sel===c.id?' active':'')} onClick={()=>{setSel(c.id);setCreating(false);}}><div><b>{c.subject}</b>{(c.unread||0)>0&&<span className="badge">{c.unread}</span>}</div><small>{date(c.last_message_at,lang)}</small><Pill>{c.status==='open'?'Open':'Closed'}</Pill></button>)}</section>
    <section className="panel inbox-thread">{creating?<><h2>{t('Contact customer service')}</h2><p className="muted">{t('Ask about an order, a price or anything else. You can mention your order number.')}</p><StartChat guest={false} onStarted={id=>{setSel(id);setCreating(false);reload();}}/></>:sel?<ChatThread key={sel} id={sel}/>:<Empty title={t('Choose a conversation')} text={t('Select a conversation to read and reply.')}/>}</section></div>;
}

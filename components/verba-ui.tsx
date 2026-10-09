'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import {Globe2,Stethoscope,Scale,ChartNoAxesCombined,Code2,Megaphone,FileText,BookOpen,type LucideIcon} from 'lucide-react';
import type {ReactNode} from 'react';
import {appHref,siteHref} from '@/lib/links';
import {useT,LanguageSwitch} from './i18n';
export const sectorIcons:Record<string,LucideIcon>={General:BookOpen,Medical:Stethoscope,Legal:Scale,Finance:ChartNoAxesCombined,Technology:Code2,Marketing:Megaphone};
export function Brand(){const {t}=useT();return <a className="brand" href={siteHref('/')||'/'} aria-label={t('Verba home')}><span className="brand-symbol"><Globe2 size={22}/></span>verba<span className="brand-period">.</span></a>;}
export function Header(){const {t}=useT();return <header className="site-header"><div className="header-inner"><Brand/><nav aria-label={t('Main navigation')}><a href={appHref('/')||'/'}>{t('Translate')}</a><a href={appHref('/order')}>{t('Specialist services')}</a><a href={siteHref('/services')+'#process'}>{t('How it works')}</a><a href={appHref('/studio')} className="nav-account">{t('My workspace')}</a><LanguageSwitch/></nav></div></header>;}
export function Footer(){const {t}=useT();return <footer className="site-footer"><Brand/><span>{t('Meaning, without borders.')}</span><div><a href={siteHref('/privacy')}>{t('Privacy')}</a><a href={siteHref('/terms')}>{t('Service terms')}</a></div></footer>;}
export type Option={label:string;value:string};
export function Pick({label,value,onChange,options,disabled=false,hideLabel=false}: {label:string,value:string,onChange:(v:string)=>void,options:readonly string[]|Option[],disabled?:boolean,hideLabel?:boolean}){return <div className="field">{!hideLabel&&<span className="field-label">{label}</span>}<Select value={value} onValueChange={v=>v!==null&&onChange(String(v))} disabled={disabled}><SelectTrigger aria-label={label} className="verba-select"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</SelectItem>)}</SelectContent></Select></div>;}
export function Field({label,children,hint}: {label:string,children:ReactNode,hint?:string}){return <label className="field"><span className="field-label">{label}{hint&&<span className="field-hint" title={hint} aria-label={hint}>?</span>}</span>{children}</label>;}
export function CheckField({label,checked,onChange,children,disabled}:{label:string,checked:boolean,onChange:(b:boolean)=>void,children?:ReactNode,disabled?:boolean}){return <label className="check-field"><Checkbox checked={checked} disabled={disabled} onCheckedChange={v=>onChange(v===true)}/><span><strong>{label}</strong>{children&&<small>{children}</small>}</span></label>;}
export function YesNo({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){const {t}=useT();return <div className="yes-no" role="radiogroup" aria-label={label}><span>{label}</span><button type="button" role="radio" aria-checked={value} className={value?'on':''} onClick={()=>onChange(true)}>{t('Yes')}</button><button type="button" role="radio" aria-checked={!value} className={!value?'on':''} onClick={()=>onChange(false)}>{t('No')}</button></div>;}
export function Pill({children,tone}:{children:ReactNode;tone?:string}){const {t}=useT();const text=typeof children==='string'?t(children):children;return <span className={'pill status-'+String(tone||children).toLowerCase().replaceAll(' ','-')}>{text}</span>;}
export function Empty({title,text,action}:{title:string,text:string,action?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><FileText size={26}/></span><h3>{title}</h3><p>{text}</p>{action}</div>;}
// JSON responses are typed by the caller (api<MyType>(…)); untyped calls get a loose record.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- default for callers that read a few fields
export async function api<T=Record<string,any>>(url:string,options:RequestInit={}):Promise<T>{const r=await fetch(url,options);let b:{error?:string}={};try{b=await r.json();}catch{if(!r.ok)throw new Error(r.status===413?'The file is too large.':'Something went wrong. Please try again.');}if(!r.ok)throw new Error(b.error||'Something went wrong. Please try again.');return b as T;}
export const json=(data:unknown,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export function download(content:BlobPart,name:string,type='text/plain'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export async function downloadFrom(url:string,name:string,init?:RequestInit){const r=await fetch(url,init);if(!r.ok){let m='Something went wrong. Please try again.';try{m=(await r.json()).error||m;}catch{}throw new Error(m);}download(await r.blob(),name,r.headers.get('content-type')||'application/octet-stream');}
export type UploadResult={id:string;name:string;size:number;stats:{words:number;pages:number}|null};
// Files over 3 MB are sent in pieces so each request stays within hosting limits.
export async function uploadFile(file:File,opts:{orderId?:string;purpose?:string}={}):Promise<UploadResult>{
  const CHUNK=3*1024*1024;
  if(file.size>10*1024*1024)throw new Error('Maximum file size is 10 MB');
  if(file.size<=CHUNK){const fd=new FormData();fd.set('file',file);if(opts.orderId)fd.set('orderId',opts.orderId);if(opts.purpose)fd.set('purpose',opts.purpose);return await api('/api/files',{method:'POST',body:fd}) as UploadResult;}
  const id=crypto.randomUUID();const count=Math.ceil(file.size/CHUNK);let last:Record<string,unknown>={};
  for(let i=0;i<count;i++){last=await api('/api/files/chunk',{method:'POST',headers:{'x-upload-id':id,'x-chunk-index':String(i),'x-chunk-count':String(count),'x-file-name':encodeURIComponent(file.name),'x-file-size':String(file.size),...(opts.orderId?{'x-order-id':opts.orderId}:{}),...(opts.purpose?{'x-purpose':opts.purpose}:{}),'Content-Type':'application/octet-stream'},body:file.slice(i*CHUNK,(i+1)*CHUNK)});}
  return last as UploadResult;
}
export function date(s:string|null|undefined,lang='en'){if(!s)return '—';const d=new Date(s.length===10?s+'T12:00:00Z':s);return isNaN(d.getTime())?'—':new Intl.DateTimeFormat(lang==='he'?'he-IL':'en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d);}

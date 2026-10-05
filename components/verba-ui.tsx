'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import {Globe2,Stethoscope,Scale,ChartNoAxesCombined,Code2,Megaphone,Check,FileText} from 'lucide-react';
import type {ReactNode} from 'react';
export const sectorIcons:any={Medical:Stethoscope,Legal:Scale,Finance:ChartNoAxesCombined,Technology:Code2,Marketing:Megaphone};
export function Brand(){return <a className="brand" href="/" aria-label="Verba home"><span className="brand-symbol"><Globe2 size={22}/></span>verba<span className="brand-period">.</span></a>;}
export function Header(){return <header className="site-header"><div className="header-inner"><Brand/><nav aria-label="Main navigation"><a href="/">Translate</a><a href="/order">Specialist services</a><a href="/services#process">How it works</a><a href="/studio" className="nav-account">My workspace</a></nav></div></header>;}
export function Footer(){return <footer className="site-footer"><Brand/><span>Meaning, without borders.</span><div><a href="/privacy">Privacy</a><a href="/terms">Service terms</a></div></footer>;}
export function Pick({label,value,onChange,options,disabled=false}: {label:string,value:string,onChange:(v:string)=>void,options:readonly string[]|{label:string,value:string}[],disabled?:boolean}){return <div className="field"><span className="field-label">{label}</span><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="verba-select"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</SelectItem>)}</SelectContent></Select></div>;}
export function Field({label,children}: {label:string,children:ReactNode}){return <label className="field"><span className="field-label">{label}</span>{children}</label>;}
export function CheckField({label,checked,onChange,children}:{label:string,checked:boolean,onChange:(b:boolean)=>void,children?:ReactNode}){return <label className="check-field"><Checkbox checked={checked} onCheckedChange={v=>onChange(v===true)}/><span><strong>{label}</strong>{children&&<small>{children}</small>}</span></label>;}
export function Pill({children}:{children:ReactNode}){return <span className={'pill status-'+String(children).toLowerCase().replaceAll(' ','-')}>{children}</span>;}
export function Empty({title,text,action}:{title:string,text:string,action?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><FileText size={26}/></span><h3>{title}</h3><p>{text}</p>{action}</div>;}
export async function api(url:string,options:RequestInit={}){const r=await fetch(url,options);const b:any=await r.json();if(!r.ok)throw new Error(b.error||'Something went wrong. Please try again.');return b;}
export const json=(data:unknown,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export function Download({text,name}:{text:string,name:string}){return <button className="button secondary small" onClick={()=>download(text,name)}>Download summary</button>;}
export function download(text:string,name:string,type='text/plain'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

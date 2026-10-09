'use client';
import {useEffect,useRef} from 'react';
import {useT} from './i18n';
type Turnstile={render:(el:HTMLElement,o:Record<string,unknown>)=>string;remove:(id:string)=>void;reset:(id:string)=>void};
declare global{interface Window{turnstile?:Turnstile}}
let loading:Promise<void>|null=null;
function load(){if(window.turnstile)return Promise.resolve();loading??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>resolve();s.onerror=()=>{loading=null;reject(new Error('Security check failed to load'));};document.head.appendChild(s);});return loading;}
// Cloudflare Turnstile check; renders nothing when the site has no captcha key configured.
export default function Captcha({siteKey,onToken}:{siteKey:string|null|undefined;onToken:(t:string)=>void}){
  const box=useRef<HTMLDivElement>(null);const {lang}=useT();
  useEffect(()=>{if(!siteKey||!box.current)return;let id:string|null=null;let alive=true;
    load().then(()=>{if(alive&&box.current&&window.turnstile)id=window.turnstile.render(box.current,{sitekey:siteKey,language:lang,callback:(t:string)=>onToken(t),'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')});}).catch(()=>{});
    return ()=>{alive=false;if(id&&window.turnstile)window.turnstile.remove(id);};},[siteKey,lang,onToken]);
  return siteKey?<div className="captcha" ref={box}/>:null;
}

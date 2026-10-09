'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {LANGS,LANG_COOKIE,makeT,isLang,dirOf,type Lang,type Overrides,type T} from '@/lib/i18n/core';
type Ctx={lang:Lang;t:T;dir:'ltr'|'rtl';setLang:(l:Lang)=>void};
const I18n=createContext<Ctx>({lang:'en',t:makeT('en'),dir:'ltr',setLang:()=>{}});
function cookieLang(){const m=typeof document!=='undefined'?document.cookie.match(new RegExp('(?:^|; )'+LANG_COOKIE+'=(\\w+)')):null;return m&&isLang(m[1])?m[1]:null;}
export function setLangCookie(l:Lang){document.cookie=`${LANG_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;}
// detect: used by the static GitHub Pages build, where the server cannot read the cookie.
export function I18nProvider({lang:initial,overrides,detect=false,children}:{lang:Lang;overrides?:Overrides;detect?:boolean;children:ReactNode}){
  const [lang,setLangState]=useState<Lang>(initial);
  // The static pages cannot read the language cookie on the server, so they switch after loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state read once on load
  useEffect(()=>{if(!detect)return;const c=cookieLang()||(navigator.language.startsWith('he')?'he':null);if(c&&c!==lang){setLangState(c);document.documentElement.lang=c;document.documentElement.dir=dirOf(c);}},[detect,lang]);
  const value=useMemo<Ctx>(()=>({lang,dir:dirOf(lang),t:makeT(lang,lang===initial?overrides:undefined),setLang:(l:Lang)=>{setLangCookie(l);if(detect){setLangState(l);document.documentElement.lang=l;document.documentElement.dir=dirOf(l);}else location.reload();}}),[lang,initial,overrides,detect]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useT=()=>useContext(I18n);
export function LanguageSwitch({className=''}:{className?:string}){
  const {lang,setLang}=useT();
  return <div className={'language-switch '+className} role="group" aria-label="Language / שפה">{LANGS.map(l=><button key={l.code} type="button" lang={l.code} aria-pressed={lang===l.code} onClick={()=>lang!==l.code&&setLang(l.code)}>{l.label}</button>)}</div>;
}

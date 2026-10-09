// Interface languages. Texts are keyed by their English wording; a missing
// translation falls back to English. Administrators can override any text per
// language (Settings → Languages), stored in ui_texts.
import {he} from './he.ts';
export type Lang='en'|'he';
export const LANGS:{code:Lang;label:string;dir:'ltr'|'rtl'}[]=[{code:'en',label:'English',dir:'ltr'},{code:'he',label:'עברית',dir:'rtl'}];
export const LANG_COOKIE='verba_lang';
export const dictionaries:Record<Lang,Record<string,string>>={en:{},he};
export type Overrides=Record<string,string>;
export const isLang=(v:unknown):v is Lang=>v==='en'||v==='he';
export const dirOf=(lang:Lang)=>lang==='he'?'rtl':'ltr';
export function translate(lang:Lang,text:string,vars?:Record<string,string|number>,overrides?:Overrides){
  const out=overrides?.[text]??dictionaries[lang][text]??text;
  return vars?out.replace(/\{(\w+)\}/g,(m,k)=>k in vars?String(vars[k]):m):out;
}
export type T=(text:string,vars?:Record<string,string|number>)=>string;
export const makeT=(lang:Lang,overrides?:Overrides):T=>(text,vars)=>translate(lang,text,vars,overrides);
// Picks a language from a cookie value, then from an Accept-Language header.
export function pickLang(cookie?:string|null,accept?:string|null):Lang{
  if(isLang(cookie))return cookie;
  const first=(accept||'').split(',').map(s=>s.trim().slice(0,2).toLowerCase()).find(s=>s==='he'||s==='iw'||s==='en');
  return first==='he'||first==='iw'?'he':'en';
}

import {cookies,headers} from 'next/headers';
import {db} from './runtime';
import {LANG_COOKIE,pickLang,makeT,type Lang,type Overrides} from './i18n/core';
export async function getLang():Promise<Lang>{
  const [c,h]=await Promise.all([cookies(),headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value,h.get('accept-language'));
}
type Cache={at:number;data:Record<string,Overrides>};
const g=globalThis as unknown as {__verbaTexts?:Cache};
// Administrator text overrides, cached for a minute per server instance.
export async function textOverrides(lang:Lang):Promise<Overrides>{
  if(g.__verbaTexts&&Date.now()-g.__verbaTexts.at<60000)return g.__verbaTexts.data[lang]||{};
  try{
    const rows=(await db().prepare('SELECT lang,source,value FROM ui_texts').all<{lang:string;source:string;value:string}>()).results;
    const data:Record<string,Overrides>={};
    for(const r of rows)(data[r.lang]||={})[r.source]=r.value;
    g.__verbaTexts={at:Date.now(),data};
    return data[lang]||{};
  }catch{return {};}
}
export function clearTextCache(){g.__verbaTexts=undefined;}
export async function serverT(lang?:Lang){const l=lang||await getLang();return makeT(l,await textOverrides(l));}

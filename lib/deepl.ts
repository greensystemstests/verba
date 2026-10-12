import {runtime,HttpError} from './server';
// DeepL translation client (https://developers.deepl.com). Keys ending in ":fx" belong to the
// Free plan and use the api-free host. The API key never leaves the server.
// Note: DeepL's Free plan may use submitted text to improve its service; only the Pro plan
// deletes texts after translation. Use a Pro key for confidential documents.
export const providerName='DeepL';
export const deeplReady=()=>!!runtime().DEEPL_API_KEY;
const host=(key:string)=>key.endsWith(':fx')?'https://api-free.deepl.com':'https://api.deepl.com';

// Verba language -> DeepL code. Targets that have variants name one; glossaries use the base code.
const SOURCE:Record<string,string>={English:'EN',Hebrew:'HE',Arabic:'AR',French:'FR',German:'DE',Spanish:'ES',Italian:'IT',Portuguese:'PT',Russian:'RU',Bulgarian:'BG',Ukrainian:'UK',Chinese:'ZH',Japanese:'JA'};
const TARGET:Record<string,string>={...SOURCE,English:'EN-US',Portuguese:'PT-PT'};
export const sourceCode=(language:string)=>SOURCE[language]||language.slice(0,2).toUpperCase();
export const targetCode=(language:string)=>TARGET[language]||sourceCode(language);

async function call<T>(path:string,{method='GET',body,timeout=25000}:{method?:string;body?:unknown;timeout?:number}={}):Promise<T>{
  const key=runtime().DEEPL_API_KEY;
  if(!key)throw new HttpError(503,'Translation is not connected yet. The workspace owner needs to configure the translation provider.');
  let response:Response;
  try{response=await fetch(host(key)+path,{method,headers:{Authorization:`DeepL-Auth-Key ${key}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});}
  catch{throw new HttpError(504,'The translation service did not respond in time. Your source is saved. Retry the current step.');}
  if(!response.ok){
    let detail='';try{detail=String((await response.json() as {message?:string}).message||'');}catch{}
    if(response.status===401||response.status===403)throw new HttpError(503,'The translation connection needs attention. Ask the owner to check the DeepL API key.');
    if(response.status===456)throw new HttpError(429,'The DeepL character quota for this key has been used. Add credit or wait for the monthly reset.');
    if(response.status===429)throw new HttpError(429,'DeepL is receiving too many requests. Wait a moment and retry the step.');
    if(response.status===413)throw new HttpError(413,'This section is too large for the translation provider. Split the document into smaller parts.');
    if(response.status===400&&/lang/i.test(detail))throw new HttpError(422,'DeepL does not translate this language pair yet. Choose different languages.');
    if(response.status===400)throw new HttpError(422,'The translation provider rejected this text. Check the source and retry.');
    throw new HttpError(502,'The translation provider could not complete this step. No result has been marked complete.');
  }
  if(response.status===204)return undefined as T;
  try{return await response.json() as T;}catch{throw new HttpError(502,'The provider returned an invalid response. Retry the current step.');}
}

// Tone has no direct DeepL setting. Natural and brand voice ask for a less formal register
// where the target language supports it ("prefer_" falls back silently where it does not).
const formalityFor=(tone:string)=>tone==='Faithful'?undefined:'prefer_less';

export type TranslateOptions={source:string;target:string;sector:string;tone:string;glossaryId?:string|null};
// Translates each text separately and returns the results in the same order, plus billed characters.
export async function translateTexts(texts:string[],o:TranslateOptions):Promise<{texts:string[];billed:number}>{
  const out:string[]=[];let billed=0;
  for(let i=0;i<texts.length;i+=50){
    const part=texts.slice(i,i+50);
    const r=await call<{translations:{text:string;billed_characters?:number}[]}>('/v2/translate',{method:'POST',body:{
      text:part,source_lang:sourceCode(o.source),target_lang:targetCode(o.target),
      preserve_formatting:true,model_type:'prefer_quality_optimized',show_billed_characters:true,
      context:`Professional ${o.sector.toLowerCase()} document. Translate faithfully and completely.`,
      ...(formalityFor(o.tone)?{formality:formalityFor(o.tone)}:{}),...(o.glossaryId?{glossary_id:o.glossaryId}:{}),
    }});
    if(!Array.isArray(r?.translations)||r.translations.length!==part.length)throw new HttpError(502,'The provider returned an invalid translation structure. Retry this step.');
    for(const t of r.translations){out.push(t.text);billed+=t.billed_characters||0;}
  }
  return {texts:out,billed};
}

const clean=(s:string)=>s.replace(/[\t\r\n]+/g,' ').trim();
// Creates a DeepL glossary for one job. Returns null when the pair has no glossary support,
// so the translation still runs (missing required terms are then flagged by the quality checks).
export async function createGlossary(name:string,source:string,target:string,terms:{source_term:string;target_term:string}[]):Promise<string|null>{
  const seen=new Set<string>();const rows:string[]=[];
  for(const t of terms){const a=clean(t.source_term),b=clean(t.target_term);if(!a||!b||seen.has(a.toLowerCase()))continue;seen.add(a.toLowerCase());rows.push(`${a}\t${b}`);}
  if(!rows.length)return null;
  try{const r=await call<{glossary_id?:string}>('/v2/glossaries',{method:'POST',body:{name:name.slice(0,100),source_lang:sourceCode(source),target_lang:sourceCode(target),entries:rows.join('\n'),entries_format:'tsv'}});return r?.glossary_id||null;}
  catch(e){if(e instanceof HttpError&&[422,502].includes(e.status))return null;throw e;}
}
export async function deleteGlossary(id:string){try{await call<void>('/v2/glossaries/'+encodeURIComponent(id),{method:'DELETE',timeout:10000});}catch{/* the glossary is only a per-job helper */}}

// Character usage for the connection check.
export async function usage(){const r=await call<{character_count?:number;character_limit?:number}>('/v2/usage',{timeout:15000});return {used:Number(r?.character_count||0),limit:Number(r?.character_limit||0)};}

// Which of Verba's languages DeepL cannot translate from / to right now (null if the list is unavailable).
let languageCache:{at:number;value:{source:string[];target:string[]}|null}|null=null;
export async function unsupportedLanguages(all:readonly string[]){
  if(!languageCache||Date.now()-languageCache.at>3600_000){
    try{const [s,t]=await Promise.all([call<{language:string}[]>('/v2/languages?type=source',{timeout:10000}),call<{language:string}[]>('/v2/languages?type=target',{timeout:10000})]);
      const base=(c:string)=>c.toUpperCase().split('-')[0];
      languageCache={at:Date.now(),value:{source:[...new Set(s.map(x=>base(x.language)))],target:[...new Set(t.map(x=>base(x.language)))]}};}
    catch{languageCache={at:Date.now()-3300_000,value:null};}
  }
  const v=languageCache.value;if(!v)return null;
  return all.filter(l=>!v.source.includes(sourceCode(l))||!v.target.includes(sourceCode(l)));
}

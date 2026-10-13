// Translation memory (spec 1.1: "According to our translation memory"). Finished and imported translations are
// stored as source/target pairs. A new text is split into sentences and each sentence is compared with the memory:
// repetitions inside the text, exact (100%) matches and fuzzy matches (95–99%, 85–94%, 75–84%) cost less, and exact
// matches are reused when translating.
import {createHash} from 'node:crypto';
import {db,runtime} from './server';
import {extractSourceText} from './extract';
import {MAX_SOURCE_WITH_CODE} from './translation';
import {sourceWordCount} from './words';
import type {Segment,Translated} from './translation';

import {memoryBands as BANDS,memoryBandLabels as bandLabels,defaultFactors,memoryPriced,type MemoryBand as Band,type Order,type Pricing} from './catalog';
export {BANDS,bandLabels};export type {Band};
// Share of the full word price charged for each band (percentages are edited in Settings → Prices).
export const defaultMemoryWeights=Object.fromEntries(BANDS.map(b=>[b,(defaultFactors.memory[b]??100)/100])) as Record<Band,number>;
export const memoryWeights=(f:{memory?:Record<string,number>})=>Object.fromEntries(BANDS.map(b=>[b,Math.min(100,(f.memory?.[b]??defaultFactors.memory[b]??100))/100])) as Record<Band,number>;
export type MemoryWeights=Record<Band,number>;
export type Analysis={words:number;effective:number;bands:Record<Band,number>;units:number};
export type Quality='approved'|'imported'|'machine';

export const normalize=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export const memoryKey=(s:string)=>createHash('sha256').update(normalize(s)).digest('hex').slice(0,40);
const wordSplitter=new Intl.Segmenter(undefined,{granularity:'word'});
export function tokens(s:string){return [...wordSplitter.segment(normalize(s))].filter(p=>p.isWordLike).map(p=>p.segment);}
// For fuzzy scores numbers count as placeholders (as in CAT tools): "120/80" and "130/85" differ only in values.
const fuzzyTokens=(s:string)=>tokens(s).map(w=>/^[\d.,]+$/.test(w)?'#':w);
// Word-level edit distance as a similarity from 0 to 1. Punctuation and case differences alone still score below 1.
export function similarity(a:string[],b:string[]){
  if(!a.length&&!b.length)return 1;const n=a.length,m=b.length;if(!n||!m)return 0;
  let prev=Array.from({length:m+1},(_,j)=>j);
  for(let i=1;i<=n;i++){const cur=[i];for(let j=1;j<=m;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}
  return 1-prev[m]/Math.max(n,m);
}
export function band(score:number):Band{return score>=1?'exact':score>=0.95?'high':score>=0.85?'mid':score>=0.75?'low':'new';}

// Sentences of a text, kept with the spaces and line breaks around them so they join back exactly.
const sentenceSplitter=new Intl.Segmenter(undefined,{granularity:'sentence'});
export function sentences(text:string){
  const out:string[]=[];
  for(const part of text.split(/(\n+)/)){if(!part)continue;if(/^\n+$/.test(part)){if(out.length)out[out.length-1]+=part;else out.push(part);continue;}
    for(const s of sentenceSplitter.segment(part))out.push(s.segment);}
  return out;
}
const core=(s:string)=>s.trim();

type Entry={id:string;source_text:string;target_text:string;source_key:string;words:number;quality:string};
type Candidates={byKey:Map<string,Entry>;entries:Entry[];tokens:string[][];index:Map<string,number[]>};
const rank=(q:string)=>q==='approved'?3:q==='imported'?2:1;
// Loads the memory for one language pair within the word range of the units to compare (capped for speed).
async function candidates(workspace:string,source:string,target:string,min:number,max:number):Promise<Candidates>{
  const rows=(await db().prepare('SELECT id,source_text,target_text,source_key,words,quality FROM memory WHERE workspace=? AND source_language=? AND target_language=? AND words BETWEEN ? AND ? ORDER BY updated DESC LIMIT 20000').bind(workspace,source,target,Math.max(0,min),max).all<Entry>()).results;
  const byKey=new Map<string,Entry>();const toks:string[][]=[];const index=new Map<string,number[]>();
  rows.forEach((e,i)=>{const old=byKey.get(e.source_key);if(!old||rank(e.quality)>rank(old.quality))byKey.set(e.source_key,e);const t=fuzzyTokens(e.source_text);toks.push(t);for(const w of new Set(t)){const list=index.get(w);if(list)list.push(i);else index.set(w,[i]);}});
  return {byKey,entries:rows,tokens:toks,index};
}
export type Match={score:number;band:Band;entry?:Entry};
function best(unit:string,c:Candidates):Match{
  const exact=c.byKey.get(memoryKey(unit));if(exact)return {score:1,band:'exact',entry:exact};
  const t=fuzzyTokens(unit);if(!t.length)return {score:0,band:'new'};
  const shared=new Map<number,number>();for(const w of new Set(t))for(const i of c.index.get(w)||[])shared.set(i,(shared.get(i)||0)+1);
  const top=[...shared.entries()].filter(([,n])=>n>=Math.ceil(t.length*0.6)).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let match:Match={score:0,band:'new'};
  for(const [i] of top){const s=Math.min(0.99,similarity(t,c.tokens[i]));if(s>match.score)match={score:s,band:band(s),entry:c.entries[i]};}
  return match.band==='new'?{score:match.score,band:'new'}:match;
}
const emptyBands=()=>Object.fromEntries(BANDS.map(b=>[b,0])) as Record<Band,number>;
export function effectiveWords(bands:Record<Band,number>,weights:MemoryWeights=defaultMemoryWeights){return Math.round(BANDS.reduce((n,b)=>n+bands[b]*(weights[b]??1),0));}

// Match analysis of a text against the memory for each target language.
export async function analyse(workspace:string,text:string,source:string,targets:string[],weights:MemoryWeights=defaultMemoryWeights):Promise<Record<string,Analysis>>{
  const units=sentences(text).map(core).filter(u=>sourceWordCount(u)>0);
  const counts=units.map(u=>sourceWordCount(u));
  const out:Record<string,Analysis>={};
  if(!units.length){for(const t of targets)out[t]={words:0,effective:0,bands:emptyBands(),units:0};return out;}
  const min=Math.floor(Math.min(...counts)*0.7),max=Math.ceil(Math.max(...counts)*1.4)+1;
  for(const target of targets){
    const c=await candidates(workspace,source,target,min,max);
    const bands=emptyBands();const seen=new Set<string>();
    units.forEach((u,i)=>{const key=memoryKey(u);const b:Band=seen.has(key)?'repeat':best(u,c).band;seen.add(key);bands[b]+=counts[i];});
    const words=counts.reduce((a,b)=>a+b,0);
    out[target]={words,effective:effectiveWords(bands,weights),bands,units:units.length};
  }
  return out;
}

// Exact matches for translation: a section is reused when the whole section, or every sentence in it, is in memory.
export async function exactTranslations(workspace:string,source:string,target:string,segments:Segment[]){
  const reused=new Map<string,string>();if(!segments.length)return reused;
  const pieces=segments.map(s=>({s,parts:sentences(s.text)}));
  const counts=pieces.flatMap(p=>[sourceWordCount(p.s.text),...p.parts.map(x=>sourceWordCount(x))]).filter(n=>n>0);
  if(!counts.length)return reused;
  const c=await candidates(workspace,source,target,Math.min(...counts),Math.max(...counts));
  if(!c.entries.length)return reused;
  const used:string[]=[];
  for(const {s,parts} of pieces){
    const whole=c.byKey.get(memoryKey(s.text));
    if(whole){reused.set(s.id,edges(s.text,whole.target_text));used.push(whole.id);continue;}
    const hits=parts.map(p=>sourceWordCount(p)?c.byKey.get(memoryKey(p)):null);
    if(parts.length>1&&hits.every((h,i)=>h||!sourceWordCount(parts[i]))){
      reused.set(s.id,parts.map((p,i)=>hits[i]?edges(p,hits[i]!.target_text):p).join(''));used.push(...hits.filter(Boolean).map(h=>h!.id));}
  }
  if(used.length)await db().prepare(`UPDATE memory SET uses=uses+1 WHERE id IN (${used.map(()=>'?').join(',')})`).bind(...used).run();
  return reused;
}
// Keeps the source's leading and trailing whitespace around a stored translation.
function edges(source:string,translation:string){return (source.match(/^\s*/)?.[0]||'')+translation.trim()+(source.match(/\s*$/)?.[0]||'');}

export type Pair={source:string;target:string};
// Pairs to learn from a finished translation: each section, plus its paragraphs and sentences when they line up one to one.
export function alignedPairs(segments:Segment[],result:Translated[]):Pair[]{
  const pairs:Pair[]=[];const add=(a:string,b:string)=>{if(sourceWordCount(a)>0&&b.trim())pairs.push({source:a.trim(),target:b.trim()});};
  segments.forEach((s,i)=>{const t=result[i]?.translation;if(!t||result[i].id!==s.id)return;add(s.text,t);
    const sp=s.text.split(/\n+/).filter(x=>x.trim()),tp=t.split(/\n+/).filter(x=>x.trim());
    if(sp.length!==tp.length)return;
    sp.forEach((p,j)=>{if(sp.length>1)add(p,tp[j]);const ss=sentences(p).filter(x=>x.trim()),ts=sentences(tp[j]).filter(x=>x.trim());if(ss.length>1&&ss.length===ts.length)ss.forEach((x,k)=>add(x,ts[k]));});
  });
  return pairs;
}
// Adds or improves memory entries; a better source (approved > imported > machine) replaces an existing translation.
export async function learn(workspace:string,o:{source:string;target:string;sector:string;quality:Quality;origin:string|null},pairs:Pair[]){
  const now=new Date().toISOString();const seen=new Set<string>();const statements=[];
  for(const p of pairs){const key=memoryKey(p.source);if(seen.has(key))continue;seen.add(key);
    statements.push(db().prepare(`INSERT INTO memory (id,workspace,source_language,target_language,sector,source_text,target_text,source_key,words,quality,origin,uses,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)
      ON CONFLICT (workspace,source_language,target_language,source_key) DO UPDATE SET target_text=excluded.target_text, quality=excluded.quality, origin=excluded.origin, sector=excluded.sector, updated=excluded.updated
      WHERE (CASE memory.quality WHEN 'approved' THEN 3 WHEN 'imported' THEN 2 ELSE 1 END) <= (CASE excluded.quality WHEN 'approved' THEN 3 WHEN 'imported' THEN 2 ELSE 1 END)`)
      .bind(crypto.randomUUID(),workspace,o.source,o.target,o.sector,p.source.slice(0,8000),p.target.slice(0,12000),key,sourceWordCount(p.source),o.quality,o.origin,now,now));}
  for(let i=0;i<statements.length;i+=100)await db().batch(statements.slice(i,i+100));
  return statements.length;
}

// ---------- Import and export ----------
const xmlText=(s:string)=>s.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&amp;/g,'&');
const xmlEscape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// TMX 1.4: <tu> units with one <tuv xml:lang> per language. Languages are matched by their two-letter code.
export function parseTmx(xml:string,source:string,target:string){
  const pairs:Pair[]=[];
  for(const tu of xml.match(/<tu[\s>][\s\S]*?<\/tu>/g)||[]){
    const vars=[...tu.matchAll(/<tuv[^>]*?(?:xml:)?lang\s*=\s*"([^"]+)"[^>]*>[\s\S]*?<seg>([\s\S]*?)<\/seg>[\s\S]*?<\/tuv>/g)].map(m=>({lang:m[1].toLowerCase().split(/[-_]/)[0],text:xmlText(m[2]).trim()}));
    const a=vars.find(v=>v.lang===source.toLowerCase()),b=vars.find(v=>v.lang===target.toLowerCase());
    if(a?.text&&b?.text)pairs.push({source:a.text,target:b.text});
  }
  return pairs;
}
// Two columns (source, target), separated by a tab, comma or semicolon. Quotes are supported.
export function parseColumns(text:string){
  const pairs:Pair[]=[];const lines=text.replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());
  const sep=lines[0]?.includes('\t')?'\t':(lines[0]?.split(';').length||0)>(lines[0]?.split(',').length||0)?';':',';
  const header=/^(source|src|original|source text|segment|target|tgt|translation|target text)$/i;
  lines.forEach((line,n)=>{const cells:string[]=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else if(ch==='"')q=true;else if(ch===sep){cells.push(cur);cur='';}else cur+=ch;}
    cells.push(cur);if(n===0&&(header.test(cells[0]?.trim()||'')||header.test(cells[1]?.trim()||'')))return;if(cells.length>=2&&cells[0].trim()&&cells[1].trim())pairs.push({source:cells[0].trim(),target:cells[1].trim()});});
  return pairs;
}
export function toTmx(rows:{source_text:string;target_text:string}[],source:string,target:string){
  const units=rows.map(r=>`<tu><tuv xml:lang="${source}"><seg>${xmlEscape(r.source_text)}</seg></tuv><tuv xml:lang="${target}"><seg>${xmlEscape(r.target_text)}</seg></tuv></tu>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4"><header creationtool="Verba" creationtoolversion="1" segtype="sentence" o-tmf="Verba" adminlang="en" srclang="${source}" datatype="plaintext"/>\n<body>\n${units}\n</body></tmx>\n`;
}

// ---------- Orders ----------
// Reads the uploaded files of an order (text PDF, Word, TXT; images are skipped) and analyses them for every target.
export async function fileText(workspace:string,ids:string[]){
  const parts:string[]=[];
  for(const id of ids){const f=await db().prepare('SELECT id,type FROM files WHERE id=? AND workspace=?').bind(id,workspace).first<{id:string;type:string}>();if(!f||f.type.startsWith('image/'))continue;
    const object=await runtime().BUCKET.get(f.id);if(!object)continue;
    try{parts.push(await extractSourceText(new Uint8Array(await object.arrayBuffer()),f.type,MAX_SOURCE_WITH_CODE));}catch{/* unreadable or scanned: priced by the counted words */}}
  return parts.join('\n\n');
}
export async function orderMemory(workspace:string,o:Pick<Order,'service'|'source'|'targets'|'documents'>,pricing:Pricing){
  const ids=o.documents.flatMap(d=>d.fileIds);
  if(!memoryPriced(o.service)||!o.targets.length||!ids.length)return null;
  const text=await fileText(workspace,ids);if(!text.trim())return null;
  const result=await analyse(workspace,text,o.source,o.targets,memoryWeights(pricing.factors));
  return Object.fromEntries(Object.entries(result).map(([t,a])=>[t,{words:a.words,bands:a.bands}]));
}
// The server always recalculates the analysis; values sent by the browser are ignored.
export async function withMemory<T extends Order>(c:{workspace:{id:string};pricing:Pricing},o:T):Promise<T>{
  return {...o,memory:await orderMemory(c.workspace.id,o,c.pricing).catch(()=>null)};
}

// ---------- Translator jobs ----------
// Match analysis for one translation job (null when the memory has nothing for the language pair).
export async function jobMemory(workspace:string,text:string,source:string,target:string,pricing:{factors:{memory?:Record<string,number>}}){
  const any=await db().prepare('SELECT 1 AS x FROM memory WHERE workspace=? AND source_language=? AND target_language=? LIMIT 1').bind(workspace,source,target).first();
  const a=(await analyse(workspace,text,source,[target],memoryWeights(pricing.factors)))[target];
  if(!any&&!a.bands.repeat)return null;
  return a;
}

// Sentence-by-sentence lookup for staff: the best memory match for each sentence of a text.
export async function matchText(workspace:string,text:string,source:string,target:string){
  const units=sentences(text).map(core).filter(u=>sourceWordCount(u)>0).slice(0,300);
  if(!units.length)return [];
  const counts=units.map(u=>sourceWordCount(u));
  const c=await candidates(workspace,source,target,Math.floor(Math.min(...counts)*0.7),Math.ceil(Math.max(...counts)*1.4)+1);
  const seen=new Set<string>();
  return units.map(u=>{const key=memoryKey(u);const repeat=seen.has(key);seen.add(key);const m=best(u,c);
    return {text:u,words:sourceWordCount(u),band:repeat&&m.band==='new'?'repeat' as Band:m.band,score:Math.round(m.score*100),source:m.entry?.source_text||null,target:m.entry?.target_text||null,quality:m.entry?.quality||null};});
}

'use client';
// Translation memory (staff): language pairs, a match check for any text, TMX/CSV import and export, and the entries.
import {useCallback,useEffect,useState} from 'react';
import {Upload,Download,Trash2,Search,Loader2,Pencil,Check,X,ScanSearch,DatabaseZap,ArrowRight} from 'lucide-react';
import {toast} from 'sonner';
import {Pick,Field,Pill,api,json,date,downloadFrom} from '../verba-ui';
import {useT} from '../i18n';
import {languages,sectors,memoryBandLabels,defaultFactors,type MemoryAnalysis,type MemoryBand} from '@/lib/catalog';
import {MemoryBar} from '../memory-bar';
import type {WorkspaceInfo} from './types';
type Entry={id:string;source_language:string;target_language:string;sector:string;source_text:string;target_text:string;words:number;quality:string;uses:number;updated:string};
type PairStat={source_language:string;target_language:string;entries:number;words:number;uses:number;updated:string};
type Unit={text:string;words:number;band:MemoryBand;score:number;source:string|null;target:string|null;quality:string|null};

export function MemoryView({ws}:{ws:WorkspaceInfo}){
  const {t,lang}=useT();const admin=ws.role==='admin';
  const [items,setItems]=useState<Entry[]>([]);const [pairs,setPairs]=useState<PairStat[]>([]);const [total,setTotal]=useState(0);const [page,setPage]=useState(0);
  const [q,setQ]=useState('');const [pair,setPair]=useState('');const [loading,setLoading]=useState(true);const [edit,setEdit]=useState<Entry|null>(null);
  const load=useCallback(async(p=0)=>{setLoading(true);try{const [s,tg]=pair?pair.split('|'):['',''];const r=await api(`/api/memory?q=${encodeURIComponent(q)}&source=${encodeURIComponent(s)}&target=${encodeURIComponent(tg)}&page=${p}`);setItems(r.items as Entry[]);setTotal(Number(r.total));setPairs(r.pairs as PairStat[]);setPage(p);}catch(e){toast.error(t((e as Error).message));}finally{setLoading(false);}},[q,pair,t]);
  useEffect(()=>{const timer=setTimeout(()=>void load(0),250);return ()=>clearTimeout(timer);},[load]);
  async function remove(e:Entry){if(!window.confirm(t('Delete this memory entry?')))return;try{await api('/api/memory?id='+e.id,{method:'DELETE'});void load(page);}catch(x){toast.error(t((x as Error).message));}}
  async function save(){if(!edit)return;try{await api('/api/memory',json({id:edit.id,source_text:edit.source_text,target_text:edit.target_text},'PATCH'));setEdit(null);toast.success(t('Saved'));void load(page);}catch(x){toast.error(t((x as Error).message));}}
  async function dropPair(p:PairStat){if(!window.confirm(t('Delete all {n} entries for {pair}?',{n:p.entries,pair:`${t(p.source_language)} → ${t(p.target_language)}`})))return;try{await api(`/api/memory?source=${encodeURIComponent(p.source_language)}&target=${encodeURIComponent(p.target_language)}`,{method:'DELETE'});void load(0);}catch(x){toast.error(t((x as Error).message));}}
  return <div className="memory-page">
    <div className="pair-strip">{pairs.length?pairs.map(p=><article key={p.source_language+p.target_language} className={'pair-card'+(pair===`${p.source_language}|${p.target_language}`?' active':'')}>
        <button className="pair-main" onClick={()=>setPair(x=>x===`${p.source_language}|${p.target_language}`?'':`${p.source_language}|${p.target_language}`)}><span className="pair-langs">{t(p.source_language)}<ArrowRight size={14} className="flip-rtl"/>{t(p.target_language)}</span><b>{Number(p.entries).toLocaleString()}</b><small>{t('{words} words · reused {uses}×',{words:Number(p.words).toLocaleString(),uses:Number(p.uses)})}</small></button>
        <div className="pair-actions"><button className="icon-button" title={t('Export TMX')} aria-label={t('Export TMX')} onClick={()=>void downloadFrom(`/api/memory/export?source=${encodeURIComponent(p.source_language)}&target=${encodeURIComponent(p.target_language)}`,`verba-memory.tmx`).catch(e=>toast.error(t((e as Error).message)))}><Download size={15}/></button>{admin&&<button className="icon-button" title={t('Delete pair')} aria-label={t('Delete pair')} onClick={()=>void dropPair(p)}><Trash2 size={15}/></button>}</div></article>)
      :<div className="pair-empty"><DatabaseZap size={22}/><div><b>{t('Your memory is empty for now.')}</b><p>{t('Every finished translation is added automatically. You can also import a TMX or CSV file from your previous tools.')}</p></div></div>}</div>
    <div className="memory-grid"><MatchCheck ws={ws}/><ImportCard onDone={()=>void load(0)}/></div>
    <section className="panel memory-entries"><div className="panel-heading"><div><h2>{t('Entries')}</h2><p className="muted">{t('{n} entries',{n:total.toLocaleString()})}{pair?` · ${pair.split('|').map(x=>t(x)).join(' → ')}`:''}</p></div>
      <div className="memory-search"><Search size={15}/><input placeholder={t('Search source or translation…')} aria-label={t('Search')} value={q} onChange={e=>setQ(e.target.value)}/>{loading&&<Loader2 size={15} className="spin"/>}</div></div>
      <div className="memory-rows">{items.map(e=><div key={e.id} className="memory-row">{edit?.id===e.id?<><textarea value={edit.source_text} onChange={x=>setEdit({...edit,source_text:x.target.value})} rows={3} dir="auto"/><textarea value={edit.target_text} onChange={x=>setEdit({...edit,target_text:x.target.value})} rows={3} dir="auto"/><div className="memory-meta"><button className="icon-button" onClick={()=>void save()} aria-label={t('Save')}><Check size={15}/></button><button className="icon-button" onClick={()=>setEdit(null)} aria-label={t('Cancel')}><X size={15}/></button></div></>
        :<><p dir="auto">{e.source_text}</p><p dir="auto">{e.target_text}</p><div className="memory-meta"><span className="pair-mini">{t(e.source_language)} → {t(e.target_language)}</span><Pill tone={e.quality==='approved'?'ready':e.quality==='imported'?'info':'pending'}>{e.quality==='approved'?'Approved':e.quality==='imported'?'Imported':'Machine'}</Pill><small>{t('{n} words',{n:e.words})} · {t('reused {n}×',{n:e.uses})} · {date(e.updated,lang)}</small><span className="row-actions"><button className="icon-button" onClick={()=>setEdit(e)} aria-label={t('Edit')}><Pencil size={14}/></button><button className="icon-button" onClick={()=>void remove(e)} aria-label={t('Delete')}><Trash2 size={14}/></button></span></div></>}</div>)}
        {!items.length&&!loading&&<p className="table-empty">{q?t('No entries match your search.'):t('Nothing here yet.')}</p>}</div>
      {total>50&&<div className="pager"><button className="button secondary small" disabled={!page} onClick={()=>void load(page-1)}>{t('Previous')}</button><span>{page+1} / {Math.ceil(total/50)}</span><button className="button secondary small" disabled={(page+1)*50>=total} onClick={()=>void load(page+1)}>{t('Next')}</button></div>}
    </section>
  </div>;
}

function MatchCheck({ws}:{ws:WorkspaceInfo}){
  const {t}=useT();const [source,setSource]=useState('English');const [target,setTarget]=useState('German');const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [result,setResult]=useState<{units:Unit[];summary:MemoryAnalysis&{effective:number}}|null>(null);
  const weights={...defaultFactors.memory,...(ws.pricing.factors.memory||{})};
  async function run(){setBusy(true);try{setResult(await api('/api/memory/match',json({text,source,target})) as never);}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  return <section className="panel match-check"><div className="panel-heading"><div><h2><ScanSearch size={18}/>{t('Check a text')}</h2><p className="muted">{t('See how much of a new text is already in your memory, sentence by sentence.')}</p></div></div>
    <div className="two-col"><Pick label={t('From')} value={source} onChange={setSource} options={languages.map(l=>({value:l,label:t(l)}))}/><Pick label={t('To')} value={target} onChange={setTarget} options={languages.map(l=>({value:l,label:t(l)}))}/></div>
    <Field label={t('Text')}><textarea rows={5} value={text} maxLength={30000} onChange={e=>setText(e.target.value)} dir="auto" placeholder={t('Paste a text to analyse…')}/></Field>
    <button className="button primary small" disabled={busy||!text.trim()||source===target} onClick={()=>void run()}>{busy?<Loader2 size={15} className="spin"/>:<ScanSearch size={15}/>}{t('Analyse')}</button>
    {result&&<div className="match-result"><MemoryBar analysis={result.summary} weights={weights}/><p className="muted">{t('{words} words; priced as {effective} words with your memory discounts.',{words:result.summary.words.toLocaleString(),effective:result.summary.effective.toLocaleString()})}</p>
      <ol className="match-units">{result.units.map((u,i)=><li key={i} className={'band-row band-'+u.band}><span className="score">{u.band==='repeat'?t('Repeat'):u.score?`${u.score}%`:'—'}</span><div><p dir="auto">{u.text}</p>{u.target&&<p className="suggestion" dir="auto">{u.target}</p>}{u.source&&u.band!=='exact'&&<small dir="auto">{t('Memory source')}: {u.source}</small>}</div><em>{t(memoryBandLabels[u.band])}</em></li>)}</ol></div>}
  </section>;
}

function ImportCard({onDone}:{onDone:()=>void}){
  const {t}=useT();const [source,setSource]=useState('English');const [target,setTarget]=useState('German');const [sector,setSector]=useState('General');const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);
  async function run(){if(!file)return;setBusy(true);try{const f=new FormData();f.append('file',file);f.append('source',source);f.append('target',target);f.append('sector',sector);const r=await api('/api/memory',{method:'POST',body:f});toast.success(t('{n} entries imported',{n:Number(r.imported).toLocaleString()}));setFile(null);onDone();}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  return <section className="panel import-card"><div className="panel-heading"><div><h2><Upload size={18}/>{t('Import')}</h2><p className="muted">{t('TMX from any translation tool, or a CSV/TSV file with two columns: source and translation.')}</p></div></div>
    <div className="two-col"><Pick label={t('From')} value={source} onChange={setSource} options={languages.map(l=>({value:l,label:t(l)}))}/><Pick label={t('To')} value={target} onChange={setTarget} options={languages.map(l=>({value:l,label:t(l)}))}/></div>
    <Pick label={t('Translation field')} value={sector} onChange={setSector} options={sectors.map(s=>({value:s,label:t(s)}))}/>
    <label className={'drop-zone'+(file?' has-file':'')}><input type="file" accept=".tmx,.csv,.tsv,.txt" onChange={e=>setFile(e.target.files?.[0]||null)}/><Upload size={20}/><span>{file?file.name:t('Choose a TMX, CSV or TSV file')}</span><small>{t('Up to 20 MB')}</small></label>
    <button className="button primary small" disabled={!file||busy||source===target} onClick={()=>void run()}>{busy?<Loader2 size={15} className="spin"/>:<Upload size={15}/>}{t('Import')}</button>
    <p className="fine-print">{t('Approved translations replace machine and imported ones for the same sentence.')}</p></section>;
}

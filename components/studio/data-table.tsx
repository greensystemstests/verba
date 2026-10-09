'use client';
// Dynamic table (spec 1.9–1.16): users choose which columns are shown and their order,
// search every column, and export what they see to Excel, PDF or print.
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Columns3,ArrowUp,ArrowDown,Download,Printer,FileText,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {useT} from '../i18n';
import {downloadFrom,download,json} from '../verba-ui';
import {xlsx} from '@/lib/office-export';
export type Column<T>={key:string;label:string;value:(r:T)=>string;render?:(r:T)=>ReactNode;filter?:'text'|'select'|'none';hidden?:boolean;align?:'end'};
type Prefs={order:string[];hidden:string[]};
function loadPrefs(id:string):Prefs|null{try{const v=localStorage.getItem('verba-table-'+id);return v?JSON.parse(v):null;}catch{return null;}}
export default function DataTable<T>({id,title,rows,columns,rowKey,onSelect,selected,rowClass,empty,toolbar,exportable=true}:{id:string;title:string;rows:T[];columns:Column<T>[];rowKey:(r:T)=>string;onSelect?:(r:T)=>void;selected?:string|null;rowClass?:(r:T)=>string;empty?:ReactNode;toolbar?:ReactNode;exportable?:boolean}){
  const {t,lang}=useT();
  const [prefs,setPrefs]=useState<Prefs>({order:columns.map(c=>c.key),hidden:columns.filter(c=>c.hidden).map(c=>c.key)});
  const [filters,setFilters]=useState<Record<string,string>>({});const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- saved column choices live in browser storage
  useEffect(()=>{const p=loadPrefs(id);if(p)setPrefs({order:[...p.order.filter(k=>columns.some(c=>c.key===k)),...columns.map(c=>c.key).filter(k=>!p.order.includes(k))],hidden:p.hidden});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load saved column choices once per table
  },[id]);
  const save=(p:Prefs)=>{setPrefs(p);try{localStorage.setItem('verba-table-'+id,JSON.stringify(p));}catch{}};
  const visible=prefs.order.map(k=>columns.find(c=>c.key===k)!).filter(c=>c&&!prefs.hidden.includes(c.key));
  const options=useMemo(()=>Object.fromEntries(columns.filter(c=>c.filter==='select').map(c=>[c.key,[...new Set(rows.map(c.value))].filter(Boolean).sort()])),[rows,columns]);
  const shown=rows.filter(r=>{if(search&&!columns.some(c=>c.value(r).toLowerCase().includes(search.toLowerCase())))return false;return Object.entries(filters).every(([k,v])=>{if(!v)return true;const c=columns.find(x=>x.key===k);if(!c)return true;const cell=c.value(r);return c.filter==='select'?cell===v:cell.toLowerCase().includes(v.toLowerCase());});});
  const table=()=>[visible.map(c=>c.label),...shown.map(r=>visible.map(c=>c.value(r)))];
  async function pdf(){setBusy(true);try{const [head,...body]=table();await downloadFrom('/api/reports/pdf','verba-'+id+'.pdf',json({title,subtitle:t('{n} rows',{n:body.length}),head,rows:body.slice(0,3000),lang}));}catch(e){toast.error(t((e as Error).message));}finally{setBusy(false);}}
  function excel(){download(xlsx(table()),'verba-'+id+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
  function print(){const [head,...body]=table();const w=window.open('','_blank');if(!w){toast.error(t('Allow pop-ups to print'));return;}const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
    w.document.write(`<!doctype html><html lang="${lang}" dir="${lang==='he'?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px -apple-system,Segoe UI,sans-serif;margin:24px;color:#172b29}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:start}th{background:#f2f5f4}</style></head><body><h1>${esc(title)}</h1><p>${esc(new Date().toLocaleString(lang==='he'?'he-IL':'en-GB'))} · ${body.length}</p><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>{window.print();}</script></body></html>`);w.document.close();}
  const move=(k:string,d:number)=>{const o=[...prefs.order];const i=o.indexOf(k);const j=i+d;if(j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]];save({...prefs,order:o});};
  return <div className="data-table">
    <div className="table-toolbar"><div className="search-field"><Search size={17}/><input aria-label={t('Search')} placeholder={t('Search all columns…')} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label={t('Clear search')} onClick={()=>setSearch('')}><X size={14}/></button>}</div>
      {toolbar}
      <Popover><PopoverTrigger asChild><button type="button" className="button secondary small"><Columns3 size={15}/>{t('Columns')}</button></PopoverTrigger><PopoverContent className="column-chooser"><b>{t('Show and order columns')}</b>{prefs.order.map(k=>{const c=columns.find(x=>x.key===k);if(!c)return null;return <div key={k}><label><input type="checkbox" checked={!prefs.hidden.includes(k)} onChange={e=>save({...prefs,hidden:e.target.checked?prefs.hidden.filter(h=>h!==k):[...prefs.hidden,k]})}/>{c.label}</label><button type="button" aria-label={t('Move up')} onClick={()=>move(k,-1)}><ArrowUp size={13}/></button><button type="button" aria-label={t('Move down')} onClick={()=>move(k,1)}><ArrowDown size={13}/></button></div>;})}<button type="button" className="text-link" onClick={()=>save({order:columns.map(c=>c.key),hidden:columns.filter(c=>c.hidden).map(c=>c.key)})}>{t('Reset columns')}</button></PopoverContent></Popover>
      {exportable&&<><button type="button" className="button secondary small" onClick={print} disabled={!shown.length}><Printer size={15}/>{t('Print')}</button><button type="button" className="button secondary small" onClick={excel} disabled={!shown.length}><Download size={15}/>{t('Excel')}</button><button type="button" className="button secondary small" onClick={pdf} disabled={!shown.length||busy}><FileText size={15}/>{t('PDF')}</button></>}
    </div>
    <div className="table-scroll"><table className="dyn-table"><thead><tr>{visible.map(c=><th key={c.key} className={c.align==='end'?'end':''}>{c.label}</th>)}</tr><tr className="filter-row">{visible.map(c=><th key={c.key}>{c.filter==='none'?null:c.filter==='select'?<select aria-label={t('Filter {column}',{column:c.label})} value={filters[c.key]||''} onChange={e=>setFilters(f=>({...f,[c.key]:e.target.value}))}><option value="">{t('All')}</option>{(options[c.key]||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:<input aria-label={t('Filter {column}',{column:c.label})} value={filters[c.key]||''} onChange={e=>setFilters(f=>({...f,[c.key]:e.target.value}))}/>}</th>)}</tr></thead>
      <tbody>{shown.map(r=>{const k=rowKey(r);return <tr key={k} className={(selected===k?'selected ':'')+(rowClass?.(r)||'')+(onSelect?' clickable':'')} onClick={()=>onSelect?.(r)} tabIndex={onSelect?0:undefined} onKeyDown={e=>{if(onSelect&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(r);}}}>{visible.map(c=><td key={c.key} className={c.align==='end'?'end':''}>{c.render?c.render(r):c.value(r)}</td>)}</tr>;})}</tbody></table>
      {!shown.length&&(empty||<p className="table-empty">{rows.length?t('No rows match your search.'):t('Nothing here yet.')}</p>)}</div>
    <p className="table-count">{t('{shown} of {total} rows',{shown:shown.length,total:rows.length})}</p>
  </div>;
}

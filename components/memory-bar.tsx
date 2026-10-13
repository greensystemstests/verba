'use client';
// Translation-memory analysis as a stacked bar with a legend (order form, quotes and the memory screen).
import {useT} from './i18n';
import {memoryBands,memoryBandLabels,type MemoryAnalysis} from '@/lib/catalog';
export function MemoryBar({analysis,weights}:{analysis:MemoryAnalysis;weights?:Record<string,number>}){
  const {t}=useT();const total=Math.max(1,analysis.words);
  return <div className="memory-bar"><div className="memory-track" role="img" aria-label={memoryBands.map(b=>`${t(memoryBandLabels[b])}: ${analysis.bands[b]||0}`).join(', ')}>{memoryBands.map(b=>(analysis.bands[b]||0)>0&&<span key={b} className={'band-'+b} style={{width:`${(analysis.bands[b]/total)*100}%`}}/>)}</div>
    <ul className="memory-legend">{memoryBands.map(b=><li key={b} className={(analysis.bands[b]||0)?'':'empty'}><i className={'band-'+b}/><span>{t(memoryBandLabels[b])}</span><b>{(analysis.bands[b]||0).toLocaleString()}</b>{weights&&<small>{weights[b]??100}%</small>}</li>)}</ul></div>;
}

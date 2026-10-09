import {requireUser} from '@/lib/account';
import {context} from '@/lib/server';
import {translationAccess,type TranslationRow} from '@/lib/translation-server';
import type {Translated} from '@/lib/translation';
import Link from 'next/link';
import PrintButton from '@/components/print-button';
import {getLang,serverT} from '@/lib/i18n-server';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){return <Result id={(await params).id}/>;}
async function Result({id}:{id:string}){await requireUser('/translate/print/'+id);const c=await context();const lang=await getLang();const t=await serverT(lang);let j:TranslationRow;try{j=await translationAccess(c,id);}catch{return <main className="legal-page"><h1>{t('Translation unavailable')}</h1><Link href="/">{t('Return home')}</Link></main>;}if(!['ready','needs_review','approved'].includes(j.state))return <main className="legal-page"><h1>{t('Translation is still in progress.')}</h1><a href={'/?translation='+id}>{t('Open translation')}</a></main>;return <main className="order-print"><header><div className="brand">verba.</div><span>{t('TRANSLATION')}</span><PrintButton/></header><h1>{j.title}</h1><p>{t('{from} → {to}',{from:t(j.source),to:t(j.target)})} · {t(j.sector)}</p><div className="translation-notice">{j.state==='approved'?t('Reviewed in this workspace by {name}. This is not a notarized or independently certified translation.',{name:j.reviewer||''}):t('AI translation draft. Not professionally approved. Verify against the source before relying on it.')}</div><article className="print-translation" dir={['Hebrew','Arabic'].includes(j.target)?'rtl':'auto'}>{(JSON.parse(j.result) as Translated[]).map(s=><p key={s.id} style={{whiteSpace:'pre-wrap',marginBottom:12}}>{s.translation}</p>)}</article><footer>Verba · {j.id} · {t('Version {n}',{n:j.version})} · {new Date(j.updated).toLocaleDateString(lang==='he'?'he-IL':'en-GB')}</footer></main>;}

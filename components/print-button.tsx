'use client';
import {useT} from './i18n';
export default function PrintButton(){const {t}=useT();return <button className="button primary no-print" onClick={()=>window.print()}>{t('Print / save as PDF')}</button>;}

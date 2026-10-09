'use client';
import {Header,Footer} from '@/components/verba-ui';
import {useT} from '@/components/i18n';
import {appHref} from '@/lib/links';
const sections:[string,string][]=[
  ['Quotes and payment','Prices shown online are estimates before applicable taxes, calculated from the details you enter. Confirming an order records your request; payment is requested after our team reviews the documents. Final prices, availability and deadlines are confirmed in writing.'],
  ['Translation and review','Professional and student translations follow the selected workflow. Machine and AI translations are drafts. Medical, legal and financial translations require qualified review. Automated checks cannot guarantee accuracy. Translation outputs must be reviewed by a suitably qualified person before clinical, legal or other consequential use.'],
  ['Notarial services and deliveries','A qualified notary confirms legal eligibility, identity requirements, physical attendance and regulated fees in the relevant country. Courier prices and timing are confirmed after review. International shipments are sent with an external carrier.'],
  ['Your documents','Only upload documents you are authorized to share. The operator must approve commercial terms, cancellation and refund policies, legal entity details and data-processing arrangements before public launch.'],
];
export default function Terms(){const {t}=useT();return <><Header/><main className="legal-page"><span className="eyebrow">{t('SERVICE TERMS')}</span><h1>{t('Clear expectations.')}<br/>{t('Before we begin.')}</h1>{sections.map(([h,p])=><section key={h}><h2>{t(h)}</h2><p>{t(p)}</p></section>)}<a href={appHref('/')||'/'} className="button secondary">{t('Back to Verba')}</a></main><Footer/></>;}

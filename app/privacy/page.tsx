'use client';
import {Header,Footer} from '@/components/verba-ui';
import {useT} from '@/components/i18n';
import {appHref} from '@/lib/links';
const sections:[string,string][]=[
  ['What is stored','Your account details (name, email, phone, address and notification choices), quotes, orders, uploaded files, source text, translation drafts, terminology, messages, customer-service chats, deliveries and activity history. Records and files are stored on the hosting platform and its database, not only on your device.'],
  ['Who can access it','You, company staff, and the specialists assigned to your order (translator, notary or courier). Couriers see only delivery details, never your documents. Passwords and session tokens are stored as hashes, and a secure cookie keeps you signed in. Customers can create their own account or sign in with Google, Facebook or X when enabled; staff are invited by the administrator.'],
  ['Messages we send','We send order confirmations, quote copies, password-reset links and status updates by email, and by SMS or WhatsApp if you choose these channels in your personal information.'],
  ['Translation processing','When you run an AI translation, the source and relevant terminology are sent to the connected AI provider for extraction, translation and review. Requests disable response storage; this does not promise zero provider retention. Cancelling a job does not delete it.'],
  ['Uploaded files','Uploads are checked for format and for scripts or other active content, and files with such content are rejected. Use de-identified test files while the service is being configured.'],
  ['Before a customer launch','The operator must identify the legal business and privacy contact, define retention and deletion procedures, confirm processing agreements and replace this notice with an approved privacy policy. No compliance certification is claimed.'],
];
export default function Privacy(){const {t}=useT();return <><Header/><main className="legal-page"><span className="eyebrow">{t('PRIVACY NOTICE')}</span><h1>{t('Your documents.')}<br/>{t('Handled with care.')}</h1><p className="lead">{t('This notice explains what the ordering system stores and who can see it.')}</p>{sections.map(([h,p])=><section key={h}><h2>{t(h)}</h2><p>{t(p)}</p></section>)}<a href={appHref('/')||'/'} className="button secondary">{t('Back to Verba')}</a></main><Footer/></>;}

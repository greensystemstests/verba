import {Header,Footer} from '@/components/verba-ui';
import OrderForm from '@/components/order-form';
import ChatWidget from '@/components/chat';
import {serverT} from '@/lib/i18n-server';
export default async function Order(){const t=await serverT();return <><Header/><main className="home-main"><section className="intro"><div><span className="eyebrow">{t('SPECIALIST SERVICES')}</span><h1>{t('Need a little')}<br/><span>{t('more expertise?')}</span></h1><p>{t('Translation, notarization, validation and courier services, priced online.')}</p></div></section><OrderForm/></main><Footer/><ChatWidget/></>;}

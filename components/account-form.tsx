'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Loader2,KeyRound,Check,ArrowLeft,Copy,MailCheck} from 'lucide-react';
import {api,json,Field,CheckField,Brand} from './verba-ui';
import {useT,LanguageSwitch} from './i18n';
import Captcha from './captcha';
import {PhoneField,DialPick} from './fields';
type Mode='login'|'register'|'forgot'|'reset'|'verify'|'setup'|'recover';
type Status={user:{email:string}|null;providers:{id:string;label:string}[];captcha:string|null;emailReset:boolean;smsReset:boolean};
const errors:Record<string,string>={provider:'That sign-in option is not available.',state:'The sign-in session expired. Please try again.',cancelled:'Sign-in was cancelled.',email:'Your social account did not share a confirmed email address. Create an account with your email instead.',disabled:'This account is disabled. Contact customer service.',busy:'Too many attempts. Try again in a few minutes.',failed:'We could not complete the sign-in. Please try again.'};
export function strength(p:string){let s=0;if(p.length>=10)s++;if(p.length>=14)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^\w\s]/.test(p)||/\s/.test(p.trim()))s++;return p.length<10?0:Math.min(4,s);}
const strengthLabels=['Too short','Weak','Fair','Good','Strong'];
const looksLikePhone=(v:string)=>/^[+\d][\d\s()-]{5,}$/.test(v.trim());
export default function AccountForm(){
  const {t,lang}=useT();
  const [mode,setMode]=useState<Mode>('login');const [status,setStatus]=useState<Status|null>(null);
  const [identifier,setIdentifier]=useState('');const [prefix,setPrefix]=useState('+972');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [remember,setRemember]=useState(true);
  const [first,setFirst]=useState('');const [last,setLast]=useState('');const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [agreed,setAgreed]=useState(false);
  const [name,setName]=useState('');const [recoveryCode,setRecoveryCode]=useState('');const [savedCode,setSavedCode]=useState('');const [saved,setSaved]=useState(false);
  const [token,setToken]=useState('');const [captcha,setCaptcha]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [returnTo,setReturnTo]=useState('/');
  const onToken=useCallback((v:string)=>setCaptcha(v),[]);
  // Reads the address bar (return path, invitation or reset link) after hydration; it is not available on the server.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state read once on load
  useEffect(()=>{const url=new URL(location.href);const path=url.searchParams.get('return_to')||'/';let destination='/';try{const dest=new URL(path,location.origin);if(path.startsWith('/')&&!path.startsWith('//')&&dest.origin===location.origin&&!dest.pathname.startsWith('/account')){destination=dest.pathname+dest.search;setReturnTo(destination);}}catch{}
    const hash=new URLSearchParams(url.hash.slice(1));const invite=hash.get('invite'),reset=hash.get('reset'),verify=hash.get('verify'),err=hash.get('error');
    if(url.searchParams.get('mode')==='register')setMode('register');
    if(invite){setToken(invite);setMode('setup');}else if(reset){setToken(reset);setMode('reset');}else if(verify){setToken(verify);setMode('verify');}
    if(err)setError(t(errors[err]||errors.failed));
    if(url.hash)history.replaceState(null,'',url.pathname+url.search);
    api('/api/auth/status').then(r=>{setStatus(r as Status);if(r.user&&!invite&&!reset&&!verify)location.replace(destination);}).catch(e=>setError(e.message));
  },[t]);
  useEffect(()=>{if(mode!=='verify'||!token)return;api('/api/auth/verify',json({token})).then(()=>setNotice(t('Thank you. Your email address is confirmed.'))).catch(e=>setError(t(e.message)));},[mode,token,t]);
  const go=(m:Mode)=>{setMode(m);setError('');setNotice('');setPassword('');setConfirm('');};
  async function submit(e:React.FormEvent){e.preventDefault();setError('');setNotice('');
    if(['register','reset','setup','recover'].includes(mode)&&password!==confirm){setError(t('The passwords do not match.'));return;}
    if(mode==='register'&&strength(password)<1){setError(t('Use at least 10 characters.'));return;}
    setBusy(true);
    try{
      if(mode==='login'){await api('/api/auth/login',json({identifier,phonePrefix:prefix,password,remember}));location.assign(returnTo);return;}
      if(mode==='register'){const r=await api('/api/auth/register',json({firstName:first,lastName:last,email,phonePrefix:prefix,phone,password,agreed,captcha,language:lang,remember}));setPassword('');setConfirm('');if(r.recoveryCode){setSavedCode(String(r.recoveryCode));setSaved(false);}else location.assign(returnTo);return;}
      if(mode==='forgot'){const r=await api('/api/auth/forgot',json({identifier,phonePrefix:prefix,captcha}));setNotice(r.delivery?t('If an account exists for these details, we sent a link to reset your password. Check your email (and text messages if you used your phone number).'):t('Password reset by email is not available yet. Use the recovery code you saved when your account was created.'));if(!r.delivery)go('recover');return;}
      if(mode==='reset'){await api('/api/auth/reset',json({token,password}));location.assign(returnTo);return;}
      if(mode==='setup'){const r=await api('/api/auth/setup',json({name,password,invite:token}));setSavedCode(String(r.recoveryCode));setSaved(false);return;}
      if(mode==='recover'){const r=await api('/api/auth/recover',json({email:identifier,password,recoveryCode}));setSavedCode(String(r.recoveryCode));setSaved(false);return;}
    }catch(err){setError(t((err as Error).message));}finally{setBusy(false);}
  }
  const titles:Record<Mode,[string,string]>={login:['Welcome back.','Sign in to see your quotes, orders and documents.'],register:['Create your account.','Order translation and notary services, follow every step and keep your documents together.'],forgot:['Forgot your password?','Enter the email address or phone number of your account. We will send you a link to choose a new password.'],reset:['Choose a new password.','Enter a new password for your account.'],verify:['Confirming your email…',''],setup:['Make yourself at home.','Choose a password for your Verba workspace. Your existing projects stay connected to your account.'],recover:['Recover your account.','Use the recovery code you saved when creating your account.']};
  const score=strength(password);
  const social=status?.providers?.length&&['login','register'].includes(mode)?<div className="social-login">{status.providers.map(p=><a key={p.id} className={'social-button social-'+p.id} href={`/api/auth/oauth/${p.id}?return_to=${encodeURIComponent(returnTo)}`}>{t('Continue with {provider}',{provider:p.label})}</a>)}<div className="or-divider"><span>{t('or')}</span></div></div>:null;
  const passwordFields=<><Field label={mode==='login'?t('Password'):t('New password')}><input type="password" required autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></Field>
    {mode!=='login'&&<><div className={'strength strength-'+score} aria-live="polite"><span><i/><i/><i/><i/></span>{password&&t(strengthLabels[score])}</div><p className="fine-print">{t('Use at least 10 characters. A long, memorable passphrase works well.')}</p><Field label={t('Confirm password')}><input type="password" required autoComplete="new-password" minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></Field></>}</>;
  return <main className="account-page"><div className="account-top"><div className="account-brand"><Brand/></div><LanguageSwitch/></div><section className={'account-card'+(['login','register'].includes(mode)&&social?' with-social':'')}>{savedCode?<><span className="account-symbol"><KeyRound size={26}/></span><h1>{t('Keep your recovery code.')}</h1><p>{t('Save it in your password manager. You’ll need it to reset your password if email reset is unavailable. This code is shown once.')}</p><code className="recovery-code">{savedCode}</code><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(savedCode);}catch{setError(t('Select and copy the code manually.'));}}}><Copy size={16}/>{t('Copy recovery code')}</button><CheckField label={t('I saved my recovery code somewhere safe')} checked={saved} onChange={setSaved}/><button className="button primary" disabled={!saved} onClick={()=>location.assign(returnTo)}><Check size={17}/>{t('Continue to Verba')}</button></>
  :mode==='verify'?<><span className="account-symbol"><MailCheck size={26}/></span><h1>{notice?t('Email confirmed.'):error?t('Confirmation failed.'):t('Confirming your email…')}</h1>{notice&&<p>{notice}</p>}<a className="button primary" href="/studio">{t('Go to my workspace')}</a></>
  :<><span className="small-kicker">{t('YOUR VERBA ACCOUNT')}</span><h1>{t(titles[mode][0])}</h1>{titles[mode][1]&&<p>{t(titles[mode][1])}</p>}
    {social}
    <form onSubmit={submit}>
      {mode==='login'&&<><Field label={t('Email or phone number')}><input required autoComplete="username" value={identifier} maxLength={254} onChange={e=>setIdentifier(e.target.value)}/></Field>{looksLikePhone(identifier)&&!identifier.trim().startsWith('+')&&<DialPick prefix={prefix} onChange={setPrefix}/>}{passwordFields}<CheckField label={t('Remember me')} checked={remember} onChange={setRemember}>{t('Stay signed in on this device for 30 days.')}</CheckField></>}
      {mode==='register'&&<><div className="two-col"><Field label={t('First name')}><input required autoComplete="given-name" maxLength={60} value={first} onChange={e=>setFirst(e.target.value)}/></Field><Field label={t('Last name')}><input required autoComplete="family-name" maxLength={60} value={last} onChange={e=>setLast(e.target.value)}/></Field></div><Field label={t('Email address')}><input type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></Field><PhoneField label={t('Phone number')} prefix={prefix} number={phone} onChange={(p,n)=>{setPrefix(p);setPhone(n);}}/>{passwordFields}<CheckField label={t('I accept the service terms and privacy notice')} checked={agreed} onChange={setAgreed}><a href="/terms" target="_blank">{t('Read terms')}</a> · <a href="/privacy" target="_blank">{t('Privacy notice')}</a></CheckField><Captcha siteKey={status?.captcha} onToken={onToken}/></>}
      {mode==='forgot'&&<><Field label={t('Email or phone number')}><input required autoComplete="username" value={identifier} maxLength={254} onChange={e=>setIdentifier(e.target.value)}/></Field>{looksLikePhone(identifier)&&!identifier.trim().startsWith('+')&&<DialPick prefix={prefix} onChange={setPrefix}/>}<Captcha siteKey={status?.captcha} onToken={onToken}/></>}
      {mode==='setup'&&<><Field label={t('Your name')}><input autoComplete="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field>{passwordFields}</>}
      {mode==='reset'&&passwordFields}
      {mode==='recover'&&<><Field label={t('Email address')}><input type="email" required autoComplete="username" value={identifier} maxLength={254} onChange={e=>setIdentifier(e.target.value)}/></Field><Field label={t('Recovery code')}><input required autoComplete="off" value={recoveryCode} maxLength={64} onChange={e=>setRecoveryCode(e.target.value.trim())}/></Field>{passwordFields}</>}
      <button className="button primary" disabled={busy||(mode==='register'&&(!agreed||(!!status?.captcha&&!captcha)))||(mode==='forgot'&&!!status?.captcha&&!captcha)}>{busy?<><Loader2 className="spin" size={17}/>{t('Please wait…')}</>:t({login:'Sign in',register:'Create my account',forgot:'Send reset link',reset:'Save new password',verify:'',setup:'Create my account',recover:'Reset password'}[mode])}</button>
    </form>
    <div className="account-links">
      {mode==='login'&&<><button type="button" className="text-link" onClick={()=>go('forgot')}>{t('Forgot password?')}</button><span aria-hidden>·</span><button type="button" className="text-link" onClick={()=>go('register')}>{t('Sign up now')}</button></>}
      {mode==='register'&&<button type="button" className="text-link" onClick={()=>go('login')}>{t('Already have an account? Sign in')}</button>}
      {['forgot','recover','reset','setup'].includes(mode)&&<button type="button" className="text-link" onClick={()=>go('login')}>{t('Back to sign in')}</button>}
      {mode==='forgot'&&<button type="button" className="text-link" onClick={()=>go('recover')}>{t('I have a recovery code')}</button>}
    </div></>}
    {notice&&mode!=='verify'&&<div role="status" className="notice-box">{notice}</div>}
    {error&&<div role="alert" className="error-box">{error}</div>}
  </section><Link href="/" className="text-link back-link"><ArrowLeft size={14} className="flip-rtl"/>{t('Back to Verba')}</Link></main>;
}

'use client';
import {useMemo} from 'react';
import {Pick,Field} from './verba-ui';
import {useT} from './i18n';
import {countryOptions,dialCode,countryCodes,israelCities} from '@/lib/geo';
import {timeWindows,type Address} from '@/lib/catalog';

export function CountrySelect({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  const {lang}=useT();const options=useMemo(()=>countryOptions(lang),[lang]);
  return <Pick label={label} value={value||'IL'} onChange={onChange} options={options}/>;
}
const countryForPrefix=(prefix:string)=>prefix==='+972'?'IL':prefix==='+1'?'US':prefix==='+44'?'GB':countryCodes.find(c=>dialCode(c)===prefix)||'IL';
// Phone number with a country dialling code (spec: "prefix field + phone number").
export function PhoneField({label,prefix,number,onChange,required}:{label:string;prefix:string;number:string;onChange:(prefix:string,number:string)=>void;required?:boolean}){
  const {t,lang}=useT();
  const options=useMemo(()=>countryOptions(lang).map(c=>({value:c.value,label:`${c.label} ${dialCode(c.value)}`})),[lang]);
  return <div className="phone-field"><Pick label={t('Country code')} value={countryForPrefix(prefix)} onChange={c=>onChange(dialCode(c),number)} options={options}/><Field label={label}><input type="tel" inputMode="tel" dir="ltr" autoComplete="tel-national" required={required} maxLength={30} value={number} onChange={e=>onChange(prefix,e.target.value)} placeholder={prefix+' …'}/></Field></div>;
}
export function DialPick({prefix,onChange}:{prefix:string;onChange:(prefix:string)=>void}){
  const {t,lang}=useT();
  const options=useMemo(()=>countryOptions(lang).map(c=>({value:c.value,label:`${c.label} ${dialCode(c.value)}`})),[lang]);
  return <Pick label={t('Country code')} value={countryForPrefix(prefix)} onChange={c=>onChange(dialCode(c))} options={options}/>;
}
export function CityField({label,country,value,onChange}:{label:string;country:string;value:string;onChange:(v:string)=>void}){
  const {lang}=useT();
  if(country==='IL'){const options=israelCities.map(([en,he])=>({value:en,label:lang==='he'?he:en})).sort((a,b)=>a.label.localeCompare(b.label,lang));if(value&&!options.some(o=>o.value===value))options.unshift({value,label:value});return <Pick label={label} value={value||'choose'} onChange={v=>onChange(v==='choose'?'':v)} options={[...(value?[]:[{value:'choose',label:'—'}]),...options]}/>;}
  return <Field label={label}><input autoComplete="address-level2" maxLength={100} value={value} onChange={e=>onChange(e.target.value)}/></Field>;
}
// Structured address (spec 1.2: country and city lists, street, zip, contact phone, time range).
export function AddressFields({value,onChange,streets=[],showWindow=true,showContact=true,idPrefix}:{value:Address;onChange:(a:Address)=>void;streets?:string[];showWindow?:boolean;showContact?:boolean;idPrefix:string}){
  const {t}=useT();const set=(k:keyof Address,v:string)=>onChange({...value,[k]:v});
  return <div className="address-fields">
    <div className="two-col"><CountrySelect label={t('Country')} value={value.country} onChange={v=>onChange({...value,country:v,city:v===value.country?value.city:''})}/><CityField label={t('City')} country={value.country} value={value.city} onChange={v=>set('city',v)}/></div>
    <div className="address-grid"><Field label={t('Street')}><input list={idPrefix+'-streets'} autoComplete="address-line1" maxLength={200} value={value.street} onChange={e=>set('street',e.target.value)}/></Field><Field label={t('Number')}><input maxLength={20} value={value.number} onChange={e=>set('number',e.target.value)}/></Field><Field label={t('Floor')}><input inputMode="numeric" maxLength={20} value={value.floor} onChange={e=>set('floor',e.target.value)}/></Field><Field label={t('Apartment')}><input maxLength={20} value={value.apartment} onChange={e=>set('apartment',e.target.value)}/></Field><Field label={t('Postal code')}><input autoComplete="postal-code" inputMode="numeric" maxLength={30} value={value.postcode} onChange={e=>set('postcode',e.target.value)}/></Field></div>
    <datalist id={idPrefix+'-streets'}>{streets.map(s=><option key={s} value={s}/>)}</datalist>
    {showContact&&<div className="two-col"><Field label={t('Contact name')}><input autoComplete="name" maxLength={100} value={value.contact} onChange={e=>set('contact',e.target.value)}/></Field><PhoneField label={t('Contact phone')} prefix={value.phonePrefix} number={value.phone} onChange={(p,n)=>onChange({...value,phonePrefix:p,phone:n})}/></div>}
    <div className="two-col">{showWindow&&<Pick label={t('Time range')} value={value.window||'Any time'} onChange={v=>set('window',v)} options={timeWindows.map(w=>({value:w,label:t(w)}))}/>}<Field label={t('Remarks')}><input maxLength={500} value={value.notes} onChange={e=>set('notes',e.target.value)}/></Field></div>
  </div>;
}

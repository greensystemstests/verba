// Notification texts in the recipient's language (English wording is the key).
import type {T} from './i18n/core';
export type TemplateName='verify'|'reset'|'quote'|'order_submitted'|'order_admin'|'payment_received'|'status'|'inquiry_admin'|'chat_reply'|'chat_admin';
type Msg={subject:string;text:string;short:string;always?:boolean;emailOnly?:boolean};
export function template(name:TemplateName,v:Record<string,string|number>,t:T):Msg{
  const hello=t('Hello {name},',{name:String(v.name||'')});
  const sign='\n\n'+t('Verba customer service');
  switch(name){
    case 'verify':return {always:true,emailOnly:true,subject:t('Confirm your email address'),text:`${hello}\n\n${t('Confirm your email address for Verba by opening this link:')}\n${v.link}\n\n${t('The link is valid for 24 hours. If you did not create an account, ignore this message.')}${sign}`,short:''};
    case 'reset':return {always:true,subject:t('Reset your Verba password'),text:`${hello}\n\n${t('Open this link to choose a new password:')}\n${v.link}\n\n${t('The link is valid for one hour. If you did not ask to reset your password, ignore this message.')}${sign}`,short:t('Verba password reset link (valid for one hour): {link}',{link:String(v.link)})};
    case 'quote':return {always:true,emailOnly:true,subject:t('Your Verba quote {reference}',{reference:String(v.reference)}),text:`${hello}\n\n${t('Here is a copy of your quote.')}\n\n${v.summary}\n\n${t('Total: {total}',{total:String(v.total)})}\n\n${t('Open your quote: {link}',{link:String(v.link)})}${sign}`,short:''};
    case 'order_submitted':return {subject:t('We received your order {reference}',{reference:String(v.reference)}),text:`${hello}\n\n${t('Thank you. Your order {reference} was received and is being reviewed.',{reference:String(v.reference)})}\n\n${v.summary}\n\n${t('Total: {total}',{total:String(v.total)})}\n${t('Track your order: {link}',{link:String(v.link)})}${sign}`,short:t('Verba: order {reference} received. Total {total}. {link}',{reference:String(v.reference),total:String(v.total),link:String(v.link)})};
    case 'order_admin':return {always:true,emailOnly:true,subject:t('New order {reference}',{reference:String(v.reference)}),text:`${t('A new order was submitted.')}\n\n${v.summary}\n\n${t('Total: {total}',{total:String(v.total)})}\n${v.link}`,short:''};
    case 'payment_received':return {subject:t('Payment received for {reference}',{reference:String(v.reference)}),text:`${hello}\n\n${t('We received your payment for order {reference}. Work on your order continues.',{reference:String(v.reference)})}\n${v.link}${sign}`,short:t('Verba: payment received for {reference}.',{reference:String(v.reference)})};
    case 'status':return {subject:t('Order {reference}: {status}',{reference:String(v.reference),status:t(String(v.status))}),text:`${hello}\n\n${t('The status of your order {reference} is now: {status}.',{reference:String(v.reference),status:t(String(v.status))})}\n${v.link}${sign}`,short:t('Verba: order {reference} is now {status}.',{reference:String(v.reference),status:t(String(v.status))})};
    case 'inquiry_admin':return {always:true,emailOnly:true,subject:t('New inquiry: {subject}',{subject:String(v.subject)}),text:`${t('From: {name} <{email}>',{name:String(v.name),email:String(v.email)})}\n\n${v.body}\n\n${v.link}`,short:''};
    case 'chat_reply':return {subject:t('New message from Verba customer service'),text:`${hello}\n\n${v.body}\n\n${t('Reply here: {link}',{link:String(v.link)})}${sign}`,short:t('Verba customer service replied: {link}',{link:String(v.link)})};
    case 'chat_admin':return {always:true,emailOnly:true,subject:t('New chat message from {name}',{name:String(v.name)}),text:`${v.body}\n\n${v.link}`,short:''};
  }
}

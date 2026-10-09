import {getUser} from '@/lib/account';
import {failure} from '@/lib/server';
import {enabledProviders,oauthProviders} from '@/lib/oauth';
import {captchaSiteKey,captchaEnabled} from '@/lib/captcha';
import {providers} from '@/lib/notify';
// Public sign-in options plus the signed-in user, if any.
export async function GET(){try{const u=await getUser();return Response.json({user:u?{userId:u.userId,email:u.email,fullName:u.fullName,emailVerified:u.emailVerified,language:u.language}:null,setup:null,signup:true,providers:enabledProviders().map(id=>({id,label:oauthProviders[id].label})),captcha:captchaEnabled()?captchaSiteKey():null,emailReset:providers.email(),smsReset:providers.sms()},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}

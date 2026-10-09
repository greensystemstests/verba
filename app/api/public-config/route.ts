import {db,failure,primaryWorkspace} from '@/lib/server';
import {normalizePricing} from '@/lib/catalog';
import {withLiveRates} from '@/lib/rates';
import {captchaEnabled,captchaSiteKey} from '@/lib/captcha';
// Public settings for visitors: the company's price list (for live estimates) and security options.
export async function GET(){try{const id=await primaryWorkspace();const w=id?await db().prepare('SELECT pricing,config FROM workspaces WHERE id=?').bind(id).first<{pricing:string;config:string}>():null;let config:{liveRates?:boolean;bannerTitle?:string;bannerText?:string}={};try{config=JSON.parse(w?.config||'{}');}catch{}
  const pricing=await withLiveRates(normalizePricing(w?JSON.parse(w.pricing):{}),config.liveRates!==false);
  return Response.json({pricing,captcha:captchaEnabled()?captchaSiteKey():null,open:!!id,banner:{title:config.bannerTitle||'',text:config.bannerText||''}},{headers:{'Cache-Control':'public, max-age=300'}});}catch(e){return failure(e);}}

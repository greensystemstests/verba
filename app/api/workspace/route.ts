import {context,db,failure,admin,runtime,HttpError,customerKindFor} from '@/lib/server';
import {pricingSchema,addressSchema} from '@/lib/catalog';
import {withLiveRates} from '@/lib/rates';
import {providers} from '@/lib/notify';
import {captchaEnabled} from '@/lib/captcha';
import {enabledProviders} from '@/lib/oauth';
import {externalScannerEnabled} from '@/lib/doc-scan';
import {handoffEnabled} from '@/lib/handoff';
import {clearTextCache} from '@/lib/i18n-server';
import {z} from 'zod';
export async function GET(){try{const c=await context();const pricing=await withLiveRates(c.pricing,c.config.liveRates!==false);
  const members=c.staff?(await db().prepare('SELECT m.id,m.name,m.email,m.role,m.area,m.phone,m.address,m.business_number,m.active,(a.id IS NOT NULL) AS has_account FROM members m LEFT JOIN accounts a ON a.email=m.email WHERE m.workspace = ? ORDER BY m.name').bind(c.workspace.id).all()).results:[];
  return Response.json({user:{name:c.u.fullName||c.member.name,email:c.u.email,firstName:c.u.firstName,lastName:c.u.lastName,phone:c.u.phone,emailVerified:c.u.emailVerified,currency:c.u.currency,country:c.u.country,company:c.u.company},role:c.role,area:c.member.area,workspace:c.workspace.name,pricing,config:c.config,customerKind:await customerKindFor(c),members,
    connections:{translation:!!runtime().OPENAI_API_KEY,payments:false,email:providers.email(),sms:providers.sms(),whatsapp:providers.whatsapp(),captcha:captchaEnabled(),social:enabledProviders(),scanner:externalScannerEnabled(),mainSystem:handoffEnabled(),carriers:false,rates:'ratesDate' in pricing?pricing.ratesDate:null}},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
const config=z.object({notifyEmail:z.string().email().or(z.literal('')).default(''),officeAddress:addressSchema.partial().default({}),bannerTitle:z.string().max(120).default(''),bannerText:z.string().max(400).default(''),liveRates:z.boolean().default(true)});
export async function PATCH(r:Request){try{const c=await context(r);admin(c);const data=await r.json() as Record<string,unknown>;
  const parsed=pricingSchema.safeParse(data.pricing);if(!parsed.success)throw new HttpError(400,'Enter positive, valid prices and exchange rates');
  const cfg=config.safeParse(data.config??c.config);if(!cfg.success)throw new HttpError(400,'Check the workspace settings');
  await db().prepare('UPDATE workspaces SET pricing = ?, name = ?, config = ? WHERE id = ?').bind(JSON.stringify(parsed.data),String(data.name||c.workspace.name||'Verba workspace').slice(0,100),JSON.stringify(cfg.data),c.workspace.id).run();
  clearTextCache();return Response.json({ok:true});}catch(e){return failure(e);}}

import {context,failure,admin} from '@/lib/server';
import {deeplReady,usage,unsupportedLanguages} from '@/lib/deepl';
import {languages} from '@/lib/catalog';
export async function GET(){try{const c=await context();return Response.json({connected:deeplReady(),owner:c.admin,limits:{characters:20000,fileMB:10,dailyJobs:20},user:{name:c.u.displayName,email:c.u.email},role:c.member.role},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
// Administrators run a live connection test: DeepL character usage and the languages it cannot translate yet.
export async function POST(r:Request){try{const c=await context(r);admin(c);const u=await usage();const unsupported=await unsupportedLanguages(languages);return Response.json({ok:true,providerVerified:true,usage:u,unsupported});}catch(e){return failure(e);}}

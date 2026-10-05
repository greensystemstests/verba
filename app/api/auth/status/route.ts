import {getUser} from '@/lib/account';
import {failure} from '@/lib/server';
// Accounts are created only through administrator invitations (see scripts/create-admin-invite.mjs).
export async function GET(){try{return Response.json({user:await getUser(),setup:null},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}

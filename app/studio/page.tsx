import {requireUser} from '@/lib/account';
import Studio from '@/components/studio';
export const dynamic='force-dynamic';
export default async function StudioPage(){await requireUser('/studio');return <Studio/>;}

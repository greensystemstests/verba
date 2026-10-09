import {context,db,failure,staff} from '@/lib/server';
// Courier cards (spec 1.10): details plus total and open deliveries.
export async function GET(){try{const c=await context();staff(c);
  const rows=(await db().prepare(`SELECT m.id,m.name,m.email,m.area,m.phone,m.address,m.business_number,m.active,(a.id IS NOT NULL) AS has_account,
    (SELECT COUNT(*) FROM shipments s WHERE s.workspace=m.workspace AND (s.courier=m.email OR s.return_courier=m.email)) AS total,
    (SELECT COUNT(*) FROM shipments s WHERE s.workspace=m.workspace AND (s.courier=m.email OR s.return_courier=m.email) AND s.status NOT IN ('Delivered','Cancelled')) AS open
    FROM members m LEFT JOIN accounts a ON a.email=m.email WHERE m.workspace=? AND m.role='courier' ORDER BY m.active DESC, m.name`).bind(c.workspace.id).all()).results;
  return Response.json(rows);}catch(e){return failure(e);}}

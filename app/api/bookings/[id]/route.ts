import { admin, database, json, tenantSlug } from '@/lib/server';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  const token=new URL(request.url).searchParams.get('token');
  if (!token) return json({error:'Нет доступа'},403);
  const booking=await database().prepare('SELECT id,service_name as serviceName,wheel_size as wheelSize,starts_at as startsAt,status FROM bookings WHERE id=? AND tenant_slug=? AND cancel_token=?').bind(id,tenantSlug,token).first();
  return booking ? json({booking}) : json({error:'Запись не найдена'},404);
}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params; const body=await request.json() as {status?:string;cancelToken?:string};
  const isAdmin=Boolean(await admin(request));
  if (!isAdmin && !(body.status==='cancelled' && body.cancelToken)) return json({error:'Нет доступа'},403);
  if (!['confirmed','pending','cancelled'].includes(body.status||'')) return json({error:'Неверный статус'},400);
  const query=isAdmin?'UPDATE bookings SET status=? WHERE id=? AND tenant_slug=?':'UPDATE bookings SET status=? WHERE id=? AND tenant_slug=? AND cancel_token=?';
  const result=await database().prepare(query).bind(...(isAdmin?[body.status,id,tenantSlug]:[body.status,id,tenantSlug,body.cancelToken])).run();
  return result.meta.changes ? json({ok:true}) : json({error:'Запись не найдена'},404);
}

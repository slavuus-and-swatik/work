import { config, database, json, localIso, minutesTime, tenantSlug, timeMinutes, validDate } from '@/lib/server';
import { duration } from '@/lib/shinslot';
export async function GET(request:Request) {
  const p = new URL(request.url).searchParams;
  const date = p.get('date') || ''; const serviceId = p.get('service') || '';
  if (!validDate(date)) return json({error:'Неверная дата'},400);
  const c = await config(); const service = c.services.find(x=>x.id===serviceId && x.enabled);
  if (!service) return json({error:'Услуга недоступна'},400);
  const today = new Date(); const startDay = new Date(`${date}T00:00:00+03:00`);
  if (startDay.getTime() < Date.now() - 86400000 || startDay.getTime() > Date.now()+45*86400000) return json({slots:[]});
  if (!c.workDays.includes(new Date(`${date}T12:00:00+03:00`).getUTCDay()) || c.closedDates.includes(date)) return json({slots:[]});
  const bookings = await database().prepare('SELECT starts_at,ends_at,post FROM bookings WHERE tenant_slug=? AND starts_at >= ? AND starts_at < ? AND status != ?').bind(tenantSlug, localIso(date,'00:00'), localIso(date,'23:59'), 'cancelled').all<{starts_at:string;ends_at:string;post:number}>();
  const slots=[]; const length=duration(c,service);
  for(let m=timeMinutes(c.open);m+length<=timeMinutes(c.close);m+=30){
    const time=minutesTime(m), start=localIso(date,time), end=new Date(new Date(start).getTime()+length*60000).toISOString();
    if (new Date(start).getTime() < today.getTime()+30*60000) continue;
    let free=0;
    for(let post=1;post<=c.posts;post++) if(!bookings.results.some(b=>b.post===post && b.starts_at<end && b.ends_at>start)) free++;
    if(free>0) slots.push({time,free});
  }
  return json({slots});
}

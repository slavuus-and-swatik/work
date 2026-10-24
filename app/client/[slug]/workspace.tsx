"use client";
import SocialLinksEditor from "@/components/detailing/social-links-editor";
import BookingManager from "@/components/detailing/booking-manager";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, ExternalLink, ImagePlus, LogOut, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import DetailingSite from "@/components/detailing/site";
import { money, type DetailBooking, type DetailConfig } from "@/lib/detailing/model";
import "./workspace.css";

type ClientProject = { id: string; slug: string; clientName: string; draft: DetailConfig; version: number; publishedVersion: number | null };
async function api(action: string, method = "GET", data?: unknown) {
  const response = await fetch(`/api/client?action=${action}`, { method, headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить действие");
  return result;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="dc-field"><span>{label}</span>{children}</label>;
}
export default function ClientWorkspace({ slug, invite: initialInvite }: { slug: string; invite: string }) {
  const [invite, setInvite] = useState(initialInvite);
  const [ready, setReady] = useState(false), [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState(""), [repeat, setRepeat] = useState("");
  const [project, setProject] = useState<ClientProject | null>(null), [config, setConfig] = useState<DetailConfig | null>(null);
  const [tab, setTab] = useState("overview"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [orders, setOrders] = useState<DetailBooking[]>([]);
  const [ordersError, setOrdersError] = useState(""), [ordersUpdated, setOrdersUpdated] = useState("");
  const dirty = !!project && !!config && JSON.stringify(project.draft) !== JSON.stringify(config);
  useEffect(() => {
    const initialTab = new URLSearchParams(window.location.search).get("tab");
    if(initialTab && ["overview","services","content","settings","bookings"].includes(initialTab)) setTab(initialTab);
    const fragmentInvite = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (fragmentInvite && /^[\w-]{40,50}$/.test(fragmentInvite)) setInvite(fragmentInvite);
    api("session").then((v) => {
      if (v.authenticated && v.slug === slug) setAuthenticated(true);
    }).catch(() => setError("Сервер недоступен")).finally(() => setReady(true));
  }, [slug]);
  useEffect(() => {
    if (!authenticated) return;
    api("project").then((v) => {
      if (v.project.slug !== slug) throw new Error("Это кабинет другого проекта");
      setProject(v.project);
      setConfig(v.project.draft);
    }).catch((e) => setError(e.message));
  }, [authenticated, slug]);
  useEffect(() => {
    if (!authenticated) return;
    let current = true;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const value = await api("bookings");
        if (current) { setOrders(value.bookings); setOrdersError(""); setOrdersUpdated(new Date().toLocaleTimeString("ru-RU")); }
      } catch { if (current) setOrdersError("Не удалось обновить заявки. Список может быть устаревшим. Повторите проверку."); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [authenticated, slug]);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function set<K extends keyof DetailConfig>(key: K, value: DetailConfig[K]) { setConfig((c) => c ? { ...c, [key]: value } : c); }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось выполнить действие"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!project || !config) return;
    const v = await api("project", "PATCH", { version: project.version, config });
    setProject(v.project); setConfig(v.project.draft);
    setNotice("Черновик сохранён. Опубликуйте его, когда будете готовы.");
  }
  async function upload(file: File | undefined, done: (url: string) => void) {
    if (!file) return;
    await run(async () => {
      const form = new FormData(); form.append("file", file);
      const r = await fetch("/api/client?action=upload", { method: "POST", body: form });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      done(v.url); setNotice("Фото загружено. Сохраните изменения.");
    });
  }
  const text = (key: keyof DetailConfig, label: string, multi = false) => <Field label={label}>{multi ? <textarea value={String(config?.[key] || "")} onChange={(e) => set(key, e.target.value as never)} rows={key === "privacyText" ? 7 : 3} /> : <input value={String(config?.[key] || "")} onChange={(e) => set(key, e.target.value as never)} />}</Field>;
  const imageUpload = (label: string, done: (url: string) => void) => <label className="dc-upload"><ImagePlus size={18} />{label}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => void upload(e.target.files?.[0], done)} /></label>;
  if (!ready) return <main className="dc dc-loading">Открываем кабинет…</main>;
  if (!authenticated) return <main className="dc dc-access"><div className="dc-access-photo" /><form onSubmit={(e) => { e.preventDefault(); void run(async () => {
    if (invite && password !== repeat) throw new Error("Пароли не совпадают");
    await api(invite ? "activate" : "login", "POST", invite ? { slug, invite, password } : { slug, password });
    setPassword(""); setRepeat(""); setAuthenticated(true);
    if (invite) window.history.replaceState({}, "", `/client/${slug}`);
  }); }}><span className="dc-kicker">FORMA / КАБИНЕТ</span><h1>{invite ? "Ваша студия. Ваш контроль." : "Войти в кабинет"}</h1><p>{invite ? "Создайте пароль. После этого вы сможете самостоятельно менять сайт и управлять заявками." : "Управляйте сайтом, услугами и обращениями в одном месте."}</p><Field label={invite ? "Новый пароль · от 12 символов" : "Пароль"}><input type="password" minLength={invite ? 12 : undefined} autoComplete={invite ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>{invite && <Field label="Повторите пароль"><input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required /></Field>}<button className="dc-primary" disabled={busy}>{busy ? "Подождите…" : invite ? "Активировать кабинет" : "Войти"}<ArrowUpRight size={18} /></button>{error && <p className="dc-error" role="alert">{error}</p>}</form></main>;
  if (!project || !config) return <main className="dc dc-loading">{error || "Загружаем проект…"}</main>;
  return <main className="dc dc-app"><aside className="dc-sidebar"><a className="dc-logo" href={`/s/${slug}`} target="_blank">FORMA<span> / CLIENT</span></a><div className="dc-client-label">ВАШ ПРОЕКТ</div><strong className="dc-client-name">{project.clientName}</strong><nav aria-label="Разделы кабинета">{[["overview","Обзор"],["services","Услуги и цены"],["content","Тексты и фото"],["settings","Контакты и запись"],["bookings","Заявки"]].map(([id, label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav><a className="dc-site-link" href={`/s/${slug}`} target="_blank" rel="noreferrer">Открыть сайт <ExternalLink size={15} /></a><button className="dc-logout" onClick={() => void run(async () => { await api("session", "DELETE"); setAuthenticated(false); setProject(null); })}><LogOut size={16} /> Выйти</button></aside><section className="dc-main"><header className="dc-top"><div><span className="dc-kicker">САЙТ / {slug.toUpperCase()}</span><h1>{({overview:"Управление сайтом",services:"Услуги и цены",content:"Тексты и фотографии",settings:"Контакты и запись",bookings:"Заявки"} as Record<string,string>)[tab]}</h1></div><div className="dc-top-actions"><span className="dc-published">{project.publishedVersion === project.version ? "Опубликовано" : "Есть новый черновик"}</span><button className="dc-secondary" disabled={!dirty || busy} onClick={() => void run(save)}><Save size={15} /> Сохранить</button><button className="dc-primary" disabled={busy} onClick={() => void run(async () => { if (dirty) await save(); const current = await api("project"); const v = await api("publish", "POST", { version: current.project.version }); setProject(v.project); setConfig(v.project.draft); setNotice("Сайт обновлён. Изменения уже видны посетителям."); })}><UploadCloud size={16} /> Опубликовать</button></div></header>{(error || notice) && <p className={error ? "dc-banner error" : "dc-banner"} role={error ? "alert" : "status"}>{error || notice}</p>}<div className="dc-body">{ordersError && <p role="alert" className="dc-banner error">{ordersError}</p>}
  {tab === "overview" && <><div className="dc-welcome"><span className="dc-kicker">ПАНЕЛЬ УПРАВЛЕНИЯ</span><h2>Сайт и записи под контролем.</h2><p>Обновляйте содержание, цены и фотографии. Сначала сохраните черновик, затем опубликуйте — изменения появятся на сайте.</p><a href={`/s/${slug}`} target="_blank" rel="noreferrer">Посмотреть опубликованный сайт <ArrowUpRight size={16} /></a></div><div className="dc-stat-grid"><div><span>Услуги</span><strong>{config.services.length}</strong></div><div><span>Новые заявки</span><strong>{ordersError || !ordersUpdated ? "—" : orders.filter((x) => x.status === "pending" && !x.sandbox).length}</strong></div><div><span>Версия сайта</span><strong>{project.publishedVersion}</strong></div></div><div className="dc-preview"><span className="dc-kicker">ПРЕДПРОСМОТР ЧЕРНОВИКА</span><div><DetailingSite config={config} preview /></div></div></>}
  {tab === "services" && <div className="dc-panel"><p className="dc-intro">Добавляйте услуги, меняйте цены и фотографии. Карточки появятся на сайте после публикации.</p>{config.services.map((s, i) => <article className="dc-service-editor" key={s.id}><div className="dc-service-head"><strong>{String(i+1).padStart(2,"0")} / {s.name}</strong><button title="Удалить услугу" disabled={config.services.length === 1} onClick={() => set("services", config.services.filter((_,j) => j!==i))}><Trash2 size={16} /></button></div><div className="dc-service-layout"><div className="dc-service-photo">{s.image ? <img src={s.image} alt={s.name} /> : <span>Фото услуги</span>}{imageUpload(s.image ? "Заменить фотографию" : "Загрузить фотографию", (url) => set("services", config.services.map((x,j) => j===i ? {...x,image:url} : x)))}</div><div className="dc-service-fields"><Field label="Название"><input value={s.name} onChange={(e) => set("services",config.services.map((x,j)=>j===i?{...x,name:e.target.value}:x))} /></Field><Field label="Описание"><textarea rows={3} value={s.description} onChange={(e) => set("services",config.services.map((x,j)=>j===i?{...x,description:e.target.value}:x))} /></Field><div className="dc-row"><Field label="Цена от, ₽"><input type="number" min={0} value={s.price} onChange={(e) => set("services",config.services.map((x,j)=>j===i?{...x,price:Number(e.target.value)}:x))} /></Field><Field label="Длительность, мин"><input type="number" min={30} max={600} step={30} value={s.duration} onChange={(e) => set("services",config.services.map((x,j)=>j===i?{...x,duration:Number(e.target.value)}:x))} /></Field></div><span className="dc-price-preview">На сайте: от {money(s.price)}</span></div></div></article>)}<button className="dc-secondary" disabled={config.services.length>=12} onClick={() => set("services",[...config.services,{id:crypto.randomUUID(),name:"Новая услуга",description:"",image:"",price:0,duration:60}])}><Plus size={16} /> Добавить услугу</button></div>}
  {tab === "content" && <div className="dc-panel"><h2>Первый экран</h2>{text("name","Название студии")}{text("eyebrow","Надпись над заголовком")}{text("headline","Главный заголовок",true)}{text("description","Краткое описание",true)}<div className="dc-photo-row"><img src={config.hero} alt="Обложка" />{imageUpload("Заменить обложку", (url) => set("hero",url))}</div><div className="dc-divider" /><h2>О студии</h2>{text("aboutTitle","Заголовок",true)}{text("aboutText","Текст",true)}<div className="dc-divider" /><h2>Галерея работ</h2>{config.gallery.map((g,i)=><div className="dc-gallery-row" key={i}><img src={g.image} alt={g.caption} /><Field label="Подпись"><input value={g.caption} onChange={(e)=>set("gallery",config.gallery.map((x,j)=>j===i?{...x,caption:e.target.value}:x))}/></Field><button title="Удалить фото" onClick={()=>set("gallery",config.gallery.filter((_,j)=>j!==i))}><Trash2 size={17}/></button></div>)}{imageUpload("Добавить работу",(url)=>set("gallery",[...config.gallery,{image:url,caption:"Работа студии"}]))}<div className="dc-divider" /><h2>Вопросы и ответы</h2>{config.faqs.map((f,i)=><div className="dc-faq-edit" key={i}><Field label="Вопрос"><input value={f.question} onChange={(e)=>set("faqs",config.faqs.map((x,j)=>j===i?{...x,question:e.target.value}:x))}/></Field><Field label="Ответ"><textarea rows={3} value={f.answer} onChange={(e)=>set("faqs",config.faqs.map((x,j)=>j===i?{...x,answer:e.target.value}:x))}/></Field><button onClick={()=>set("faqs",config.faqs.filter((_,j)=>j!==i))}><Trash2 size={16}/> Удалить вопрос</button></div>)}<button className="dc-secondary" disabled={config.faqs.length>=8} onClick={()=>set("faqs",[...config.faqs,{question:"Новый вопрос",answer:"Ответ"}])}><Plus size={16}/> Добавить вопрос</button></div>}
  {tab === "settings" && <div className="dc-panel"><h2>Контакты и стиль</h2>{text("phone","Телефон")}{text("address","Адрес")}{text("city","Город")}{text("hoursLabel","Часы работы для посетителей")}<SocialLinksEditor value={config.socialLinks} telegram={config.telegram} onChange={value=>{set("socialLinks",value);set("telegram","");}}/>{config.logo && <img className="dc-logo-preview" src={config.logo} alt="Текущий логотип" />}{imageUpload("Загрузить логотип", (url) => set("logo", url))}{text("logo","Или укажите HTTPS-ссылку на логотип")}<Field label="Цвет акцента"><input type="color" value={config.accent} onChange={(e)=>set("accent",e.target.value)}/></Field><div className="dc-divider"/><h2>Онлайн-запись</h2><div className="dc-row"><Field label="Открытие, час"><input type="number" min={0} max={22} value={config.openHour} onChange={(e)=>set("openHour",Number(e.target.value))}/></Field><Field label="Закрытие, час"><input type="number" min={1} max={23} value={config.closeHour} onChange={(e)=>set("closeHour",Number(e.target.value))}/></Field><Field label="Одновременных постов"><input type="number" min={1} max={8} value={config.capacity} onChange={(e)=>set("capacity",Number(e.target.value))}/></Field></div><div className="dc-days">{["Вс","Пн","Вт","Ср","Чт","Пт","Сб"].map((day,i)=><button className={config.workDays.includes(i)?"active":""} key={day} aria-pressed={config.workDays.includes(i)} onClick={()=>set("workDays",config.workDays.includes(i)?config.workDays.filter((x)=>x!==i):[...config.workDays,i])}>{day}</button>)}</div><label className="dc-check"><input type="checkbox" checked={config.demo} onChange={(e)=>set("demo",e.target.checked)}/> Песочница — запись без личных данных</label><div className="dc-divider"/><h2>Юридическая информация</h2>{text("legalName","ИП / организация")}{text("privacyText","Условия обработки данных",true)}</div>}
  {tab === "bookings" && <div className="dc-panel"><p className="dc-intro">Новые обращения с сайта. Подтверждайте запись после связи с клиентом.<br/>{ordersUpdated ? `Данные на ${ordersUpdated}. Обновление каждые 15 секунд.` : "Загружаем список…"}</p><button className="dc-secondary" onClick={()=>void run(async()=>setOrders((await api("bookings")).bookings))}>Обновить список</button>{orders.length===0?<p className="dc-empty">{ordersError ? "Список временно недоступен" : !ordersUpdated ? "Загружаем заявки…" : "Заявок пока нет."}</p>:<BookingManager bookings={orders} onChange={b=>setOrders(xs=>xs.map(x=>x.id===b.id?b:x))} onRefresh={async()=>setOrders((await api("bookings")).bookings)}/>}</div>}
  </div></section></main>;
}

"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Database, Download, RefreshCw, ShieldCheck } from "lucide-react";
import "@/app/client/[slug]/workspace.css";
import "@/components/detailing/effects.css";

type State = { database: string; backup: { latest: { name: string; bytes: number; createdAt: string } | null; copies: number; stale: boolean; lastError: string | null; freeBytes: number; intervalHours: number } };
export default function Operations() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [checkedAt, setCheckedAt] = useState("");
  async function load(method = "GET") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/operations", { method });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setState(v); setCheckedAt(new Date().toLocaleString("ru-RU"));
    } catch (e) { setError(e instanceof Error ? e.message : "Проверка недоступна"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  const date = (value: string) => new Date(value).toLocaleString("ru-RU", {timeZone:"Europe/Moscow"}) + " МСК";
  return <main className="dc"><div className="dc-body" style={{margin:"0 auto", maxWidth:1100}}>
    <a href="/studio" className="dc-secondary"><ArrowLeft size={16}/> В студию</a>
    <header style={{margin:"38px 0"}}><span className="dc-kicker">FORMA / НАДЁЖНОСТЬ</span><h1 style={{fontSize:38, letterSpacing:"-.04em",marginTop:12}}>Хранилище и резервные копии</h1><p className="dc-intro" style={{marginTop:14}}>Состояние базы проверяется чтением и записью. Копии создаются после запуска и каждые 6 часов, затем проходят проверку целостности.</p></header>
    {error && <p role="alert" className="dc-banner error">{error}</p>}
    {state && <><div className="dc-stat-grid"><div><span><Database size={15}/> База данных</span><strong>{state.database === "ready" ? "Доступна" : "Проверить"}</strong></div><div><span>Проверенные копии</span><strong>{state.backup.copies}</strong></div><div><span>Свободно на томе</span><strong>{(state.backup.freeBytes / 1024 ** 3).toFixed(2)} ГБ</strong></div></div>
      <section className="dc-panel"><article className="dc-service-editor"><span className="dc-kicker"><ShieldCheck size={16}/> ПОСЛЕДНЯЯ КОПИЯ</span><h2 style={{margin:"16px 0"}}>{state.backup.latest ? date(state.backup.latest.createdAt) : "Копий пока нет"}</h2><p className="dc-intro">{state.backup.lastError || (state.backup.stale ? "Копия отсутствует или старше 12 часов. Создайте новую и проверьте причину." : "Копия прошла проверку SQLite и доступна для скачивания.")}</p><div className="dc-row"><button className="dc-primary" disabled={busy} onClick={() => void load("POST")}><RefreshCw size={16}/>{busy ? "Создаём и проверяем…" : "Создать копию сейчас"}</button>{state.backup.latest && <a className="dc-secondary" href="/api/operations?download=latest"><Download size={16}/> Скачать проверенную копию</a>}</div></article>
      <article className="dc-service-editor"><h2>Внешняя копия ещё не подключена</h2><p className="dc-intro" style={{marginTop:12}}>Эти снимки находятся на том же Railway-томе. Они помогают при ошибках приложения, но потеря тома затронет и их. Скачанную копию храните отдельно; перед платным запуском подключите автоматическую выгрузку во внешнее хранилище и мониторинг с уведомлениями.</p></article></section></>}
    <button className="dc-secondary" style={{marginTop:28}} disabled={busy} onClick={() => void load()}><RefreshCw size={15}/> Обновить проверку</button>
    <p className="dc-intro" style={{marginTop:12}}>Последняя проверка: {checkedAt || "выполняется…"}. Эта страница показывает результат проверки, пока она открыта.</p>
  </div></main>;
}

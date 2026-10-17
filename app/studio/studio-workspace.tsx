'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { presets, type Config, type PresetKey } from '@/lib/shinslot';

type Status = 'draft' | 'review' | 'approved' | 'revision_requested';
type Project = {
  id: string; clientName: string; clientEmail: string; references: string[]; templateKey: PresetKey;
  config: Config; status: Status; reviewToken: string | null; reviewComment: string; updatedAt: string;
};
const presetKeys = Object.keys(presets) as PresetKey[];
const statusLabels: Record<Status, string> = { draft: 'Черновик', review: 'На согласовании', approved: 'Согласовано', revision_requested: 'Нужны правки' };
const statusColors: Record<Status, string> = { draft: '#727b8d', review: '#956000', approved: '#117441', revision_requested: '#ae3b31' };

const css = `
.studio{min-height:100vh;background:#f3f5fa;color:#1c2434;padding:26px;font-family:system-ui,sans-serif}.studio *{box-sizing:border-box}.studio-shell{max-width:1250px;margin:auto}.studio-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}.studio-head h1{font-size:28px;margin:0}.studio-head p{margin:5px 0;color:#68748a}.studio-btn{border:0;border-radius:10px;background:#3156c8;color:white;padding:11px 15px;font-weight:650;cursor:pointer}.studio-btn:disabled{opacity:.55;cursor:wait}.studio-btn.secondary{background:#e8ecf4;color:#27344d}.studio-btn.ghost{background:#fff;color:#3156c8;border:1px solid #d4dbea}.studio-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.studio-card{background:white;border:1px solid #e0e5ef;border-radius:15px;padding:18px;box-shadow:0 8px 28px #19294a0a}.studio-list{display:flex;flex-direction:column;gap:9px;margin-top:14px}.studio-project{border:1px solid #e3e7ef;border-radius:11px;background:#fff;padding:12px;text-align:left;cursor:pointer;color:inherit}.studio-project.selected{border-color:#5674d4;box-shadow:0 0 0 2px #3156c81a}.studio-project strong{display:block;margin-bottom:5px}.studio-muted{color:#69758b;font-size:13px;line-height:1.5}.studio-badge{display:inline-block;border-radius:20px;background:#f4f5f8;padding:4px 8px;font-size:11px;font-weight:700;margin-top:7px}.studio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.studio-field label{display:block;font-size:12px;color:#69758b;margin-bottom:5px}.studio-field input,.studio-field select,.studio-field textarea{width:100%;border:1px solid #d5dce8;border-radius:9px;padding:10px 11px;font:inherit;color:#1c2434;background:#fff}.studio-field textarea{min-height:90px;resize:vertical}.studio-span{grid-column:1/-1}.studio-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.studio-alert{border-radius:10px;padding:12px 14px;margin:14px 0;font-size:13px;line-height:1.5;background:#fff6df;color:#72500a}.studio-preview{margin-top:16px;overflow:hidden;border-radius:13px;border:1px solid #e4e8ef}.studio-preview-image{height:160px;background:#e9edf4 center/cover}.studio-preview-body{padding:16px}.studio-auth{max-width:440px;margin:10vh auto}.studio-error{color:#b72d2d;font-size:13px}.studio-link{word-break:break-all;color:#3156c8}.studio-template{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0}.studio-template-item{padding:9px;border:1px solid #dfe4ed;border-radius:9px;background:#fff;text-align:left;cursor:pointer;font-size:12px}.studio-template-item.active{border-color:#3156c8;background:#f0f4ff;color:#2448b2;font-weight:700}
@media(max-width:800px){.studio{padding:15px}.studio-layout{grid-template-columns:1fr}.studio-grid{grid-template-columns:1fr}.studio-span{grid-column:auto}.studio-head h1{font-size:23px}}
`;

export default function StudioWorkspace() {
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [draftClient, setDraftClient] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftTemplate, setDraftTemplate] = useState<PresetKey>('shop');
  const [draftReferences, setDraftReferences] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = projects.find((project) => project.id === selectedId) || null;
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [references, setReferences] = useState('');
  const [siteName, setSiteName] = useState('');
  const [tagline, setTagline] = useState('');
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [heroUrl, setHeroUrl] = useState('');
  const [accentColor, setAccentColor] = useState('#3156c8');
  const [templateKey, setTemplateKey] = useState<PresetKey>('shop');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/studio/projects', { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось загрузить проекты');
    const data = await response.json() as { projects: Project[] };
    setProjects(data.projects);
    setSelectedId((current) => current || data.projects[0]?.id || '');
  }, []);

  useEffect(() => {
    fetch('/api/platform-admin/session', { cache: 'no-store' }).then((r) => r.json()).then((d: { authenticated?: boolean }) => setAuthenticated(Boolean(d.authenticated))).catch(() => setAuthenticated(false)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (authenticated) void load().catch((e) => setError(e.message)); }, [authenticated, load]);

  useEffect(() => {
    if (!selected) return;
    setClientName(selected.clientName); setClientEmail(selected.clientEmail); setReferences(selected.references.join('\n'));
    setSiteName(selected.config.name); setTagline(selected.config.tagline); setAbout(selected.config.aboutText);
    setPhone(selected.config.phone); setEmail(selected.config.email || ''); setHeroUrl(selected.config.heroUrl || '');
    setAccentColor(selected.config.accentColor || selected.config.primaryColor || '#3156c8'); setTemplateKey(selected.templateKey);
    setCopied(false);
  }, [selectedId, selected?.updatedAt]);

  const reviewHref = useMemo(() => selected?.reviewToken && typeof window !== 'undefined' ? `${window.location.origin}/approval/${selected.reviewToken}` : '', [selected?.reviewToken]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const response = await fetch('/api/platform-admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error || 'Не удалось войти'); return; }
    setAuthenticated(true); setPassword('');
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const response = await fetch('/api/studio/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientName: draftClient, clientEmail: draftEmail, templateKey: draftTemplate, references: draftReferences.split('\n').map((x) => x.trim()).filter(Boolean) }) });
    const result = await response.json() as { project?: Project; error?: string };
    setBusy(false);
    if (!response.ok || !result.project) { setError(result.error || 'Не удалось создать проект'); return; }
    setProjects((items) => [result.project!, ...items]); setSelectedId(result.project.id); setCreating(false);
    setDraftClient(''); setDraftEmail(''); setDraftReferences('');
  }

  function configBody() {
    return { name: siteName, tagline, aboutText: about, phone, email, heroUrl, accentColor };
  }

  async function save(action?: 'send_for_approval') {
    if (!selected) return;
    setBusy(true); setError('');
    const refs = references.split('\n').map((x) => x.trim()).filter(Boolean);
    const response = await fetch(`/api/studio/projects/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientName, clientEmail, references: refs, templateKey, config: configBody(), ...(action ? { action } : {}) }) });
    const result = await response.json() as { project?: Project; error?: string };
    setBusy(false);
    if (!response.ok || !result.project) { setError(result.error || 'Не удалось сохранить проект'); return; }
    setProjects((items) => items.map((item) => item.id === result.project!.id ? result.project! : item));
    setError(action ? 'Ссылка на согласование создана. Отправьте её клиенту.' : 'Черновик сохранён.');
  }

  async function switchTemplate(key: PresetKey) {
    if (!selected || !window.confirm('Сменить шаблон и заменить текущий текст и оформление настройками выбранной ниши?')) return;
    const cfg = structuredClone(presets[key]);
    const response = await fetch(`/api/studio/projects/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateKey: key }) });
    if (!response.ok) { setError('Не удалось сменить шаблон'); return; }
    setTemplateKey(key); setSiteName(cfg.name); setTagline(cfg.tagline); setAbout(cfg.aboutText); setPhone(cfg.phone); setEmail(cfg.email || ''); setHeroUrl(cfg.heroUrl || ''); setAccentColor(cfg.accentColor || cfg.primaryColor || '#3156c8');
    await load();
  }

  async function copyLink() {
    if (!reviewHref) return;
    await navigator.clipboard.writeText(reviewHref); setCopied(true);
  }

  if (!ready) return <main className="studio">Проверяем доступ…</main>;
  if (!authenticated) return <main className="studio"><style>{css}</style><form className="studio-card studio-auth" onSubmit={login}><small>АГЕНТСКАЯ СТУДИЯ</small><h1>Войдите в рабочее пространство</h1><p className="studio-muted">Используйте отдельный доступ команды платформы.</p><div className="studio-field"><label htmlFor="studio-password">Пароль команды</label><input id="studio-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div><button className="studio-btn" style={{ width: '100%', marginTop: 14 }}>Войти</button>{error && <p className="studio-error">{error}</p>}</form></main>;

  return <main className="studio"><style>{css}</style><div className="studio-shell">
    <header className="studio-head"><div><small>РАБОЧЕЕ ПРОСТРАНСТВО АГЕНТСТВА</small><h1>Проекты и согласования</h1><p>Подберите отраслевой шаблон, адаптируйте под клиента и отправьте ссылку на просмотр.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href="/platform-admin" className="studio-btn secondary" style={{ textDecoration: 'none' }}>Мониторинг платформы</Link><button className="studio-btn" onClick={() => setCreating((v) => !v)}>{creating ? 'Закрыть' : '+ Новый проект'}</button></div></header>
    <div className="studio-alert">Проекты пока сохраняются в памяти текущего процесса. Перед работой с реальными заказами подключите постоянную базу данных.</div>
    {creating && <form className="studio-card" onSubmit={createProject} style={{ marginBottom: 16 }}><h2 style={{ marginTop: 0 }}>Новый клиентский проект</h2><div className="studio-grid"><div className="studio-field"><label>Компания или клиент</label><input value={draftClient} onChange={(e) => setDraftClient(e.target.value)} required minLength={2} maxLength={140} /></div><div className="studio-field"><label>Почта клиента</label><input type="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} placeholder="Необязательно" /></div><div className="studio-field studio-span"><label>Выберите стартовый шаблон</label><select value={draftTemplate} onChange={(e) => setDraftTemplate(e.target.value as PresetKey)}>{presetKeys.map((key) => <option key={key} value={key}>{presets[key].nicheLabel}</option>)}</select></div><div className="studio-field studio-span"><label>Референсы — по одной ссылке на строку</label><textarea value={draftReferences} onChange={(e) => setDraftReferences(e.target.value)} placeholder="https://example.com\nhttps://instagram.com/..." /></div></div><button className="studio-btn" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Создаём…' : 'Создать проект'}</button></form>}
    <div className="studio-layout">
      <aside className="studio-card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Клиентские проекты</strong><span className="studio-muted">{projects.length}</span></div><div className="studio-list">{projects.map((project) => <button key={project.id} className={`studio-project ${project.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(project.id)}><strong>{project.clientName}</strong><span className="studio-muted">{project.config.nicheLabel}</span><br /><span className="studio-badge" style={{ color: statusColors[project.status] }}>{statusLabels[project.status]}</span></button>)}{!projects.length && <p className="studio-muted">Создайте первый проект для клиента.</p>}</div></aside>
      <section className="studio-card">{selected ? <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ margin: '0 0 4px' }}>{selected.clientName}</h2><span className="studio-badge" style={{ color: statusColors[selected.status] }}>{statusLabels[selected.status]}</span></div><span className="studio-muted">Обновлён {new Date(selected.updatedAt).toLocaleString('ru-RU')}</span></div>
        <div className="studio-field" style={{ marginTop: 16 }}><label>Шаблон и структура</label><div className="studio-template">{presetKeys.map((key) => <button key={key} type="button" className={`studio-template-item ${templateKey === key ? 'active' : ''}`} onClick={() => void switchTemplate(key)}>{presets[key].nicheLabel}</button>)}</div></div>
        <div className="studio-grid">
          <div className="studio-field"><label>Клиент</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div><div className="studio-field"><label>Почта клиента</label><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
          <div className="studio-field"><label>Название сайта</label><input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div><div className="studio-field"><label>Заголовок / слоган</label><input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
          <div className="studio-field studio-span"><label>Описание</label><textarea value={about} onChange={(e) => setAbout(e.target.value)} /></div>
          <div className="studio-field"><label>Телефон сайта</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div><div className="studio-field"><label>Почта сайта</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="studio-field studio-span"><label>Фото первого экрана (HTTPS URL)</label><input value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://..." /></div>
          <div className="studio-field"><label>Акцентный цвет</label><input type="color" value={/^#[\da-f]{6}$/i.test(accentColor) ? accentColor : '#3156c8'} onChange={(e) => setAccentColor(e.target.value)} /></div>
          <div className="studio-field"><label>Цвет в HEX</label><input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} /></div>
          <div className="studio-field studio-span"><label>Ссылки на референсы — по одной на строку</label><textarea value={references} onChange={(e) => setReferences(e.target.value)} /></div>
        </div>
        {selected.reviewComment && <div className="studio-alert"><strong>Ответ клиента:</strong> {selected.reviewComment}</div>}
        {selected.references.length > 0 && <div className="studio-muted" style={{ marginTop: 14 }}>Референсы: {selected.references.map((url, i) => <span key={url}>{i > 0 ? ' · ' : ''}<a href={url} target="_blank" rel="noreferrer">ссылка {i + 1}</a></span>)}</div>}
        {siteName && <div className="studio-preview"><div className="studio-preview-image" style={{ backgroundImage: heroUrl ? `url("${heroUrl.replaceAll('"', '')}")` : undefined }} /><div className="studio-preview-body" style={{ borderTop: `4px solid ${accentColor}` }}><small>{selected.config.nicheLabel}</small><h2 style={{ margin: '5px 0' }}>{siteName}</h2><p>{tagline}</p><div className="studio-muted">{about}</div></div></div>}
        <div className="studio-actions"><button className="studio-btn secondary" disabled={busy} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить черновик'}</button><button className="studio-btn" disabled={busy} onClick={() => void save('send_for_approval')}>Отправить на согласование</button></div>
        {reviewHref && <div className="studio-alert"><strong>Ссылка клиенту:</strong><br /><a className="studio-link" href={reviewHref} target="_blank" rel="noreferrer">{reviewHref}</a><div className="studio-actions"><button type="button" className="studio-btn ghost" onClick={() => void copyLink()}>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</button></div></div>}
      </> : <div><h2>Начните с проекта</h2><p className="studio-muted">Создайте проект, выберите один из 12 шаблонов и сохраните референсы клиента.</p></div>}{error && <p className="studio-muted" role="status">{error}</p>}</section>
    </div>
  </div></main>;
}

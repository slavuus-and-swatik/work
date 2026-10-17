'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Overview = {
  storage: string;
  uptimeSeconds: number;
  totals: { companies: number; bookings: number; orders: number };
  companies: Array<{
    slug: string; ownerId: string | null; name: string; email: string | null; phone: string | null;
    siteMode: string; updatedAt: string; hasDraftChanges: boolean; configurationComplete: boolean;
    bookings: number; orders: number;
  }>;
};

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f4f6fb', color: '#182033', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' },
  shell: { maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 24 },
  card: { background: '#fff', border: '1px solid #e1e6ef', borderRadius: 16, padding: 22, boxShadow: '0 8px 28px #19294a0b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, margin: '18px 0' },
  label: { fontSize: 13, color: '#64708a', marginBottom: 8 },
  value: { fontSize: 25, fontWeight: 700 },
  input: { display: 'block', width: '100%', padding: '13px 14px', border: '1px solid #cbd3e0', borderRadius: 10, margin: '10px 0 14px', fontSize: 16, boxSizing: 'border-box' },
  button: { padding: '11px 16px', border: 0, borderRadius: 10, background: '#3156c8', color: 'white', fontWeight: 650, cursor: 'pointer' },
  muted: { color: '#65708a', fontSize: 14, lineHeight: 1.5 },
  tableWrap: { overflowX: 'auto', marginTop: 14 },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: 720, textAlign: 'left' },
  th: { color: '#6c7690', fontSize: 12, fontWeight: 650, textTransform: 'uppercase', padding: '12px 10px', borderBottom: '1px solid #e5e9f1' },
  td: { padding: '14px 10px', borderBottom: '1px solid #edf0f5', verticalAlign: 'top', fontSize: 14 },
};

function prettyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

export default function PlatformAdmin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lockedFor, setLockedFor] = useState(0);
  const [data, setData] = useState<Overview | null>(null);

  const loadOverview = useCallback(async () => {
    const response = await fetch('/api/platform-admin/overview', { cache: 'no-store' });
    if (response.ok) setData(await response.json() as Overview);
  }, []);

  useEffect(() => {
    fetch('/api/platform-admin/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result: { authenticated?: boolean }) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => { if (authenticated) void loadOverview(); }, [authenticated, loadOverview]);
  useEffect(() => {
    if (!lockedFor) return;
    const timer = window.setInterval(() => setLockedFor((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lockedFor > 0]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (lockedFor) return;
    setError('Проверяем пароль…');
    try {
      const response = await fetch('/api/platform-admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string; attemptsLeft?: number; blockedForSeconds?: number };
      if (!response.ok) {
        if (result.blockedForSeconds) setLockedFor(result.blockedForSeconds);
        setError(result.blockedForSeconds ? 'Вход временно заблокирован' : `${result.error || 'Не удалось войти'}${result.attemptsLeft ? `. Осталось попыток: ${result.attemptsLeft}` : ''}`);
        return;
      }
      setAuthenticated(true); setPassword(''); setError('');
    } catch { setError('Не удалось связаться с сервером.'); }
  }

  async function signOut() {
    await fetch('/api/platform-admin/session', { method: 'DELETE' });
    setAuthenticated(false); setData(null);
  }

  if (!ready) return <main style={styles.page}><div style={styles.shell}>Проверяем доступ…</div></main>;
  if (!authenticated) return <main style={styles.page}><section style={{ ...styles.card, maxWidth: 430, margin: '10vh auto' }}>
    <div style={{ color: '#3156c8', fontWeight: 700, marginBottom: 12 }}>КОМАНДА ПЛАТФОРМЫ</div>
    <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Внутренняя панель</h1>
    <p style={styles.muted}>Отдельный вход для поддержки и эксплуатации платформы. Доступ продавца сюда не подходит.</p>
    <form onSubmit={signIn}>
      <label htmlFor="ops-password" style={styles.label}>Пароль оператора</label>
      <input id="ops-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={styles.input} />
      <button type="submit" disabled={lockedFor > 0} style={{ ...styles.button, width: '100%', opacity: lockedFor ? .6 : 1 }}>{lockedFor ? `Подождите ${Math.floor(lockedFor / 60)}:${String(lockedFor % 60).padStart(2, '0')}` : 'Войти'}</button>
    </form>
    {error && <p role="alert" style={{ color: '#bd3030', fontSize: 14 }}>{error}</p>}
  </section></main>;

  return <main style={styles.page}><div style={styles.shell}>
    <header style={styles.header}>
      <div><div style={{ color: '#3156c8', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>ВНУТРЕННЯЯ ПАНЕЛЬ</div><h1 style={{ margin: '5px 0', fontSize: 28 }}>Работоспособность платформы</h1><div style={styles.muted}>Поддержка и эксплуатация · отдельная роль от владельцев магазинов</div></div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}><Link href="/studio" style={{ ...styles.button, textDecoration: 'none' }}>Агентская студия</Link><button type="button" onClick={signOut} style={{ ...styles.button, background: '#e8ecf4', color: '#25304a' }}>Выйти</button></div>
    </header>
    {data ? <>
      <div style={styles.grid}>
        <section style={styles.card}><div style={styles.label}>Компании в текущем хранилище</div><div style={styles.value}>{data.totals.companies}</div></section>
        <section style={styles.card}><div style={styles.label}>Заказы</div><div style={styles.value}>{data.totals.orders}</div></section>
        <section style={styles.card}><div style={styles.label}>Записи на услуги</div><div style={styles.value}>{data.totals.bookings}</div></section>
        <section style={styles.card}><div style={styles.label}>Состояние процесса</div><div style={{ ...styles.value, fontSize: 18, color: '#16824a' }}>Работает</div><div style={styles.muted}>Время работы: {Math.floor(data.uptimeSeconds / 3600)} ч {Math.floor((data.uptimeSeconds % 3600) / 60)} мин</div></section>
      </div>
      <section style={styles.card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Компании</h2>
        <p style={styles.muted}>Сводка без персональных данных покупателей и секретов магазина. Здесь показаны только записи, существующие в текущем хранилище.</p>
        <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Компания</th><th style={styles.th}>Владелец</th><th style={styles.th}>Активность</th><th style={styles.th}>Настройка</th><th style={styles.th}>Обновлено</th></tr></thead><tbody>
          {data.companies.map((company) => <tr key={company.slug}>
            <td style={styles.td}><strong>{company.name}</strong><div style={styles.muted}>{company.slug} · {company.siteMode}</div><div style={styles.muted}>{company.email || 'почта не указана'} · {company.phone || 'телефон не указан'}</div></td>
            <td style={styles.td}>{company.ownerId || 'не привязан'}</td>
            <td style={styles.td}>{company.orders} заказов<br />{company.bookings} записей</td>
            <td style={styles.td}>{company.configurationComplete ? 'Основные поля заполнены' : 'Нужна проверка'}{company.hasDraftChanges && <div style={{ color: '#a56500' }}>Есть неопубликованные изменения</div>}</td>
            <td style={styles.td}>{prettyDate(company.updatedAt)}</td>
          </tr>)}
          {!data.companies.length && <tr><td colSpan={5} style={styles.td}>Компаний пока нет</td></tr>}
        </tbody></table></div>
        <div style={{ ...styles.muted, marginTop: 18, padding: 14, borderRadius: 10, background: '#fff7e7' }}><strong>Хранилище:</strong> {data.storage}. Данные демо-хранилища существуют только пока работает процесс приложения. Для настоящего управления компаниями подключите постоянную БД и отдельные учетные записи владельцев.</div>
        <button type="button" onClick={() => void loadOverview()} style={{ ...styles.button, marginTop: 16 }}>Обновить сводку</button>
      </section>
    </> : <section style={styles.card}>Не удалось загрузить состояние. Обновите страницу или проверьте сервер.</section>}
  </div></main>;
}

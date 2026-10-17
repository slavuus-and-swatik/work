'use client';

import { useEffect, useState } from 'react';
import type { Config } from '@/lib/shinslot';

type Review = { clientName: string; references: string[]; status: string; reviewComment: string; templateName: string; config: Config };
const statusLabels: Record<string, string> = { review: 'Ожидает вашего решения', approved: 'Вы уже согласовали этот вариант', revision_requested: 'Вы запросили изменения', draft: 'Ссылка больше не активна' };

export default function ApprovalPage({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    fetch(`/api/approval/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { project?: Review; error?: string };
        if (!response.ok || !body.project) throw new Error(body.error || 'Ссылка не найдена');
        setReview(body.project);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function decide(decision: 'approved' | 'revision_requested') {
    if (decision === 'revision_requested' && !comment.trim()) { setError('Опишите, пожалуйста, какие изменения нужны.'); return; }
    setBusy(true); setError('');
    const response = await fetch(`/api/approval/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment }) });
    const body = await response.json() as { project?: Review; error?: string };
    setBusy(false);
    if (!response.ok || !body.project) { setError(body.error || 'Не удалось отправить ответ'); return; }
    setReview(body.project); setDone(decision === 'approved' ? 'Спасибо! Вариант отмечен как согласованный.' : 'Спасибо! Комментарий отправлен команде.');
  }

  const config = review?.config;
  return <main style={{ minHeight: '100vh', padding: '24px 16px 50px', background: '#f2f4f8', color: '#182033', fontFamily: 'system-ui,sans-serif' }}>
    <div style={{ maxWidth: 940, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}><div><small style={{ color: '#68748a' }}>ВАРИАНТ ДИЗАЙНА ДЛЯ СОГЛАСОВАНИЯ</small><h1 style={{ fontSize: 26, margin: '3px 0' }}>{config?.name || 'Сайт клиента'}</h1></div>{review && <span style={{ borderRadius: 30, background: '#fff', padding: '8px 12px', fontSize: 13 }}>{statusLabels[review.status] || review.status}</span>}</header>
      {error && !review ? <section style={{ background: 'white', borderRadius: 14, padding: 24 }}>{error}</section> : config ? <>
        <section style={{ overflow: 'hidden', borderRadius: 18, background: 'white', boxShadow: '0 12px 35px #1b2d5214' }}>
          <div style={{ height: 'clamp(220px, 38vw, 390px)', background: config.heroUrl ? `linear-gradient(90deg,#111a 0%,#1112 100%),url("${config.heroUrl.replaceAll('"', '')}") center/cover` : `linear-gradient(135deg,${config.accentColor || config.primaryColor || '#3156c8'},#1c2340)` }} />
          <div style={{ padding: 'clamp(20px,5vw,48px)', borderTop: `5px solid ${config.accentColor || config.primaryColor || '#3156c8'}` }}>
            <small style={{ color: config.accentColor || '#3156c8', fontWeight: 700 }}>{review?.templateName}</small><h2 style={{ fontSize: 'clamp(30px,6vw,54px)', margin: '12px 0' }}>{config.name}</h2><h3 style={{ fontWeight: 500, color: '#59657a', margin: '0 0 18px' }}>{config.tagline}</h3><p style={{ maxWidth: 680, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{config.aboutText}</p><p style={{ color: '#69758b' }}>{config.phone}{config.email ? ` · ${config.email}` : ''}</p>
          </div>
        </section>
        <section style={{ background: 'white', borderRadius: 16, padding: '22px clamp(18px,4vw,34px)', marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Что входит в выбранный шаблон</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {config.services.filter((item) => item.enabled).slice(0, 6).map((item) => <article key={item.id} style={{ border: '1px solid #e4e8ef', borderRadius: 12, padding: 14 }}><strong>{item.name}</strong><p style={{ color: '#68748a', fontSize: 13 }}>{item.description}</p><b>{item.price.toLocaleString('ru-RU')} ₽</b></article>)}
          {config.products.filter((item) => item.enabled).slice(0, 6).map((item) => <article key={item.id} style={{ border: '1px solid #e4e8ef', borderRadius: 12, padding: 14 }}><strong>{item.name}</strong><p style={{ color: '#68748a', fontSize: 13 }}>{item.description}</p><b>{item.price.toLocaleString('ru-RU')} ₽</b></article>)}
        </div></section>
        {review?.references.length ? <section style={{ background: 'white', borderRadius: 16, padding: 22, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Ваши референсы</h2><ul>{review.references.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></section> : null}
        <section style={{ background: 'white', borderRadius: 16, padding: 22, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Ваш ответ</h2><p style={{ color: '#68748a' }}>Проверьте тексты, оформление и состав сайта. Если нужны изменения, опишите их комментарием.</p><label htmlFor="review-comment" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Комментарий</label><textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Например: заменить фото первого экрана и поменять заголовок…" style={{ width: '100%', minHeight: 100, borderRadius: 10, border: '1px solid #d5dce8', padding: 12, font: 'inherit', boxSizing: 'border-box' }} />
          {done && <p role="status" style={{ color: '#117441' }}>{done}</p>}{error && <p role="alert" style={{ color: '#b72d2d' }}>{error}</p>}
          {review?.status === 'review' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}><button type="button" disabled={busy} onClick={() => void decide('approved')} style={{ border: 0, borderRadius: 10, background: '#117441', color: 'white', padding: '12px 16px', fontWeight: 700 }}>Согласовать</button><button type="button" disabled={busy} onClick={() => void decide('revision_requested')} style={{ border: '1px solid #d5dce8', borderRadius: 10, background: 'white', color: '#27344d', padding: '12px 16px', fontWeight: 700 }}>Нужны правки</button></div>}
          {review?.status === 'revision_requested' && review.reviewComment && <p>Ваш прошлый комментарий: {review.reviewComment}</p>}
        </section>
      </> : <section style={{ background: 'white', borderRadius: 14, padding: 24 }}>Загружаем вариант на согласование…</section>}
    </div>
  </main>;
}

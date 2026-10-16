'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Config, Product } from '@/lib/shinslot';
import { calculateDeliveryForProduct } from '@/lib/commerce';
import { money } from '@/lib/shinslot';

export default function ProductDetail({ productId }: { productId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/config').then((r) => r.ok ? r.json() : Promise.reject()).then((d: { config: Config }) => setConfig(d.config)).catch(() => setConfig(null));
    try {
      const items = JSON.parse(localStorage.getItem('shinslot-cart-items') || '[]');
      if (Array.isArray(items)) setCartCount(items.reduce((n, x) => n + Math.max(0, Number(x.quantity) || 0), 0));
    } catch { /* Ignore invalid local cart data. */ }
  }, []);
  const product = useMemo(() => config?.products.find((item) => item.id === productId), [config, productId]);
  const images = useMemo(() => product ? [...new Set([product.imageUrl, ...(product.galleryImages || [])].filter(Boolean))] : [], [product]);
  const navigate = useCallback((delta: number) => {
    if (!images.length) return;
    setActiveImage((index) => (index + delta + images.length) % images.length);
    setZoomed(false);
  }, [images.length]);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowLeft') navigate(-1);
      if (event.key === 'ArrowRight') navigate(1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox, navigate]);
  function addToCart(item: Product) {
    try {
      const cart = JSON.parse(localStorage.getItem('shinslot-cart-items') || '[]');
      const existing = Array.isArray(cart) ? cart.find((line) => line?.product?.id === item.id) : undefined;
      const next = Array.isArray(cart) ? cart.map((line) => line?.product?.id === item.id ? { ...line, quantity: (Number(line.quantity) || 0) + 1 } : line) : [];
      if (!existing) next.push({ product: item, quantity: 1 });
      localStorage.setItem('shinslot-cart-items', JSON.stringify(next));
      setCartCount((count) => count + 1);
    } catch { /* Surface the detail page even when local storage is unavailable. */ }
  }

  if (!config) return <main className="product-detail-shell"><p role="status">Загружаем товар…</p></main>;
  if (!product || !product.enabled) return <main className="product-detail-shell"><Link className="product-back" href="/"><ArrowLeft size={16} /> Назад в каталог</Link><h1>Товар не найден</h1></main>;
  return <main className={`site theme-${config.theme || 'navy'} product-detail-shell`}>
    <Link className="product-back" href="/"><ArrowLeft size={16} /> Назад в каталог</Link>
    {cartCount > 0 && <Link href="/#catalog" className="product-cart-link">В корзине: {cartCount}</Link>}
    <div className="product-detail-grid">
      <section className="product-gallery" aria-label="Фотографии товара">
        <button type="button" className="product-gallery-main" onClick={() => setLightbox(true)} aria-label="Открыть фото на весь экран">
          {images[activeImage] ? <img src={images[activeImage]} alt={product.name} /> : <div className="product-no-image">Фото пока нет</div>}
        </button>
        {images.length > 1 && <div className="product-thumbnails">{images.map((image, index) => <button key={`${image}-${index}`} type="button" className={activeImage === index ? 'active' : ''} onClick={() => setActiveImage(index)} aria-label={`Фото ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
      </section>
      <section className="product-detail-copy">
        {product.category && <span className="product-category-tag">{product.category}</span>}
        <h1>{product.name}</h1>
        {product.productType && <div className="product-type-label">Тип: {product.productType}</div>}
        <p className="product-detail-price">{money(product.price)} {product.oldPrice && product.oldPrice > product.price && <del>{money(product.oldPrice)}</del>}</p>
        <p className="product-detail-shipping">Доставка одной штуки: {calculateDeliveryForProduct(config, product) ? money(calculateDeliveryForProduct(config, product)) : 'бесплатно'}</p>
        <p className="product-detail-description">{product.description}</p>
        {product.attributes?.filter((item) => item.label.trim() && item.value.trim()).length ? <><h2>Характеристики</h2><dl className="product-attributes">{product.attributes.filter((item) => item.label.trim() && item.value.trim()).map((item, i) => <div key={`${item.label}-${i}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></> : null}
        <button type="button" className="product-add-btn product-detail-add" disabled={!product.inStock} onClick={() => addToCart(product)}>{product.inStock ? 'Добавить в корзину' : 'Нет в наличии'}</button>
      </section>
    </div>
    {lightbox && <div className="product-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр фотографий" onClick={() => setLightbox(false)} onTouchStart={(event) => setStartX(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => { if (startX !== null && Math.abs(event.changedTouches[0].clientX - startX) > 45) navigate(event.changedTouches[0].clientX < startX ? 1 : -1); setStartX(null); }}>
      <button type="button" className="product-lightbox-close" aria-label="Закрыть" onClick={() => setLightbox(false)}><X /></button>
      {images.length > 1 && <button type="button" className="product-lightbox-arrow previous" aria-label="Предыдущее фото" onClick={(event) => { event.stopPropagation(); navigate(-1); }}><ChevronLeft /></button>}
      <div className={`product-lightbox-image ${zoomed ? 'zoomed' : ''}`} onClick={(event) => { event.stopPropagation(); setZoomed((value) => !value); }}><img src={images[activeImage]} alt={`${product.name}, фото ${activeImage + 1}`} /></div>
      {images.length > 1 && <button type="button" className="product-lightbox-arrow next" aria-label="Следующее фото" onClick={(event) => { event.stopPropagation(); navigate(1); }}><ChevronRight /></button>}
      <span className="product-lightbox-counter">{activeImage + 1} / {images.length} · нажмите на фото для увеличения</span>
    </div>}
  </main>;
}

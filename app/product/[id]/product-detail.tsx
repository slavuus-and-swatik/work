'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Config, Product } from '@/lib/shinslot';
import { calculateDeliveryForProduct } from '@/lib/commerce';
import { money } from '@/lib/shinslot';
import { CART_UPDATED_EVENT, readStoredCart, writeStoredCart } from '@/lib/cart-client';
import { CartQuantityControl } from '@/components/cart-quantity-control';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

export default function ProductDetail({ productId }: { productId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [productQuantity, setProductQuantity] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/config').then((r) => r.ok ? r.json() : Promise.reject()).then((d: { config: Config }) => setConfig(d.config)).catch(() => setConfig(null));
    const syncCart = () => {
      const items = readStoredCart();
      setCartCount(items.reduce((total, line) => total + line.quantity, 0));
      setProductQuantity(items.find((line) => line.product.id === productId)?.quantity || 0);
    };
    syncCart();
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener('storage', syncCart);
    return () => { window.removeEventListener(CART_UPDATED_EVENT, syncCart); window.removeEventListener('storage', syncCart); };
  }, [productId]);
  const product = useMemo(() => config?.products.find((item) => item.id === productId), [config, productId]);
  const images = useMemo(() => product ? [...new Set([product.imageUrl, ...(product.galleryImages || [])].filter(Boolean))] : [], [product]);
  const relatedProducts = useMemo(() => product ? (config?.products || []).filter((item) => item.enabled && item.id !== product.id && ((product.category && item.category === product.category) || (product.productType && item.productType === product.productType))).slice(0, 8) : [], [config, product]);
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
  function changeCart(item: Product, delta: number) {
    const cart = readStoredCart();
    const current = cart.find((line) => line.product.id === item.id)?.quantity || 0;
    const cap = Math.max(0, Math.min(99, item.stockQuantity ?? 99));
    const nextQuantity = Math.max(0, Math.min(cap, current + delta));
    const next = nextQuantity === 0
      ? cart.filter((line) => line.product.id !== item.id)
      : cart.some((line) => line.product.id === item.id)
        ? cart.map((line) => line.product.id === item.id ? { product: item, quantity: nextQuantity } : line)
        : [...cart, { product: item, quantity: nextQuantity }];
    writeStoredCart(next);
    if (delta > 0 && nextQuantity > current) toast.success('Добавлено в корзину');
  }

  if (!config) return <main className="product-detail-shell"><p role="status"><Spinner /> Загружаем товар…</p></main>;
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
        {product.details?.advantages?.length ? <><h2>Преимущества</h2><ul className="product-detail-list">{product.details.advantages.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul></> : null}
        {product.details?.included?.length ? <><h2>Комплектация</h2><ul className="product-detail-list">{product.details.included.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul></> : null}
        <div className="product-policies">
          <p><strong>Гарантия:</strong> {product.details?.warranty || 'Уточните срок гарантии у продавца.'}</p>
          <p><strong>Доставка:</strong> {product.details?.delivery || 'Срок и стоимость рассчитываются при оформлении заказа.'}</p>
          <p><strong>Возврат:</strong> {product.details?.returns || 'Условия возврата уточняются у продавца до оформления заказа.'}</p>
        </div>
        <CartQuantityControl quantity={productQuantity} max={Math.min(99, product.stockQuantity ?? 99)} disabled={!product.inStock || product.stockQuantity === 0} onAdd={() => changeCart(product, 1)} onChange={(delta) => changeCart(product, delta)} />
      </section>
    </div>
    {images.length < 5 && <p className="product-gallery-hint">Добавьте дополнительные фото товара в поле galleryImages: спереди, сбоку, сзади, сверху и деталь/в использовании.</p>}
    {relatedProducts.length > 0 && <section className="product-related" aria-labelledby="related-products-title">
      <h2 id="related-products-title">Похожие товары</h2>
      <div className="product-related-grid">{relatedProducts.map((item) => <Link href={`/product/${encodeURIComponent(item.id)}`} className="product-related-card" key={item.id}>
        <img src={item.imageUrl} alt="" loading="lazy" />
        <strong>{item.name}</strong>
        <span>{money(item.price)}</span>
      </Link>)}</div>
    </section>}
    {lightbox && <div className="product-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр фотографий" onClick={() => setLightbox(false)} onTouchStart={(event) => setStartX(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => { if (startX !== null && Math.abs(event.changedTouches[0].clientX - startX) > 45) navigate(event.changedTouches[0].clientX < startX ? 1 : -1); setStartX(null); }}>
      <button type="button" className="product-lightbox-close" aria-label="Закрыть" onClick={() => setLightbox(false)}><X /></button>
      {images.length > 1 && <button type="button" className="product-lightbox-arrow previous" aria-label="Предыдущее фото" onClick={(event) => { event.stopPropagation(); navigate(-1); }}><ChevronLeft /></button>}
      <div className={`product-lightbox-image ${zoomed ? 'zoomed' : ''}`} onClick={(event) => { event.stopPropagation(); setZoomed((value) => !value); }}><img src={images[activeImage]} alt={`${product.name}, фото ${activeImage + 1}`} /></div>
      {images.length > 1 && <button type="button" className="product-lightbox-arrow next" aria-label="Следующее фото" onClick={(event) => { event.stopPropagation(); navigate(1); }}><ChevronRight /></button>}
      <span className="product-lightbox-counter">{activeImage + 1} / {images.length} · нажмите на фото для увеличения</span>
    </div>}
  </main>;
}

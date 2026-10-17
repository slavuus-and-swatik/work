'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gauge,
  Heart,
  House,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Scissors,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  defaultConfig,
  money,
  type Config,
  type Product,
} from '@/lib/shinslot';
import { PWAInstallButton } from '@/components/pwa-install-button';
import { ScrollReveal } from '@/components/scroll-reveal';
import { calculateOrder, normalizeRussianPhone } from '@/lib/commerce';
import { CART_UPDATED_EVENT, readStoredCart, writeStoredCart } from '@/lib/cart-client';
import { CartQuantityControl } from '@/components/cart-quantity-control';
import { toast } from 'sonner';

const AddressPicker = dynamic(() => import('@/components/address-picker'), { ssr: false });

type CartItem = {
  product: Product;
  quantity: number;
};

type MyBooking = {
  id: string;
  cancelToken: string;
  serviceName: string;
  wheelSize?: number;
  startsAt: string;
  status: string;
};

const bookingStorageKey = 'shinslot-my-booking';
const favoritesStorageKey = 'shinslot-favorite-ids';

function formatRussianPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) digits = digits.slice(1);
  if (!digits) return '';
  const area = digits.slice(0, 3);
  const first = digits.slice(3, 6);
  const second = digits.slice(6, 8);
  const third = digits.slice(8, 10);
  return `+7${area ? ` (${area}` : ''}${area.length === 3 ? ')' : ''}${first ? ` ${first}` : ''}${second ? `-${second}` : ''}${third ? `-${third}` : ''}${digits.length > 10 ? ` ${digits.slice(10)}` : ''}`;
}

function serviceIcon(name?: string) {
  switch (name) {
    case 'scissors':
      return <Scissors size={22} />;
    case 'sparkles':
      return <Sparkles size={22} />;
    case 'heart':
      return <Heart size={22} />;
    case 'shield':
      return <ShieldCheck size={22} />;
    case 'badge':
      return <Award size={22} />;
    case 'repair':
      return <Wrench size={22} />;
    case 'balance':
      return <Gauge size={22} />;
    default:
      return <Sparkles size={22} />;
  }
}

export default function Home() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [myBooking, setMyBooking] = useState<MyBooking | null>(null);
  const [activeNav, setActiveNav] = useState('top');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<'popular' | 'newest' | 'price-asc' | 'price-desc'>('popular');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');

  // Shopping Cart state
  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');

  // Checkout Modal & Payment state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryPoint, setDeliveryPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [customerComment, setCustomerComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash' | 'transfer'>('cash');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; total: number; token: string } | null>(null);

  // Load config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: Config } | null) => {
        if (d?.config) {
          setConfig(d.config);
          if (d.config.siteMode === 'services') {
            setActiveTab('services');
          } else {
            setActiveTab('products');
          }
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  // Save cart
  useEffect(() => {
    writeStoredCart(cart);
  }, [cart]);

  useEffect(() => {
    const syncCart = () => setCart(readStoredCart());
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener('storage', syncCart);
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]');
      if (Array.isArray(saved)) setFavoriteIds(saved.filter((id): id is string => typeof id === 'string'));
    } catch { /* A broken favorites cache should not affect the catalog. */ }
    return () => { window.removeEventListener(CART_UPDATED_EVENT, syncCart); window.removeEventListener('storage', syncCart); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteIds)); } catch { /* Favorites remain usable for this session. */ }
  }, [favoriteIds]);

  // Load user booking
  useEffect(() => {
    let saved: MyBooking | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(bookingStorageKey) || 'null');
    } catch {}
    if (!saved?.id || !saved.cancelToken) return;
    const previous = saved;
    if (new Date(previous.startsAt).getTime() <= Date.now()) {
      localStorage.removeItem(bookingStorageKey);
      return;
    }
    fetch(`/api/bookings/${encodeURIComponent(previous.id)}?token=${encodeURIComponent(previous.cancelToken)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const b = (d as { booking: Omit<MyBooking, 'cancelToken'> }).booking;
        const next: MyBooking = { ...b, cancelToken: previous.cancelToken };
        setMyBooking(next);
        localStorage.setItem(bookingStorageKey, JSON.stringify(next));
      })
      .catch(() => {
        setMyBooking(previous);
      });
  }, []);

  function addToCart(product: Product) {
    changeCart(product.id, 1);
  }

  function updateQuantity(productId: string, delta: number) {
    changeCart(productId, delta);
  }

  function changeCart(productId: string, delta: number) {
    const product = (config.products || []).find((item) => item.id === productId);
    if (!product) return;
    const max = Math.max(0, Math.min(99, product.stockQuantity ?? 99));
    const current = cart.find((item) => item.product.id === productId)?.quantity || 0;
    const nextQuantity = Math.max(0, Math.min(max, current + delta));
    if (nextQuantity === current) return;
    setCart((prev) => {
      const previousQuantity = prev.find((item) => item.product.id === productId)?.quantity || 0;
      const quantity = Math.max(0, Math.min(max, previousQuantity + delta));
      const next = prev.filter((item) => item.product.id !== productId);
      if (quantity > 0) next.push({ product, quantity });
      return next;
    });
    if (delta > 0) toast.success('Добавлено в корзину');
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  function toggleFavorite(productId: string) {
    setFavoriteIds((previous) => previous.includes(productId) ? previous.filter((id) => id !== productId) : [...previous, productId]);
  }

  const cartTotalItems = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const rawSubtotal = useMemo(() => {
    const products = new Map((config.products || []).map((product) => [product.id, product.price]));
    return cart.reduce((acc, item) => acc + (products.get(item.product.id) || 0) * item.quantity, 0);
  }, [cart, config.products]);

  const currentQuote = useMemo(() => {
    try { return calculateOrder(config, cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })), promoApplied ? promoCodeInput : undefined, deliveryType); }
    catch { return { subtotal: rawSubtotal, discount: 0, delivery: 0, total: rawSubtotal, items: [] }; }
  }, [config, cart, promoApplied, promoCodeInput, deliveryType, rawSubtotal]);
  const discountAmount = currentQuote.discount;
  const deliveryPrice = currentQuote.delivery;
  const finalTotal = currentQuote.total;

  async function applyPromo() {
    setPromoError(''); setPromoApplied(false);
    try {
      const response = await fetch('/api/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })), promoCode: promoCodeInput, deliveryType }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error('Такого промокода нет');
      setPromoApplied(true);
    } catch (error) { setPromoError(error instanceof Error ? error.message : 'Такого промокода нет'); }
  }

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Укажите имя и телефон для связи');
      return;
    }
    if (!normalizeRussianPhone(customerPhone)) { setPhoneTouched(true); alert('Введите российский номер: 10 или 11 цифр, начало 7 или 8.'); return; }
    if (deliveryType === 'delivery' && !customerAddress.trim()) {
      alert('Укажите адрес доставки');
      return;
    }

    if (paymentMethod === 'online') { alert('Онлайн-эквайринг ещё не подключён. Выберите оплату при получении или перевод.'); return; }

    await executeOrderCreation();
  }

  async function executeOrderCreation() {
    setSubmittingOrder(true);
    try {
      const orderItems = cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        imageUrl: item.product.imageUrl,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          promoCode: promoApplied ? promoCodeInput : undefined,
          customerName,
          customerPhone,
          deliveryType,
          deliveryAddress: customerAddress,
          deliveryLatitude: deliveryPoint?.lat,
          deliveryLongitude: deliveryPoint?.lng,
          paymentMethod,
          comment: customerComment,
        }),
      });

      if (!res.ok) { const error = await res.json().catch(() => ({})) as { error?: string }; throw new Error(error.error || 'Ошибка создания заказа'); }
      const data = await res.json();
      setCompletedOrder({ id: data.order.id, total: data.order.total, token: data.order.customerAccessToken });
      setCart([]);
      setIsCartOpen(false);
      setIsCheckoutOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось оформить заказ');
    } finally {
      setSubmittingOrder(false);
    }
  }

  // Active services & products
  const enabledServices = (config.services || []).filter((s) => s.enabled);
  const enabledProducts = (config.products || []).filter((p) => p.enabled);

  const productCategories = useMemo(() => {
    const set = new Set<string>();
    enabledProducts.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [enabledProducts]);

  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    enabledServices.forEach((s) => {
      if (s.category?.trim()) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [enabledServices]);

  const filteredProducts = useMemo(() => {
    const filtered = enabledProducts.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));
      const matchFavorite = !favoritesOnly || favoriteIds.includes(p.id);
      return matchCat && matchQ && matchFavorite;
    });
    return filtered.sort((a, b) => {
      if (sortMode === 'price-asc') return a.price - b.price;
      if (sortMode === 'price-desc') return b.price - a.price;
      if (sortMode === 'newest') return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
      return (b.popularity ?? (b.badge === 'Хит' ? 1 : 0)) - (a.popularity ?? (a.badge === 'Хит' ? 1 : 0));
    });
  }, [enabledProducts, selectedCategory, searchQuery, favoritesOnly, favoriteIds, sortMode]);

  const filteredServices = useMemo(() => {
    return enabledServices.filter((s) => {
      const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [enabledServices, selectedCategory, searchQuery]);

  const showShop = config.siteMode === 'shop' || config.siteMode === 'hybrid';
  const showServices = config.siteMode === 'services' || config.siteMode === 'hybrid';

  return (
    <div
      className={`site theme-${config.theme || 'navy'} app-shell`}
      id="top"
      style={{
        ...(config.accentColor || config.customAccent ? { '--accent': config.accentColor || config.customAccent } : {}),
        ...(config.customBg ? { '--bg': config.customBg } : {}),
      } as React.CSSProperties}
    >
      <ScrollReveal />
      {/* Top Header */}
      <div className="app-header-bar">
      <header className="app-header shell">
        <div className="header-brand">
          <div className="header-logo-badge">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="header-title">{config.name}</h1>
            <span className="header-subtitle">{config.nicheLabel || 'Онлайн-сервис'}</span>
          </div>
        </div>

        <div className="header-actions">
          <PWAInstallButton />

          {showShop && cartTotalItems > 0 && (
            <button
              type="button"
              className="header-contact-pill"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none' }}
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart size={15} />
              <span>{cartTotalItems} • {money(finalTotal)}</span>
            </button>
          )}

          {showServices && (
            <Link href="/booking" className="header-book-btn">
              Записаться <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </header>
      </div>

      <main className="shell">
        {/* Active Booking Notification Banner */}
        {myBooking && myBooking.status !== 'cancelled' && (
          <section className="app-my-booking" id="my-booking">
            <span className="app-badge">ВАША АКТИВНАЯ ЗАПИСЬ</span>
            <h2>
              {new Date(myBooking.startsAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                timeZone: 'Europe/Moscow',
              })}{' '}
              в{' '}
              {new Date(myBooking.startsAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Moscow',
              })}
            </h2>
            <p>
              Услуга: <strong>{myBooking.serviceName}</strong>
            </p>
            <Link href={`/booking/${myBooking.id}?token=${myBooking.cancelToken}`}>
              Управлять записью <ArrowUpRight size={16} />
            </Link>
          </section>
        )}

        {/* Hero Section */}
        <section
          className="feature-card"
          style={{ backgroundImage: `url("${config.heroUrl}")` }}
        >
          <div className="feature-card-overlay">
            <div className="feature-card-content">
              <span className="preset-badge-tag">{config.nicheLabel}</span>
              <h2>{config.name}</h2>
              <p>{config.tagline}</p>

              <div className="hero-actions">
                {showShop && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('products');
                      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="feature-book-btn"
                  >
                    Смотреть каталог <ShoppingBag size={18} />
                  </button>
                )}
                {showServices && (
                  <Link href="/booking" className={`feature-book-btn ${showShop ? 'is-ghost' : ''}`}>
                    Записаться онлайн <ArrowUpRight size={18} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Hybrid Mode Tab Switcher */}
        {config.siteMode === 'hybrid' && (
          <div className="mode-tabs-wrap">
            <div className="mode-tabs" role="tablist" aria-label="Раздел сайта">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'products'}
                onClick={() => {
                  setActiveTab('products');
                  setSelectedCategory('all');
                }}
                className={`mode-tab ${activeTab === 'products' ? 'active' : ''}`}
              >
                <ShoppingBag size={16} aria-hidden="true" />
                Каталог товаров
                <span className="mode-tab-count">{enabledProducts.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'services'}
                onClick={() => {
                  setActiveTab('services');
                  setSelectedCategory('all');
                }}
                className={`mode-tab ${activeTab === 'services' ? 'active' : ''}`}
              >
                <Scissors size={16} aria-hidden="true" />
                Услуги и прайс
                <span className="mode-tab-count">{enabledServices.length}</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 1: PRODUCTS SHOWCASE (E-Commerce) */}
        {showShop && activeTab === 'products' && (
          <section className="app-services" id="catalog">
            <div className="app-section-heading">
              <div>
                <span className="app-overline">ВИТРИНА И ЗАКАЗ</span>
                <h2>Каталог товаров</h2>
              </div>
              <span>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'товар' : 'товаров'}
              </span>
            </div>

            {/* Controls: Search and Categories */}
            <div className="service-controls">
              {enabledProducts.length > 2 && (
                <div className="service-search-wrap">
                  <span className="service-search-icon">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    className="service-search-input"
                    placeholder="Поиск по названию или описанию..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              <div className="catalog-extra-controls">
                <label className="catalog-sort-label">Сортировка
                  <select className="catalog-sort-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                    <option value="popular">Популярные</option>
                    <option value="newest">Сначала новинки</option>
                    <option value="price-asc">Сначала дешевле</option>
                    <option value="price-desc">Сначала дороже</option>
                  </select>
                </label>
                <button type="button" className={`service-category-pill ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}>
                  <Heart size={15} fill={favoritesOnly ? 'currentColor' : 'none'} /> Избранное
                </button>
              </div>

              {productCategories.length > 0 && (
                <div className="service-category-pills">
                  <button
                    type="button"
                    className={`service-category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    Все ({enabledProducts.length})
                  </button>
                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`service-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat} ({enabledProducts.filter((p) => p.category === cat).length})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {configLoading ? <div className="product-grid" aria-label="Загрузка товаров">{Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><span /><b /></div>)}</div> : filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((item) => item.product.id === p.id);
                  return (
                  <div key={p.id} className="product-card">
                      <button type="button" className={`product-favorite-btn ${favoriteIds.includes(p.id) ? 'active' : ''}`} onClick={() => toggleFavorite(p.id)} aria-label={favoriteIds.includes(p.id) ? 'Убрать из избранного' : 'В избранное'}><Heart size={18} fill={favoriteIds.includes(p.id) ? 'currentColor' : 'none'} /></button>
                      <Link href={`/product/${encodeURIComponent(p.id)}`} className="product-image-wrap" aria-label={`Подробнее о товаре ${p.name}`}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} loading="lazy" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                            <ShoppingBag size={40} />
                          </div>
                        )}
                        {p.badge && <span className="product-badge">{p.badge}</span>}
                        {!p.inStock && <span className="product-out-of-stock">Нет в наличии</span>}
                      </Link>

                      <div className="product-body">
                        {p.category && <span className="product-category-tag">{p.category}</span>}
                        <h3 className="product-title"><Link href={`/product/${encodeURIComponent(p.id)}`}>{p.name}</Link></h3>
                        <p className="product-desc">{p.description}</p>

                        <div className="product-footer">
                          <div className="product-prices">
                            <span className="product-price-current">{money(p.price)}</span>
                            {p.oldPrice && p.oldPrice > p.price && (
                              <span className="product-price-old">{money(p.oldPrice)}</span>
                            )}
                          </div>

                          <CartQuantityControl quantity={inCart?.quantity || 0} max={Math.min(99, p.stockQuantity ?? 99)} disabled={!p.inStock || p.stockQuantity === 0} onAdd={() => addToCart(p)} onChange={(delta) => updateQuantity(p.id, delta)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <p>{favoritesOnly && favoriteIds.length === 0 ? 'В избранном пока нет товаров.' : 'Ничего не найдено. Измените поисковый запрос или фильтр.'}</p>
                <button
                  type="button"
                  className="service-category-pill active"
                  style={{ margin: '10px auto' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setFavoritesOnly(false);
                  }}
                >
                  Показать все товары
                </button>
              </div>
            )}
          </section>
        )}

        {/* Section 2: SERVICES SHOWCASE (Booking) */}
        {showServices && activeTab === 'services' && (
          <section className="app-services" id="services">
            <div className="app-section-heading">
              <div>
                <span className="app-overline">ПРАЙС И ЗАПИСЬ</span>
                <h2>Наши услуги</h2>
              </div>
              <span>
                {filteredServices.length} {filteredServices.length === 1 ? 'услуга' : 'услуг'}
              </span>
            </div>

            {/* Controls */}
            <div className="service-controls">
              {enabledServices.length > 3 && (
                <div className="service-search-wrap">
                  <span className="service-search-icon">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    className="service-search-input"
                    placeholder="Найти услугу или процедуру..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {serviceCategories.length > 0 && (
                <div className="service-category-pills">
                  <button
                    type="button"
                    className={`service-category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    Все ({enabledServices.length})
                  </button>
                  {serviceCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`service-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat} ({enabledServices.filter((s) => s.category === cat).length})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredServices.length > 0 ? (
              <div className="app-service-list">
                {filteredServices.map((s) => (
                  <Link
                    key={s.id}
                    href={`/booking?service=${encodeURIComponent(s.id)}`}
                    className="app-service-row"
                  >
                    <span className="app-service-icon">{serviceIcon(s.icon)}</span>
                    <span className="app-service-copy">
                      {s.category && <span className="service-tag">{s.category}</span>}
                      <strong>{s.name}</strong>
                      <small>{s.description}</small>
                    </span>
                    <span className="app-service-price">
                      {s.inspection ? 'от ' : ''}
                      {money(s.price)}
                      <ArrowUpRight size={16} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <p>Услуги не найдены.</p>
                <button
                  type="button"
                  className="service-category-pill active"
                  style={{ margin: '10px auto' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  Показать все услуги
                </button>
              </div>
            )}
          </section>
        )}

        {/* About & Quality guarantees */}
        <section className="app-how" id="about">
          <span className="app-overline">ПОЧЕМУ ВЫБИРАЮТ НАС</span>
          <h2>{config.name}</h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: '640px', margin: '0 0 20px' }}>
            {config.aboutText}
          </p>

          <div className="app-how-list">
            <div>
              <span>01</span>
              <p>Оригинальное качество, проверенные поставщики и сертифицированные мастера</p>
            </div>
            <div>
              <span>02</span>
              <p>Прозрачные цены без скрытых доплат и удобные способы оплаты (онлайн, СБП, при получении)</p>
            </div>
            <div>
              <span>03</span>
              <p>Быстрая доставка курьером или самовывоз в удобное время без очередей</p>
            </div>
          </div>
        </section>

        {/* Contacts section */}
        <section className="app-contacts" id="contacts">
          <span className="app-overline">СВЯЗЬ И ЛОКАЦИЯ</span>
          <h2>Контакты</h2>
          <div className="contact-items-grid">
            <div className="contact-item">
              <MapPin size={22} />
              <span>
                <strong>{config.address}</strong>
                <small>Адрес для визита и самовывоза</small>
              </span>
              <a href={config.mapUrl} target="_blank" rel="noreferrer" title="Открыть карту">
                <ArrowUpRight size={18} />
              </a>
            </div>

            <div className="contact-item">
              <Clock3 size={22} />
              <span>
                <strong>Ежедневно {config.open} — {config.close}</strong>
                <small>График работы</small>
              </span>
            </div>

            <div className="contact-item">
              <Phone size={22} />
              <span>
                <strong>{config.phone}</strong>
                <small>Телефон для звонков</small>
              </span>
              <a href={`tel:${config.phone.replace(/[^0-9+]/g, '')}`} title="Позвонить">
                <ArrowUpRight size={18} />
              </a>
            </div>
          </div>

          {(config.telegram || config.whatsapp) && (
            <div className="messengers-row">
              {config.telegram && (
                <a
                  className="msg-btn msg-tg"
                  href={`https://t.me/${config.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Send size={18} />
                  <span>Написать в Telegram</span>
                </a>
              )}
              {config.whatsapp && (
                <a
                  className="msg-btn msg-wa"
                  href={`https://wa.me/${config.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} />
                  <span>Написать в WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Floating Cart Trigger Button */}
      {showShop && cartTotalItems > 0 && !isCartOpen && (
        <button
          type="button"
          className="floating-cart-pill"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingCart size={18} />
          <span>Корзина</span>
          <span className="floating-cart-count">{cartTotalItems}</span>
          <span style={{ marginLeft: '4px', opacity: 0.9 }}>{money(finalTotal)}</span>
        </button>
      )}

      {/* Cart Sliding Drawer */}
      {isCartOpen && (
        <div className="cart-drawer-backdrop" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-drawer-head">
              <h3>
                <ShoppingCart size={20} color="var(--accent)" />
                Корзина заказов ({cartTotalItems})
              </h3>
              <button
                type="button"
                className="cart-drawer-close"
                onClick={() => setIsCartOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {cart.length > 0 ? (
              <>
                <div className="cart-items-list">
                  {cart.map(({ product, quantity }) => (
                    <div key={product.id} className="cart-item-row">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="cart-item-img" />
                      ) : (
                        <div className="cart-item-img" style={{ display: 'grid', placeItems: 'center' }}>
                          <ShoppingBag size={24} color="#64748b" />
                        </div>
                      )}

                      <div className="cart-item-info">
                        <div className="cart-item-title">{product.name}</div>
                        <div className="cart-item-price">{money(product.price * quantity)}</div>
                      </div>

                      <CartQuantityControl quantity={quantity} max={Math.min(99, product.stockQuantity ?? 99)} disabled={!product.inStock || product.stockQuantity === 0} onAdd={() => addToCart(product)} onChange={(delta) => updateQuantity(product.id, delta)} />

                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        style={{ background: 'none', border: 0, color: '#ef4444', padding: '6px', cursor: 'pointer' }}
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {/* Promo code block */}
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
                      Промокод на скидку:
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Например: START10"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--line)',
                          borderRadius: '8px',
                          color: '#fff',
                          padding: '8px 12px',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                        }}
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        className="service-category-pill active"
                        style={{ margin: 0, padding: '8px 14px' }}
                      >
                        Применить
                      </button>
                    </div>
                    {promoApplied && (
                      <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 700, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} /> Промокод применен (-{config.promoCode?.discountPercent}%)
                      </div>
                    )}
                    {promoError && <div role="alert" style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>{promoError}</div>}
                  </div>

                  {/* Delivery Selection */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px' }}>
                      Способ получения:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('pickup')}
                        className={`service-category-pill ${deliveryType === 'pickup' ? 'active' : ''}`}
                        style={{ margin: 0, textAlign: 'center', justifyContent: 'center' }}
                      >
                        Самовывоз (0 ₽)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('delivery')}
                        className={`service-category-pill ${deliveryType === 'delivery' ? 'active' : ''}`}
                        style={{ margin: 0, textAlign: 'center', justifyContent: 'center' }}
                      >
                        Доставка ({deliveryPrice === 0 ? 'Бесплатно' : `${deliveryPrice} ₽`})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cart-drawer-foot">
                  <div className="cart-summary-line">
                    <span>Товары ({cartTotalItems} шт.):</span>
                    <strong>{money(rawSubtotal)}</strong>
                  </div>

                  {discountAmount > 0 && (
                    <div className="cart-summary-line" style={{ color: '#10b981' }}>
                      <span>Скидка по промокоду:</span>
                      <strong>-{money(discountAmount)}</strong>
                    </div>
                  )}

                  <div className="cart-summary-line">
                    <span>Доставка:</span>
                    <strong>{deliveryPrice === 0 ? 'Бесплатно' : money(deliveryPrice)}</strong>
                  </div>

                  <div className="cart-summary-total">
                    <span>Итого к оплате:</span>
                    <span>{money(finalTotal)}</span>
                  </div>

                  <button
                    type="button"
                    className="cart-checkout-btn"
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                  >
                    Перейти к оформлению <ArrowRight size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <div>
                  <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <h4 style={{ color: 'var(--text)', margin: '0 0 8px' }}>Корзина пока пуста</h4>
                  <p style={{ fontSize: '13px', margin: 0 }}>Выберите понравившиеся товары из каталога выше.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal Dialog */}
      {isCheckoutOpen && (
        <div className="cart-drawer-backdrop" onClick={() => setIsCheckoutOpen(false)}>
          <div
            className="payment-modal-card"
            style={{ margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Оформление заказа</h3>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                style={{ background: 'none', border: 0, color: '#8e9bb5', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0b0e14', padding: '12px 16px', borderRadius: '12px', border: '1px solid #262f42', marginBottom: '20px', display: 'grid', gap: '8px', fontSize: '13px' }}>
              <div className="cart-summary-line"><span>Стоимость товаров:</span><strong>{money(rawSubtotal)}</strong></div>
              {discountAmount > 0 && <div className="cart-summary-line"><span>Скидка:</span><strong>-{money(discountAmount)}</strong></div>}
              <div className="cart-summary-line"><span>Доставка:</span><strong>{deliveryPrice ? money(deliveryPrice) : 'Бесплатно'}</strong></div>
              <div className="cart-summary-total"><span>Итого:</span><span>{money(finalTotal)}</span></div>
            </div>

            <form onSubmit={handleOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label" style={{ marginBottom: '4px' }}>
                  Ваше имя: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Иван Петров"
                  value={customerName}
                  onBeforeInput={(e) => { const text = (e.nativeEvent as InputEvent).data; if (text && /[^\p{L} -]/u.test(text)) e.preventDefault(); }}
                  onChange={(e) => setCustomerName(e.target.value.replace(/[^\p{L} -]/gu, '').slice(0, 100))}
                  style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label className="input-label" style={{ marginBottom: '4px' }}>
                  Номер телефона: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+7 (999) 000-00-00"
                  value={phoneFocused ? customerPhone : formatRussianPhone(customerPhone)}
                  inputMode="numeric"
                  maxLength={phoneFocused ? 11 : 20}
                  autoComplete="tel-national"
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => { setPhoneTouched(true); setPhoneFocused(false); }}
                  onBeforeInput={(e) => { const event = e.nativeEvent as InputEvent; const text = event.data; if (event.inputType !== 'insertFromPaste' && text && /\D/.test(text)) e.preventDefault(); }}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  onPaste={(e) => { e.preventDefault(); const input = e.currentTarget; const pasted = e.clipboardData.getData('text').replace(/\D/g, ''); const start = input.selectionStart ?? customerPhone.length; const end = input.selectionEnd ?? start; setCustomerPhone(`${customerPhone.slice(0, start)}${pasted}${customerPhone.slice(end)}`.slice(0, 11)); }}
                  onDrop={(e) => e.preventDefault()}
                  style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px', boxSizing: 'border-box' }}
                />
                {((phoneTouched || customerPhone.length > 0) && customerPhone.length < 10) && <small role="alert" style={{ color: '#fca5a5' }}>Введите ещё {10 - customerPhone.length} цифр российского номера.</small>}
                {customerPhone.length === 10 && !normalizeRussianPhone(customerPhone) && <small role="alert" style={{ color: '#fca5a5' }}>Проверьте российский номер из 10 цифр.</small>}
                {customerPhone.length === 11 && !normalizeRussianPhone(customerPhone) && <small role="alert" style={{ color: '#fca5a5' }}>Номер из 11 цифр должен начинаться с 7 или 8.</small>}
              </div>

              {deliveryType === 'delivery' && (
                <div>
                  <label className="input-label" style={{ marginBottom: '4px' }}>
                    Адрес доставки (город, улица, дом, квартира): *
                  </label>
                  <div className="checkout-address-row">
                    <input type="text" required maxLength={400} placeholder="г. Москва, ул. Арбат 10, кв. 25" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px', boxSizing: 'border-box' }} />
                    <button type="button" className="map-pick-button" onClick={() => setMapOpen(true)}><MapPin size={16} /> Выбрать на карте</button>
                  </div>
                  {deliveryPoint && <small style={{ color: '#8e9bb5' }}>Координаты точки сохранены: {deliveryPoint.lat.toFixed(5)}, {deliveryPoint.lng.toFixed(5)}</small>}
                </div>
              )}

              <div>
                <label className="input-label" style={{ marginBottom: '4px' }}>
                  Способ оплаты:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e14', padding: '10px 14px', borderRadius: '10px', border: '1px solid #262f42', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymethod"
                      checked={paymentMethod === 'online'}
                      disabled
                    />
                    <CreditCard size={18} color="#64748b" />
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Онлайн-оплата временно недоступна: эквайринг не подключён</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e14', padding: '10px 14px', borderRadius: '10px', border: '1px solid #262f42', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymethod"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                    />
                    <CheckCircle2 size={18} color="#10b981" />
                    <span style={{ fontSize: '13px' }}>При получении (наличными или курьеру)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0b0e14', padding: '10px 14px', borderRadius: '10px', border: '1px solid #262f42', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="paymethod"
                      checked={paymentMethod === 'transfer'}
                      onChange={() => setPaymentMethod('transfer')}
                    />
                    <QrCode size={18} color="#f59e0b" />
                    <span style={{ fontSize: '13px' }}>Перевод по номеру телефона / СБП</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="input-label" style={{ marginBottom: '4px' }}>
                  Комментарий к заказу:
                </label>
                <input
                  type="text"
                  placeholder="Код домофона, удобное время звонка"
                  value={customerComment}
                  onChange={(e) => setCustomerComment(e.target.value)}
                  style={{ width: '100%', height: '40px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingOrder}
                className="cart-checkout-btn"
                style={{ marginTop: '10px' }}
              >
                {submittingOrder ? 'Отправляем заказ…' : 'Подтвердить заказ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Order Confirmation Modal */}
      {completedOrder && (
        <div className="cart-drawer-backdrop" onClick={() => setCompletedOrder(null)}>
          <div
            className="payment-modal-card"
            style={{ margin: 'auto', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '64px', height: '64px', background: '#10b981', color: '#fff', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Check size={36} />
            </div>

            <h3 style={{ fontSize: '24px', margin: '0 0 8px' }}>Заказ успешно оформлен!</h3>
            <p style={{ color: '#8e9bb5', fontSize: '14px', margin: '0 0 20px' }}>
              Номер вашего заказа: <strong style={{ color: '#38bdf8' }}>#{completedOrder.id}</strong> на сумму{' '}
              <strong style={{ color: '#fff' }}>{money(completedOrder.total)}</strong>.
            </p>

            <div style={{ background: '#0b0e14', padding: '16px', borderRadius: '12px', border: '1px solid #262f42', textAlign: 'left', fontSize: '13px', lineHeight: 1.6, color: '#e2e8f0', marginBottom: '20px' }}>
              <div>✅ Заказ сохранён. Откройте страницу статуса заказа, чтобы увидеть решение магазина.</div>
              <div style={{ marginTop: '6px' }}>✅ Если заказ отклонят, причина появится там же.</div>
            </div>

            <Link className="cart-checkout-btn" href={`/order/${encodeURIComponent(completedOrder.id)}?token=${encodeURIComponent(completedOrder.token)}`} style={{ width: '100%', marginBottom: '10px' }}>Отслеживать статус заказа</Link>

            <button
              type="button"
              onClick={() => setCompletedOrder(null)}
              className="cart-checkout-btn"
              style={{ width: '100%' }}
            >
              Отлично, продолжить покупки
            </button>
          </div>
        </div>
      )}

      {mapOpen && <AddressPicker initialPoint={deliveryPoint} onClose={() => setMapOpen(false)} onSelect={(address, point) => { setCustomerAddress(address); setDeliveryPoint(point); }} />}

      {/* Footer */}
      <footer className="app-footer shell">
        <span>© {new Date().getFullYear()} {config.name}. Платформа онлайн-продаж и бронирования.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/admin" className="footer-top-link">
            Панель управления
          </Link>
          <a href="#top" className="footer-top-link">
            Наверх ↑
          </a>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="app-bottom-nav" aria-label="Навигация">
        <button
          type="button"
          className={activeNav === 'top' ? 'active' : ''}
          onClick={() => {
            setActiveNav('top');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <House size={20} aria-hidden="true" />Главная
        </button>

        {showShop && (
          <button
            type="button"
            className={activeNav === 'catalog' ? 'active' : ''}
            onClick={() => {
              setActiveNav('catalog');
              setActiveTab('products');
              document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <ShoppingBag size={20} aria-hidden="true" />Товары
          </button>
        )}

        {showServices && (
          <button
            type="button"
            className={activeNav === 'services' ? 'active' : ''}
            onClick={() => {
              setActiveNav('services');
              setActiveTab('services');
              document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <LayoutGrid size={20} aria-hidden="true" />Услуги
          </button>
        )}

        {showShop && (
          <button
            type="button"
            className={isCartOpen ? 'active' : ''}
            onClick={() => setIsCartOpen(true)}
            style={{ position: 'relative' }}
          >
            <ShoppingCart size={20} aria-hidden="true" />Корзина
            {cartTotalItems > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '18%',
                  background: 'var(--accent)',
                  color: 'var(--accent-text)',
                  fontSize: '10px',
                  fontWeight: 900,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {cartTotalItems}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          className={activeNav === 'contacts' ? 'active' : ''}
          onClick={() => {
            setActiveNav('contacts');
            document.getElementById('contacts')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <MapPin size={20} aria-hidden="true" />Контакты
        </button>

        {showServices && (
          <Link className="bottom-nav-primary" href="/booking">
            <CalendarDays size={18} />Запись
          </Link>
        )}
      </nav>
    </div>
  );
}

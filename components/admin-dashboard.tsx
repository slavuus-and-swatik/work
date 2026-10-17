'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import {
  money,
  DEFAULT_DELIVERY_PRICING,
  presets,
  type Booking,
  type Config,
  type Order,
  type PresetKey,
  type Product,
  type Service,
  type ThemeKey,
} from '@/lib/shinslot';
import { getActiveConfig } from '@/lib/site-config';
import '../app/admin/admin.css';
import BookingCalendar from '../app/admin/booking-calendar';

function parseAddOns(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const res = JSON.parse(val);
      if (Array.isArray(res)) return res;
    } catch {}
  }
  return [];
}

function formatDeliveryTiers(tiers: Array<{ from: number; amount: number }> | undefined) {
  return (tiers || []).map((tier) => `${tier.from}:${tier.amount}`).join('\n');
}

function parseDeliveryTiers(value: string) {
  return value.split('\n').map((line) => line.split(':').map(Number)).filter(([from, amount]) => Number.isFinite(from) && from > 0 && Number.isFinite(amount) && amount >= 0).map(([from, amount]) => ({ from, amount }));
}

type Tab =
  | 'overview'
  | 'presets'
  | 'products'
  | 'services'
  | 'orders'
  | 'bookings'
  | 'design'
  | 'contacts'
  | 'payments'
  | 'security'
  | 'guide';

const presetList: {
  key: PresetKey;
  title: string;
  subtitle: string;
  icon: string;
  count: number;
  themeName: string;
  type: string;
}[] = [
  { key: 'shop', title: 'Интернет-магазин & Шоурум', subtitle: 'Одежда, косметика, трендовые товары, корзина и онлайн-оплата', icon: '🛍', count: 6, themeName: 'Графит & Золото', type: 'Магазин' },
  { key: 'car_dealership', title: 'Автосалон & Детейлинг', subtitle: 'Авто в наличии, тест-драйв, трейд-ин, автохимия и дооснащение', icon: '🏎', count: 5, themeName: 'Индиго & Синий', type: 'Гибрид' },
  { key: 'barbershop', title: 'Барбершоп и мужские стрижки', subtitle: 'Стрижки, борода, королевское бритьё и мужская косметика', icon: '💈', count: 6, themeName: 'Графит & Золото', type: 'Гибрид' },
  { key: 'massage', title: 'Студия массажа & Спа', subtitle: 'Релакс, оздоровительный массаж, спа-программы', icon: '💆', count: 6, themeName: 'Изумруд & Зелёный', type: 'Услуги' },
  { key: 'beauty', title: 'Салон красоты & Бьюти', subtitle: 'Стрижки, окрашивание, маникюр, брови и уходовая косметика', icon: '💅', count: 6, themeName: 'Амбер & Розовый', type: 'Гибрид' },
  { key: 'auto', title: 'Автосервис & Шиномонтаж', subtitle: 'Шиномонтаж, ТО, полировка, масла и автозапчасти', icon: '🚗', count: 6, themeName: 'Индиго & Синий', type: 'Гибрид' },
  { key: 'custom', title: 'Частный мастер / Эксперт', subtitle: 'Индивидуальные консультации, коучинг и личный приём', icon: '💼', count: 5, themeName: 'Индиго & Синий', type: 'Услуги' },
  { key: 'photo', title: 'Фотостудия & Продакшн', subtitle: 'Аренда залов, циклорама, фотосессии под ключ', icon: '📸', count: 5, themeName: 'Графит & Золото', type: 'Гибрид' },
  { key: 'fitness', title: 'Фитнес & Персональный тренер', subtitle: 'Тренировки, йога, стретчинг и спортивное питание', icon: '🧘', count: 5, themeName: 'Океан & Бирюза', type: 'Гибрид' },
  { key: 'medical', title: 'Клиника & Стоматология', subtitle: 'Консультации врачей, гигиена, диагностика без боли', icon: '🦷', count: 5, themeName: 'Чистый светлый', type: 'Услуги' },
  { key: 'tattoo', title: 'Тату-студия & Пирсинг', subtitle: 'Авторские эскизы, сеансы тату, пирсинг', icon: '🎨', count: 5, themeName: 'Рубин & Бордо', type: 'Услуги' },
  { key: 'cleaning', title: 'Клининг & Химчистка', subtitle: 'Генеральная уборка квартир, диваны, мойка окон', icon: '🧹', count: 5, themeName: 'Неон & Фиолетовый', type: 'Услуги' },
];

const photoPresets: { title: string; niche: string; url: string }[] = [
  { title: 'Магазин одежды', niche: 'Шопинг', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Автосалон премиум', niche: 'Авто', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Барбершоп', niche: 'Стрижки', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Массаж & Спа', niche: 'Спа', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Салон красоты', niche: 'Бьюти', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Автосервис', niche: 'Авто', url: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Офис & Студия', niche: 'Бизнес', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Фотостудия', niche: 'Фото', url: 'https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Фитнес & Йога', niche: 'Спорт', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Клиника & Доктор', niche: 'Медицина', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80' },
];

const themeSwatches: { key: ThemeKey; title: string; desc: string; accentColor: string; bgColor: string }[] = [
  { key: 'graphite', title: 'Графит & Золото', desc: 'Премиум, барбершопы, тату, бутики', accentColor: '#e5aa42', bgColor: '#0b0c0e' },
  { key: 'navy', title: 'Индиго & Синий', desc: 'Автосалоны, автосервис, технологии', accentColor: '#4fa0ff', bgColor: '#050911' },
  { key: 'emerald', title: 'Изумруд & Мята', desc: 'Спа, массаж, здоровье, эко', accentColor: '#37d692', bgColor: '#06110c' },
  { key: 'amber', title: 'Амбер & Розовый', desc: 'Салоны красоты, макияж, мода', accentColor: '#f0956b', bgColor: '#0f0a0d' },
  { key: 'ruby', title: 'Рубин & Бордо', desc: 'Элитные студии, закрытые клубы', accentColor: '#e11d48', bgColor: '#0c0507' },
  { key: 'violet', title: 'Неон & Фиолетовый', desc: 'Клининг, творчество, молодежь', accentColor: '#a855f7', bgColor: '#090612' },
  { key: 'cyan', title: 'Океан & Бирюза', desc: 'Фитнес, йога, спорт, бассейны', accentColor: '#06b6d4', bgColor: '#040d12' },
  { key: 'light', title: 'Светлая минималистичная', desc: 'Клиники, стоматологии, студии', accentColor: '#1e5fe8', bgColor: '#f5f5f1' },
];

const quickPaletteColors = [
  { label: 'Золотой', hex: '#e5aa42' },
  { label: 'Синий', hex: '#3b82f6' },
  { label: 'Изумруд', hex: '#10b981' },
  { label: 'Рубин', hex: '#e11d48' },
  { label: 'Фиолетовый', hex: '#8b5cf6' },
  { label: 'Бирюзовый', hex: '#06b6d4' },
  { label: 'Оранжевый', hex: '#f97316' },
  { label: 'Белый', hex: '#ffffff' },
];

export type AdminDashboardProps = {
  onExit?: () => void;
  initialTab?: Tab;
  onConfigChange?: (c: Config) => void;
};

export default function AdminDashboard({ onExit, initialTab = 'overview', onConfigChange }: AdminDashboardProps) {
  const [config, setConfig] = useState<Config>(getActiveConfig());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [activePresetKey, setActivePresetKey] = useState<PresetKey>(getActiveConfig().niche);
  const [previewPresetKey, setPreviewPresetKey] = useState<PresetKey | null>(null);

  // Admin access is verified by the server session endpoint.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lockRemaining, setLockRemaining] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  // Role: 'client' (buyer of the template) vs 'developer' (creator / agency)
  const [role, setRole] = useState<'client' | 'developer'>('client');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (lockRemaining > 0) return;
    setPasswordError('Проверяем пароль…');
    try {
      const response = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passwordInput }) });
      const result = await response.json() as { error?: string; attemptsLeft?: number; blockedForSeconds?: number };
      if (!response.ok) {
        const wait = result.blockedForSeconds;
        if (wait) setLockRemaining(wait);
        setPasswordError(wait ? 'Вход временно заблокирован' : `${result.error || 'Неверный пароль'}${result.attemptsLeft ? `. Осталось попыток: ${result.attemptsLeft}` : ''}`);
        return;
      }
      setIsAuthenticated(true); setPasswordError(''); setPasswordInput(''); setLockRemaining(0);
    } catch { setPasswordError('Не удалось связаться с сервером. Повторите попытку.'); }
  }

  async function handleLogout() {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined);
    setIsAuthenticated(false);
  }

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { authenticated?: boolean } | null) => setIsAuthenticated(Boolean(result?.authenticated)))
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = window.setInterval(() => setLockRemaining((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lockRemaining > 0]);


  // Search & Filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');

  // JSON Import
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonModal, setShowJsonModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    async function init() {
      try {
        const cfgRes = await fetch('/api/config?draft=1');
        if (cfgRes.ok) {
          const d = (await cfgRes.json()) as { config?: Config; activePresetKey?: PresetKey };
          if (d?.config && !ignore) {
            setConfig(d.config);
            if (d.config.adminMode) setRole(d.config.adminMode);
            if (d.activePresetKey) setActivePresetKey(d.activePresetKey);
          }
        }
      } catch (e) {
        console.error('Error fetching initial config:', e);
      }
    }
    init();
    loadData();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  async function loadData() {
    try {
      const [bRes, oRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/orders'),
      ]);

      if (bRes.ok) {
        const b = (await bRes.json()) as { bookings?: (Booking & { addOns?: unknown })[] };
        if (b?.bookings) {
          setBookings(
            b.bookings.map((v) => ({
              ...v,
              addOns: parseAddOns(v.addOns),
            }))
          );
        }
      }

      if (oRes.ok) {
        const o = (await oRes.json()) as { orders?: Order[] };
        if (o?.orders) {
          setOrders(o.orders);
        }
      }
    } catch (e) {
      console.error('Error loading admin data', e);
    }
  }

  function updateField<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((c) => {
      const next = { ...c, [key]: value };
      onConfigChange?.(next);
      return next;
    });
    setHasChanges(true);
    setNotice('');
  }

  // ================= PRODUCTS CRUD =================
  function addProduct() {
    const newProd: Product = {
      id: 'prod_' + Date.now().toString(36),
      name: 'Новый товар ' + ((config.products?.length || 0) + 1),
      description: 'Подробное описание товара, характеристики и преимущества',
      price: 2500,
      oldPrice: 3200,
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
      category: 'Основное',
      badge: 'Новинка',
      inStock: true,
      enabled: true,
    };
    const current = config.products || [];
    updateField('products', [...current, newProd]);
    setNotice('Товар успешно добавлен в каталог!');
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    const current = config.products || [];
    updateField(
      'products',
      current.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function duplicateProduct(product: Product) {
    const clone: Product = {
      ...product,
      id: 'prod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
      name: product.name + ' (Копия)',
    };
    const current = config.products || [];
    const index = current.findIndex((p) => p.id === product.id);
    const nextList = [...current];
    nextList.splice(index + 1, 0, clone);
    updateField('products', nextList);
    setNotice(`Товар скопирован: «${clone.name}»`);
  }

  function removeProduct(id: string) {
    const current = config.products || [];
    updateField(
      'products',
      current.filter((p) => p.id !== id)
    );
    setNotice('Товар удален из каталога');
  }

  function addBatchProducts() {
    const batch: Product[] = [
      { id: 'bp_1_' + Date.now(), name: 'Премиум комплект Style Edition', description: 'Лимитированная серия в фирменной подарочной коробке', price: 6900, oldPrice: 8500, imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80', category: 'Комплекты', badge: 'Хит', inStock: true, enabled: true },
      { id: 'bp_2_' + Date.now(), name: 'Базовый набор на каждый день', description: 'Практичное и надежное решение с гарантией 1 год', price: 2900, oldPrice: 3400, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', category: 'Хиты', badge: 'Скидка', inStock: true, enabled: true },
      { id: 'bp_3_' + Date.now(), name: 'Подарочный сертификат на 5 000 ₽', description: 'Идеальный подарок друзьям и коллегам на любые товары', price: 5000, imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80', category: 'Сертификаты', badge: 'В наличии', inStock: true, enabled: true },
      { id: 'bp_4_' + Date.now(), name: 'Аксессуар серии Comfort Line', description: 'Эргономичный дизайн и приятные тактильные материалы', price: 1750, imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80', category: 'Аксессуары', inStock: true, enabled: true },
      { id: 'bp_5_' + Date.now(), name: 'Эксклюзивная позиция Black Edition', description: 'Строгий минимализм и максимальная функциональность', price: 9200, oldPrice: 11000, imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80', category: 'Комплекты', badge: '-20%', inStock: true, enabled: true },
    ];
    const current = config.products || [];
    updateField('products', [...current, ...batch]);
    setNotice(`Пакет из 5 товаров добавлен! Всего в каталоге: ${current.length + 5}`);
  }

  // ================= SERVICES CRUD =================
  function addService() {
    const newService: Service = {
      id: 'srv_' + Date.now().toString(36),
      name: 'Новая услуга ' + (config.services.length + 1),
      description: 'Краткое описание процедуры для клиентов',
      price: 2000,
      duration: 45,
      category: 'Основные',
      icon: 'sparkles',
      enabled: true,
    };
    updateField('services', [...config.services, newService]);
    setNotice('Новая услуга добавлена в прайс');
  }

  function updateService(id: string, patch: Partial<Service>) {
    updateField(
      'services',
      config.services.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function duplicateService(service: Service) {
    const clone: Service = {
      ...service,
      id: 'srv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
      name: service.name + ' (Копия)',
    };
    const index = config.services.findIndex((s) => s.id === service.id);
    const nextList = [...config.services];
    nextList.splice(index + 1, 0, clone);
    updateField('services', nextList);
    setNotice(`Услуга скопирована: «${clone.name}»`);
  }

  function removeService(id: string) {
    updateField(
      'services',
      config.services.filter((s) => s.id !== id)
    );
    setNotice('Услуга удалена');
  }

  // ================= PRESETS / NICHES =================
  async function applyPreset(key: PresetKey) {
    const chosen = presets[key];
    if (!chosen) return;
    const nextConfig = structuredClone(chosen);
    // preserve current admin mode
    nextConfig.adminMode = role;
    setSaving(true);
    setNotice(`Публикуем вариант «${chosen.nicheLabel}»...`);

    try {
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig, publish: true }),
      });
      if (!r.ok) {
        const result = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || 'Не удалось опубликовать вариант сайта');
      }
      setConfig(nextConfig);
      setActivePresetKey(key);
      setPreviewPresetKey(null);
      onConfigChange?.(nextConfig);
      setNotice(`Вариант «${chosen.nicheLabel}» опубликован для посетителей сайта.`);
      setHasChanges(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось опубликовать вариант сайта. Текущий вариант оставлен без изменений.');
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setNotice('Публикуем изменения на сайте...');
    try {
      const r = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, publish: true }),
      });
      if (!r.ok) {
        const err = (await r.json()) as { error?: string };
        throw new Error(err.error || 'Ошибка при сохранении');
      }
      setNotice('Все изменения успешно сохранены и опубликованы на сайте!');
      setHasChanges(false);
      onConfigChange?.(config);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(id: string, newStatus: string, payStatus?: string, rejectionReason?: string) {
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, paymentStatus: payStatus, rejectionReason }),
      });
      if (!r.ok) {
        const result = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || 'Ошибка обновления статуса заказа');
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: newStatus as Order['status'], paymentStatus: (payStatus || o.paymentStatus) as Order['paymentStatus'], rejectionReason } : o))
      );
      setNotice(`Статус заказа ${id} обновлен на «${newStatus}»`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ошибка обновления статуса заказа');
    }
  }

  // Export config to JSON
  function exportConfigJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `site-config-${config.niche}-${Date.now().toString(36)}.json`);
    dlAnchor.click();
    setNotice('Файл конфигурации (.json) успешно скачан!');
  }

  // Export orders to CSV
  function exportOrdersCsv() {
    if (!orders.length) {
      setNotice('Нет заказов для выгрузки.');
      return;
    }
    const headers = ['Номер', 'Дата', 'Клиент', 'Телефон', 'Сумма', 'Доставка', 'Адрес', 'Оплата', 'Статус'];
    const rows = orders.map((o) => [
      o.id,
      o.createdAt,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      o.total,
      o.deliveryType === 'delivery' ? 'Курьер' : 'Самовывоз',
      `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`,
      o.paymentStatus === 'paid' ? 'Оплачен' : 'Ожидает',
      o.status,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${Date.now().toString(36)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Список заказов выгружен в формате Excel (CSV)!');
  }

  // Import JSON
  function importConfigJson() {
    try {
      const parsed = JSON.parse(jsonInput) as Config;
      if (!parsed.name) throw new Error('Некорректный файл');
      setConfig(parsed);
      onConfigChange?.(parsed);
      setShowJsonModal(false);
      setJsonInput('');
      setHasChanges(true);
      setNotice('Конфигурация загружена! Нажмите «Опубликовать на сайте».');
    } catch {
      setNotice('Ошибка: некорректный JSON файл.');
    }
  }

  // Active categories
  const existingProductCategories = useMemo(() => {
    const set = new Set<string>();
    (config.products || []).forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [config.products]);

  const existingServiceCategories = useMemo(() => {
    const set = new Set<string>();
    (config.services || []).forEach((s) => {
      if (s.category?.trim()) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [config.services]);

  const filteredAdminProducts = useMemo(() => {
    return (config.products || []).filter((p) => {
      const matchCat = productCategoryFilter === 'all' || p.category === productCategoryFilter;
      const q = productSearch.toLowerCase().trim();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [config.products, productCategoryFilter, productSearch]);

  const filteredAdminServices = useMemo(() => {
    return (config.services || []).filter((s) => {
      const matchCat = serviceCategoryFilter === 'all' || s.category === serviceCategoryFilter;
      const q = serviceSearch.toLowerCase().trim();
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [config.services, serviceCategoryFilter, serviceSearch]);

  const activeColor = config.customAccent || themeSwatches.find((t) => t.key === config.theme)?.accentColor || '#3b82f6';

  // Dynamic Tabs for universal administration
  const availableTabs: { key: Tab; label: string; icon: string; badge?: string }[] = useMemo(() => {
    const list: { key: Tab; label: string; icon: string; badge?: string }[] = [
      { key: 'overview', label: 'Обзор', icon: '📊' },
    ];

    if (config.siteMode === 'shop' || config.siteMode === 'hybrid') {
      list.push({ key: 'products', label: 'Мои товары', icon: '📦', badge: String(config.products?.length || 0) });
      list.push({ key: 'orders', label: 'Заказы из корзины', icon: '🛒', badge: String(orders.length) });
    }

    if (config.siteMode === 'services' || config.siteMode === 'hybrid') {
      list.push({ key: 'services', label: 'Мои услуги', icon: '✂', badge: String(config.services?.length || 0) });
      list.push({ key: 'bookings', label: 'Записи клиентов', icon: '📅', badge: String(bookings.length) });
    }

    list.push({ key: 'design', label: 'Цвета и оформление', icon: '🎨' });
    list.push({ key: 'contacts', label: 'Контакты и доставка', icon: '🏢' });
    list.push({ key: 'payments', label: 'Оплата и касса', icon: '💳' });
    list.push({ key: 'security', label: 'Пароль и вход', icon: '🔒' });
    list.push({ key: 'guide', label: 'Инструкция', icon: '📖' });
    list.push({ key: 'presets', label: 'Шаблоны ниш (Dev)', icon: '⚙️' });
    return list;
  }, [config.siteMode, config.products, config.services, orders.length, bookings.length]);

  // Authentication is confirmed by the server-side HttpOnly session.
  if (!isAuthenticated) {
    return (
      <div className="admin-login-screen">
        <div className="admin-login-card">
          <div className="admin-login-badge">
            <Lock size={28} color="#fff" />
          </div>
          <h2 className="admin-login-title">Вход в панель управления</h2>
          <p className="admin-login-sub">
            Введите пароль администратора для управления товарами, заказами и настройками
          </p>

          <form onSubmit={handleLogin}>
            <div className="admin-login-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="admin-login-input"
                placeholder="Введите пароль..."
                value={passwordInput}
                minLength={32}
                maxLength={32}
                autoComplete="current-password"
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                autoFocus
              />
              <button
                type="button"
                className="admin-login-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Скрыть' : 'Показать'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {passwordError && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: 600 }}>
                {passwordError}{lockRemaining > 0 && `: ${Math.floor(lockRemaining / 60)}:${String(lockRemaining % 60).padStart(2, '0')}`}
              </div>
            )}

            <button type="submit" className="admin-login-btn" disabled={lockRemaining > 0}>
              Войти в панель <ArrowRight size={16} />
            </button>
          </form>

          <div className="admin-login-hint">
            🔒 Пароль администратора настроен на сервере и не хранится в браузере.
          </div>

          {onExit ? (
            <button type="button" onClick={onExit} className="admin-login-back" style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer' }}>
              ← Вернуться на сайт (вид для клиентов)
            </button>
          ) : (
            <Link href="/" className="admin-login-back">
              ← Вернуться на сайт (вид для клиентов)
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>
            <Sparkles size={20} />
          </span>
          <div>
            СлотБизнес
            <small>ПАНЕЛЬ УПРАВЛЕНИЯ</small>
          </div>
        </div>

        {/* Tenant Card */}
        <div className="admin-tenant">
          <div className="tenant-avatar">★</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{config.name}</strong>
            <small>{config.nicheLabel || 'Онлайн-бизнес'}</small>
          </div>
          <ChevronRight size={16} color="#8e9bb5" />
        </div>

        {/* Sidebar Nav */}
        <nav>
          {availableTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'active' : ''}
              onClick={() => {
                setTab(item.key);
                setNotice('');
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <em style={{ background: '#2563eb' }}>{item.badge}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {onExit ? (
            <button type="button" onClick={onExit} className="admin-primary">
              ← На сайт (вид клиента)
            </button>
          ) : (
            <Link href="/" className="admin-primary">
              ← На сайт (вид клиента)
            </Link>
          )}
          <span>{role === 'developer' ? '⚙️ Расширенные настройки шаблона' : '👤 Панель владельца готова к работе'}</span>
        </div>
      </aside>

      <main className="admin-main">
        {/* Top Header */}
        <header className="admin-top">
          <div className="admin-top-left">
            <span className="live-dot" />
            <div className="admin-top-title">
              Панель управления / <strong>{availableTabs.find((t) => t.key === tab)?.label}</strong>
            </div>
          </div>

          <div className="admin-top-right">
            <a
              href="/project-source.zip"
              download="universal-booking-site-source.zip"
              className="client-view-link"
              style={{ background: '#2563eb', color: '#fff', borderColor: '#3b82f6' }}
              title="Скачать полный ZIP-архив исходников проекта"
            >
              <Download size={14} /> Скачать исходники (.zip)
            </a>

            {onExit ? (
              <button type="button" onClick={onExit} className="client-view-link">
                Перейти на сайт <ExternalLink size={14} />
              </button>
            ) : (
              <Link href="/" className="client-view-link">
                Перейти на сайт <ExternalLink size={14} />
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="client-view-link"
              style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', borderColor: '#ef4444' }}
              title="Заблокировать и выйти из панели управления"
            >
              <Lock size={14} /> Выйти
            </button>
          </div>
        </header>

        {/* Responsive Horizontal Tab Bar */}
        <div className="admin-tab-nav">
          {availableTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-tab-btn ${tab === item.key ? 'active' : ''}`}
              onClick={() => {
                setTab(item.key);
                setNotice('');
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <em style={{ background: '#2563eb' }}>{item.badge}</em>}
            </button>
          ))}
        </div>

        {/* Notification Toast */}
        {notice && (
          <div className="admin-notice">
            <span>✓</span>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>
              ✕
            </button>
          </div>
        )}

        {/* Save Bar */}
        {hasChanges && (
          <div className="admin-save-bar">
            <div>
              <strong>Есть неопубликованные изменения</strong>
              <small>Нажмите «Опубликовать на сайте», чтобы клиенты увидели обновления.</small>
            </div>
            <button type="button" className="admin-primary" disabled={saving} onClick={saveConfig}>
              <Save size={16} /> {saving ? 'Сохраняем...' : 'Опубликовать на сайте'}
            </button>
          </div>
        )}

        <div className="admin-content">
          {/* ================= TAB 1: OVERVIEW ================= */}
          {tab === 'overview' && (
            <>
              <div className="metric-grid">
                {(config.siteMode === 'shop' || config.siteMode === 'hybrid') && (
                  <div className="metric-card" onClick={() => setTab('orders')}>
                    <span>ЗАКАЗОВ ИЗ КОРЗИНЫ</span>
                    <strong>{String(orders.length).padStart(2, '0')}</strong>
                    <small>Выручка: {money(orders.reduce((acc, o) => acc + o.total, 0))} →</small>
                  </div>
                )}

                {(config.siteMode === 'services' || config.siteMode === 'hybrid') && (
                  <div className="metric-card" onClick={() => setTab('bookings')}>
                    <span>ЗАПИСЕЙ КЛИЕНТОВ</span>
                    <strong>{String(bookings.length).padStart(2, '0')}</strong>
                    <small>Активных бронирований →</small>
                  </div>
                )}

                {(config.siteMode === 'shop' || config.siteMode === 'hybrid') && (
                  <div className="metric-card" onClick={() => setTab('products')}>
                    <span>ТОВАРОВ В КАТАЛОГЕ</span>
                    <strong>{String((config.products || []).filter((p) => p.enabled).length).padStart(2, '0')}</strong>
                    <small>Всего: {(config.products || []).length} товаров →</small>
                  </div>
                )}

                {(config.siteMode === 'services' || config.siteMode === 'hybrid') && (
                  <div className="metric-card" onClick={() => setTab('services')}>
                    <span>УСЛУГ В ПРАЙСЕ</span>
                    <strong>{String(config.services.filter((s) => s.enabled).length).padStart(2, '0')}</strong>
                    <small>Всего: {config.services.length} услуг →</small>
                  </div>
                )}

                <div className="metric-card" onClick={() => setTab('design')}>
                  <span>АКТИВНЫЙ ЦВЕТ</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: activeColor }} />
                    <strong style={{ fontSize: '18px', margin: 0 }}>
                      {themeSwatches.find((t) => t.key === config.theme)?.title || 'Пользовательский'}
                    </strong>
                  </div>
                  <small style={{ marginTop: '6px' }}>Настроить палитру →</small>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="admin-two">
                <section className="admin-panel">
                  <div className="panel-head">
                    <h2>Последние заказы и заявки</h2>
                    <button type="button" onClick={() => setTab(config.siteMode === 'shop' ? 'orders' : 'bookings')}>
                      Смотреть все →
                    </button>
                  </div>

                  {orders.length > 0 ? (
                    orders.slice(0, 4).map((o) => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px', border: '1px solid var(--adm-border)' }}>
                        <div>
                          <strong>#{o.id} • {o.customerName}</strong>
                          <div style={{ fontSize: '12px', color: '#8e9bb5' }}>{o.customerPhone} • {o.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ color: '#38bdf8' }}>{money(o.total)}</strong>
                          <div style={{ fontSize: '11px', color: o.paymentStatus === 'paid' ? '#10b981' : '#f59e0b' }}>
                            {o.paymentStatus === 'paid' ? 'Оплачен' : 'Ожидает'}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : bookings.length > 0 ? (
                    bookings.slice(0, 4).map((b) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px', border: '1px solid var(--adm-border)' }}>
                        <div>
                          <strong>{b.serviceName}</strong>
                          <div style={{ fontSize: '12px', color: '#8e9bb5' }}>{b.name} • {b.phone}</div>
                        </div>
                        <strong style={{ color: '#38bdf8' }}>{money(b.price)}</strong>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#8e9bb5' }}>Пока нет новых заказов.</p>
                  )}
                </section>

                <section className="admin-panel quick">
                  <div className="panel-head">
                    <h2>Быстрые действия</h2>
                  </div>

                  {(config.siteMode === 'shop' || config.siteMode === 'hybrid') && (
                    <button type="button" onClick={() => setTab('products')}>
                      <Package />
                      <span>Управление товарами (сейчас: {(config.products || []).length})</span>
                      <ArrowRight />
                    </button>
                  )}

                  {(config.siteMode === 'services' || config.siteMode === 'hybrid') && (
                    <button type="button" onClick={() => setTab('services')}>
                      <Wrench />
                      <span>Управление услугами (сейчас: {config.services.length})</span>
                      <ArrowRight />
                    </button>
                  )}

                  <button type="button" onClick={() => setTab('design')}>
                    <Palette />
                    <span>Настроить оттенки, цвета и обложку</span>
                    <ArrowRight />
                  </button>

                  <button type="button" onClick={() => setTab('guide')}>
                    <BookOpen />
                    <span>Инструкция по запуску и масштабированию</span>
                    <ArrowRight />
                  </button>

                  <a
                    href="/project-source.zip"
                    download="universal-booking-site-source.zip"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(37,99,235,0.12)',
                      border: '1px solid #2563eb',
                      borderRadius: '12px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={18} color="#60a5fa" />
                    <span style={{ flex: 1 }}>Скачать весь проект (ZIP-архив исходников)</span>
                    <span style={{ fontSize: '11px', color: '#93c5fd', background: 'rgba(37,99,235,0.3)', padding: '2px 8px', borderRadius: '6px' }}>.ZIP</span>
                  </a>
                </section>
              </div>
            </>
          )}

          {/* ================= TAB: PRESETS & DEV TOOLS ================= */}
          {tab === 'presets' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2>Отраслевые шаблоны и конфигуратор ниши (Для разработчика)</h2>
                  <p style={{ margin: 0 }}>
                    Выберите сферу бизнеса клиента — шаблон автоматически настроит каталог, цены, фото, цвета и тексты.
                  </p>
                </div>
              </div>

              {/* Site Mode Switcher */}
              <div style={{ background: '#0b0e14', border: '1px solid #262f42', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#fff' }}>Тип веб-сайта:</strong>
                  <span style={{ fontSize: '12px', color: '#8e9bb5' }}>Определяет, что видит покупатель на главной странице</span>
                </div>
                <div style={{ display: 'inline-flex', background: '#141822', padding: '4px', borderRadius: '10px', border: '1px solid #262f42', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => updateField('siteMode', 'shop')}
                    style={{
                      background: config.siteMode === 'shop' ? '#2563eb' : 'transparent',
                      color: config.siteMode === 'shop' ? '#fff' : '#8e9bb5',
                      border: 0,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🛍 Только Магазин
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('siteMode', 'services')}
                    style={{
                      background: config.siteMode === 'services' ? '#2563eb' : 'transparent',
                      color: config.siteMode === 'services' ? '#fff' : '#8e9bb5',
                      border: 0,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✂ Только Услуги
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('siteMode', 'hybrid')}
                    style={{
                      background: config.siteMode === 'hybrid' ? '#2563eb' : 'transparent',
                      color: config.siteMode === 'hybrid' ? '#fff' : '#8e9bb5',
                      border: 0,
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Гибрид (Товары + Услуги)
                  </button>
                </div>
              </div>

              <div className="presets-grid">
                {presetList.map((p) => {
                  const isCurrent = activePresetKey === p.key;
                  return (
                    <div key={p.key} className={`preset-card ${isCurrent ? 'active' : ''}`}>
                      <div>
                        <div className="preset-card-icon">{p.icon}</div>
                        <strong>{p.title}</strong>
                        <small>{p.subtitle}</small>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', fontSize: '11px', color: '#8e9bb5' }}>
                          <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                            {p.type}
                          </span>
                          <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                            {p.themeName}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <button
                          type="button"
                          className={isCurrent ? 'admin-secondary' : 'admin-primary'}
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => setPreviewPresetKey(p.key)}
                        >
                          {isCurrent ? '✓ Активный вариант · просмотр' : 'Предпросмотр варианта →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {previewPresetKey && <section className={`preset-live-preview theme-${presets[previewPresetKey].theme || 'navy'}`} aria-label="Предпросмотр варианта сайта">
                <div className="preset-live-preview-heading">
                  <div><span>ПРЕДПРОСМОТР · {presets[previewPresetKey].nicheLabel}</span><h3>{presets[previewPresetKey].name}</h3></div>
                  <button type="button" className="admin-secondary" onClick={() => setPreviewPresetKey(null)}>Закрыть</button>
                </div>
                <div className="preset-live-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(3,7,18,.84),rgba(3,7,18,.16)),url('${presets[previewPresetKey].heroUrl}')` }}>
                  <span>{presets[previewPresetKey].nicheLabel}</span><strong>{presets[previewPresetKey].tagline}</strong>
                </div>
                <p>{presets[previewPresetKey].aboutText}</p>
                <div className="preset-live-preview-grid">{presets[previewPresetKey].products.slice(0, 3).map((product) => <article key={product.id}><img src={product.imageUrl} alt="" /><strong>{product.name}</strong><span>{money(product.price)}</span></article>)}</div>
                <div className="preset-live-preview-footer"><span>Блоки: {presets[previewPresetKey].products.length} товаров · {presets[previewPresetKey].services.length} услуг · контакты и доставка</span><button type="button" className="admin-primary" disabled={saving} onClick={() => applyPreset(previewPresetKey)}>{saving ? 'Публикуем…' : 'Применить вариант ко всему сайту'}</button></div>
              </section>}
            </div>
          )}

          {/* ================= TAB 3: PRODUCTS CRUD (SHOP) ================= */}
          {tab === 'products' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2>Каталог товаров ({(config.products || []).length} поз.)</h2>
                  <p style={{ margin: 0 }}>
                    Добавляйте товары с фотографиями, ценами, скидками и бейджами («Хит», «Новинка»).
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="admin-secondary" onClick={addBatchProducts}>
                    <Plus size={14} /> + Пакет из 5 товаров
                  </button>
                  <button type="button" className="admin-primary" onClick={addProduct}>
                    <Plus size={16} /> Добавить товар
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Поиск по названию..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ width: '100%', height: '40px', background: '#1c2230', border: '1px solid #2d3748', borderRadius: '10px', color: '#fff', padding: '0 12px 0 34px', boxSizing: 'border-box' }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '13px', color: '#8e9bb5' }} />
                </div>

                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  <button
                    type="button"
                    className={`service-category-pill ${productCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setProductCategoryFilter('all')}
                  >
                    Все ({(config.products || []).length})
                  </button>
                  {existingProductCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`service-category-pill ${productCategoryFilter === c ? 'active' : ''}`}
                      onClick={() => setProductCategoryFilter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Table / Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredAdminProducts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--adm-surface-alt)',
                      border: '1px solid var(--adm-border)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ width: '70px', height: '70px', borderRadius: '10px', overflow: 'hidden', background: '#0b0e14', flex: 'none' }}>
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ flex: '1 1 260px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                          style={{ fontWeight: 800, fontSize: '15px', color: '#fff', background: 'transparent', border: 'none', borderBottom: '1px dashed #4b5563', padding: '2px 4px', width: '100%' }}
                        />
                      </div>
                      <input
                        type="text"
                        value={p.description}
                        onChange={(e) => updateProduct(p.id, { description: e.target.value })}
                        style={{ fontSize: '12px', color: '#8e9bb5', background: 'transparent', border: 'none', borderBottom: '1px dashed #374151', padding: '2px 4px', width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Цена, ₽</label>
                        <input
                          type="number"
                          value={p.price}
                          onChange={(e) => updateProduct(p.id, { price: Number(e.target.value) })}
                          style={{ width: '90px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#38bdf8', fontWeight: 800, padding: '0 8px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Старая цена</label>
                        <input
                          type="number"
                          value={p.oldPrice || ''}
                          placeholder="Скидка"
                          onChange={(e) => updateProduct(p.id, { oldPrice: e.target.value ? Number(e.target.value) : undefined })}
                          style={{ width: '90px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#9ca3af', padding: '0 8px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Бейдж</label>
                        <input
                          type="text"
                          value={p.badge || ''}
                          placeholder="Хит / -15%"
                          onChange={(e) => updateProduct(p.id, { badge: e.target.value || undefined })}
                          style={{ width: '90px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#f59e0b', fontWeight: 700, padding: '0 8px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Категория</label>
                        <input
                          type="text"
                          value={p.category || ''}
                          onChange={(e) => updateProduct(p.id, { category: e.target.value })}
                          style={{ width: '110px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#fff', padding: '0 8px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => duplicateProduct(p)}
                        className="admin-secondary"
                        style={{ padding: '8px 12px' }}
                        title="Клонировать товар"
                      >
                        <Copy size={14} /> Клон
                      </button>
                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        className="admin-secondary"
                        style={{ padding: '8px 12px', color: '#ef4444', borderColor: '#7f1d1d' }}
                        title="Удалить товар"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <details style={{ flex: '1 1 100%', color: '#cbd5e1', fontSize: '12px' }}>
                      <summary style={{ cursor: 'pointer' }}>Характеристики, фотографии и доставка</summary>
                      <div className="product-admin-extra">
                        <label>Тип товара<input value={p.productType || p.category || ''} maxLength={80} onChange={(e) => updateProduct(p.id, { productType: e.target.value })} placeholder="Одежда, электроника…" /></label>
                        <label>Характеристики (одна строка: название: значение)<textarea value={(p.attributes || []).map((item) => `${item.label}: ${item.value}`).join('\n')} onChange={(e) => updateProduct(p.id, { attributes: e.target.value.split('\n').map((row) => { const split = row.indexOf(':'); return split < 0 ? null : { label: row.slice(0, split).trim(), value: row.slice(split + 1).trim() }; }).filter((item): item is { label: string; value: string } => Boolean(item?.label && item.value)) })} placeholder={'Размер: M, L, XL\nМатериал: хлопок'} rows={4} /></label>
                        <label>Дополнительные фото — URL, по одному на строку<textarea value={(p.galleryImages || []).join('\n')} onChange={(e) => updateProduct(p.id, { galleryImages: [...new Set(e.target.value.split('\n').map((url) => url.trim()).filter((url) => /^https:\/\//i.test(url)))].slice(0, 12) })} placeholder="https://…" rows={4} /></label>
                        <label>Остаток на складе (пусто — без ограничения)<input type="number" min="0" step="1" value={p.stockQuantity ?? ''} onChange={(e) => updateProduct(p.id, { stockQuantity: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                        <label>Популярность (для сортировки)<input type="number" min="0" step="1" value={p.popularity ?? ''} onChange={(e) => updateProduct(p.id, { popularity: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                        <label>Дата поступления<input type="date" value={p.createdAt?.slice(0, 10) || ''} onChange={(e) => updateProduct(p.id, { createdAt: e.target.value ? new Date(`${e.target.value}T12:00:00Z`).toISOString() : undefined })} /></label>
                        <label>Преимущества (по одному на строку)<textarea value={(p.details?.advantages || []).join('\n')} onChange={(e) => updateProduct(p.id, { details: { ...p.details, advantages: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 30) } })} rows={3} /></label>
                        <label>Комплектация (по одному на строку)<textarea value={(p.details?.included || []).join('\n')} onChange={(e) => updateProduct(p.id, { details: { ...p.details, included: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 30) } })} rows={3} /></label>
                        <label>Гарантия<input maxLength={500} value={p.details?.warranty || ''} onChange={(e) => updateProduct(p.id, { details: { ...p.details, warranty: e.target.value } })} /></label>
                        <label>Условия доставки<input maxLength={500} value={p.details?.delivery || ''} onChange={(e) => updateProduct(p.id, { details: { ...p.details, delivery: e.target.value } })} /></label>
                        <label>Условия возврата<input maxLength={500} value={p.details?.returns || ''} onChange={(e) => updateProduct(p.id, { details: { ...p.details, returns: e.target.value } })} /></label>
                        <label>Вес, кг<input type="number" min="0" max="1000" step="0.1" value={p.weightKg ?? ''} onChange={(e) => updateProduct(p.id, { weightKg: e.target.value ? Number(e.target.value) : undefined })} /></label>
                        <label>Класс доставки<select value={p.shippingClass || 'standard'} onChange={(e) => updateProduct(p.id, { shippingClass: e.target.value as Product['shippingClass'] })}><option value="standard">Обычный</option><option value="bulky">Крупногабаритный</option><option value="fragile">Хрупкий</option></select></label>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 4: ORDERS (SHOP) ================= */}
          {tab === 'orders' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2>Заказы из корзины ({orders.length})</h2>
                  <p style={{ margin: 0 }}>Входящие заявки покупателей, доставка, состав заказа и онлайн-оплата.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="admin-secondary" onClick={exportOrdersCsv}>
                    <FileSpreadsheet size={15} /> Выгрузка в Excel (CSV)
                  </button>
                  <button type="button" className="admin-primary" onClick={loadData}>
                    <RefreshCw size={15} /> Обновить
                  </button>
                </div>
              </div>

              {orders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        background: 'var(--adm-surface-alt)',
                        border: '1px solid var(--adm-border)',
                        borderRadius: '14px',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '16px', color: '#fff' }}>Заказ #{o.id}</strong>
                          <span style={{ marginLeft: '12px', fontSize: '12px', color: '#8e9bb5' }}>
                            {new Date(o.createdAt).toLocaleString('ru-RU')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span
                            style={{
                              background: o.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: o.paymentStatus === 'paid' ? '#34d399' : '#fbbf24',
                              border: `1px solid ${o.paymentStatus === 'paid' ? '#10b981' : '#f59e0b'}`,
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}
                          >
                            {o.paymentStatus === 'paid' ? '✓ Оплачен онлайн' : 'Ожидает оплаты'}
                          </span>

                          <span
                            style={{
                              background: o.status === 'completed' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.06)',
                              color: o.status === 'completed' ? '#60a5fa' : '#fff',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}
                          >
                            Статус: {o.status === 'new' ? 'Новый' : o.status === 'processing' ? 'В обработке' : o.status === 'completed' ? 'Выполнен' : 'Отменен'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: '#0b0e14', padding: '12px 16px', borderRadius: '10px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#8e9bb5', fontSize: '11px', display: 'block' }}>Покупатель:</span>
                          <strong>{o.customerName}</strong>
                          <div style={{ color: '#38bdf8' }}>{o.customerPhone}</div>
                        </div>

                        <div>
                          <span style={{ color: '#8e9bb5', fontSize: '11px', display: 'block' }}>Доставка:</span>
                          <strong>{o.deliveryType === 'delivery' ? 'Курьерская доставка' : 'Самовывоз'}</strong>
                          {o.deliveryAddress && <div style={{ color: '#cbd5e1' }}>{o.deliveryAddress}</div>}
                        </div>

                        <div>
                          <span style={{ color: '#8e9bb5', fontSize: '11px', display: 'block' }}>Способ оплаты:</span>
                          <strong>{o.paymentMethod === 'online' ? 'Карта онлайн / СБП' : o.paymentMethod === 'cash' ? 'При получении' : 'Перевод на карту'}</strong>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#8e9bb5', fontSize: '11px', display: 'block' }}>Итоговая сумма:</span>
                          <strong style={{ fontSize: '18px', color: '#10b981' }}>{money(o.total)}</strong>
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                        <strong>Состав заказа: </strong>
                        {(o.items || []).map((it) => `${it.name} (×${it.quantity})`).join(', ')}
                      </div>

                      {/* Status actions */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        {o.status !== 'processing' && (
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(o.id, 'processing')}
                            className="admin-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            В обработку
                          </button>
                        )}
                        {o.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(o.id, 'completed', 'paid')}
                            className="admin-primary"
                            style={{ padding: '6px 12px', fontSize: '12px', background: '#10b981' }}
                          >
                            ✓ Заказ выполнен
                          </button>
                        )}
                        {o.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => { const reason = window.prompt('Причина отказа (можно оставить пустой):'); if (reason !== null) void updateOrderStatus(o.id, 'cancelled', undefined, reason); }}
                            className="admin-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', color: '#ef4444' }}
                          >
                            ✕ Отменить
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8e9bb5' }}>
                  Пока нет оформленных заказов. Сделайте тестовый заказ на главной странице!
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 5: SERVICES (BOOKING) ================= */}
          {tab === 'services' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2>Прайс-лист услуг ({config.services.length} поз.)</h2>
                  <p style={{ margin: 0 }}>Настройте перечень процедур, стоимость и длительность в минутах.</p>
                </div>
                <button type="button" className="admin-primary" onClick={addService}>
                  <Plus size={16} /> Добавить услугу
                </button>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Поиск по услугам..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    style={{ width: '100%', height: '40px', background: '#1c2230', border: '1px solid #2d3748', borderRadius: '10px', color: '#fff', padding: '0 12px 0 34px', boxSizing: 'border-box' }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '13px', color: '#8e9bb5' }} />
                </div>

                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  <button
                    type="button"
                    className={`service-category-pill ${serviceCategoryFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setServiceCategoryFilter('all')}
                  >
                    Все ({config.services.length})
                  </button>
                  {existingServiceCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`service-category-pill ${serviceCategoryFilter === c ? 'active' : ''}`}
                      onClick={() => setServiceCategoryFilter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredAdminServices.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: 'var(--adm-surface-alt)',
                      border: '1px solid var(--adm-border)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 260px' }}>
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateService(s.id, { name: e.target.value })}
                        style={{ fontWeight: 800, fontSize: '15px', color: '#fff', background: 'transparent', border: 'none', borderBottom: '1px dashed #4b5563', padding: '2px 4px', width: '100%', marginBottom: '4px' }}
                      />
                      <input
                        type="text"
                        value={s.description}
                        onChange={(e) => updateService(s.id, { description: e.target.value })}
                        style={{ fontSize: '12px', color: '#8e9bb5', background: 'transparent', border: 'none', borderBottom: '1px dashed #374151', padding: '2px 4px', width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Цена, ₽</label>
                        <input
                          type="number"
                          value={s.price}
                          onChange={(e) => updateService(s.id, { price: Number(e.target.value) })}
                          style={{ width: '90px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#38bdf8', fontWeight: 800, padding: '0 8px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Длит-ть (мин)</label>
                        <input
                          type="number"
                          value={s.duration}
                          onChange={(e) => updateService(s.id, { duration: Number(e.target.value) })}
                          style={{ width: '80px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#fff', padding: '0 8px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block' }}>Категория</label>
                        <input
                          type="text"
                          value={s.category || ''}
                          onChange={(e) => updateService(s.id, { category: e.target.value })}
                          style={{ width: '110px', height: '36px', background: '#0b0e14', border: '1px solid #374151', borderRadius: '8px', color: '#fff', padding: '0 8px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => duplicateService(s)} className="admin-secondary" style={{ padding: '8px 12px' }}>
                        <Copy size={14} />
                      </button>
                      <button type="button" onClick={() => removeService(s.id)} className="admin-secondary" style={{ padding: '8px 12px', color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 6: BOOKINGS ================= */}
          {tab === 'bookings' && (
            <div className="admin-panel">
              <BookingCalendar
                bookings={bookings}
                config={config}
                onCreated={loadData}
              />
            </div>
          )}

          {/* ================= TAB 7: DESIGN & COLORS ================= */}
          {tab === 'design' && (
            <div className="admin-panel">
              <h2>Цвета, оттенки и фотографии обложки</h2>
              <p>Настройте индивидуальный фирменный стиль сайта под вашего клиента за пару кликов.</p>

              {/* Exact Custom HEX Color Picker */}
              <div style={{ background: '#0b0e14', border: '1px solid #262f42', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>🎨 Выбор фирменного оттенка (Любой цвет по HEX / пипетке)</h3>
                <p style={{ fontSize: '13px', color: '#8e9bb5', margin: '0 0 16px' }}>
                  Кнопки, бейджи, акценты и иконки моментально адаптируются под выбранный цвет.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => updateField('customAccent', e.target.value)}
                      style={{ width: '48px', height: '48px', borderRadius: '12px', border: '2px solid #3b4763', cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={config.customAccent || activeColor}
                      onChange={(e) => updateField('customAccent', e.target.value)}
                      placeholder="#3b82f6"
                      style={{ width: '110px', height: '44px', background: '#1c2230', border: '1px solid #374151', borderRadius: '10px', color: '#fff', fontWeight: 800, padding: '0 12px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* Quick palette buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {quickPaletteColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => updateField('customAccent', c.hex)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: c.hex,
                          border: activeColor.toLowerCase() === c.hex.toLowerCase() ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Ready Theme Swatches */}
              <h3 style={{ margin: '24px 0 12px', fontSize: '16px' }}>Готовые премиальные палитры</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {themeSwatches.map((t) => (
                  <div
                    key={t.key}
                    onClick={() => {
                      updateField('theme', t.key);
                      updateField('customAccent', t.accentColor);
                    }}
                    style={{
                      background: '#141822',
                      border: config.theme === t.key ? '2px solid #2563eb' : '1px solid #262f42',
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: t.accentColor }} />
                      <strong>{t.title}</strong>
                    </div>
                    <small style={{ color: '#8e9bb5', fontSize: '11px' }}>{t.desc}</small>
                  </div>
                ))}
              </div>

              {/* Hero Image Selection */}
              <h3 style={{ margin: '24px 0 12px', fontSize: '16px' }}>Главная обложка сайта (Hero Banner)</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#8e9bb5', display: 'block', marginBottom: '6px' }}>Прямая ссылка на фото (URL):</label>
                <input
                  type="text"
                  value={config.heroUrl}
                  onChange={(e) => updateField('heroUrl', e.target.value)}
                  style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {photoPresets.map((p) => (
                  <div
                    key={p.url}
                    onClick={() => updateField('heroUrl', p.url)}
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: config.heroUrl === p.url ? '2px solid #2563eb' : '1px solid #262f42',
                      cursor: 'pointer',
                      position: 'relative',
                      height: '110px',
                    }}
                  >
                    <img src={p.url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', alignItems: 'flex-end', padding: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{p.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 8: CONTACTS & DELIVERY ================= */}
          {tab === 'contacts' && (
            <div className="admin-panel">
              <h2>Контакты, график работы и условия доставки</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="input-label">Название компании:</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Слоган / Описание:</label>
                  <input
                    type="text"
                    value={config.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Телефон для связи:</label>
                  <input
                    type="text"
                    value={config.phone}
                    inputMode="numeric"
                    maxLength={11}
                    onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    onBeforeInput={(e) => { const text = (e.nativeEvent as InputEvent).data; if (text && /\D/.test(text)) e.preventDefault(); }}
                    onPaste={(e) => { e.preventDefault(); updateField('phone', e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11)); }}
                    onDrop={(e) => e.preventDefault()}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Адрес шоурума / салона:</label>
                  <input
                    type="text"
                    value={config.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Telegram (юзернейм без @):</label>
                  <input
                    type="text"
                    value={config.telegram || ''}
                    placeholder="my_company"
                    onChange={(e) => updateField('telegram', e.target.value)}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">WhatsApp (номер телефона):</label>
                  <input
                    type="text"
                    value={config.whatsapp || ''}
                    placeholder="+79990001122"
                    inputMode="numeric"
                    maxLength={11}
                    onChange={(e) => updateField('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    onBeforeInput={(e) => { const text = (e.nativeEvent as InputEvent).data; if (text && /\D/.test(text)) e.preventDefault(); }}
                    onPaste={(e) => { e.preventDefault(); updateField('whatsapp', e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11)); }}
                    onDrop={(e) => e.preventDefault()}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Стоимость доставки курьером (₽):</label>
                  <input
                    type="number"
                    value={config.deliveryCost || 350}
                    onChange={(e) => updateField('deliveryCost', Number(e.target.value))}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Бесплатная доставка от суммы (₽):</label>
                  <input
                    type="number"
                    value={config.deliveryPricing?.freeAtSubtotal ?? config.freeDeliveryThreshold ?? 5000}
                    onChange={(e) => { const value = Number(e.target.value); updateField('freeDeliveryThreshold', value); updateField('deliveryPricing', { ...(config.deliveryPricing || DEFAULT_DELIVERY_PRICING), freeAtSubtotal: value }); }}
                    style={{ width: '100%', height: '44px', background: '#0b0e14', border: '1px solid #262f42', borderRadius: '10px', color: '#fff', padding: '0 12px' }}
                  />
                </div>
                <div className="delivery-tiers-editor">
                  <label>Скидки за количество (порог:скидка, ₽)<textarea value={formatDeliveryTiers((config.deliveryPricing || DEFAULT_DELIVERY_PRICING).countDiscounts)} onChange={(e) => updateField('deliveryPricing', { ...(config.deliveryPricing || DEFAULT_DELIVERY_PRICING), countDiscounts: parseDeliveryTiers(e.target.value) })} rows={3} /></label>
                  <label>Скидки за сумму товаров (порог:скидка, ₽)<textarea value={formatDeliveryTiers((config.deliveryPricing || DEFAULT_DELIVERY_PRICING).subtotalDiscounts)} onChange={(e) => updateField('deliveryPricing', { ...(config.deliveryPricing || DEFAULT_DELIVERY_PRICING), subtotalDiscounts: parseDeliveryTiers(e.target.value) })} rows={3} /></label>
                  <label>Надбавка за вес, ₽/кг<input type="number" min="0" value={(config.deliveryPricing || DEFAULT_DELIVERY_PRICING).weightRatePerKg} onChange={(e) => updateField('deliveryPricing', { ...(config.deliveryPricing || DEFAULT_DELIVERY_PRICING), weightRatePerKg: Math.max(0, Number(e.target.value)) })} /></label>
                  <label>Надбавка за крупный товар, ₽<input type="number" min="0" value={(config.deliveryPricing || DEFAULT_DELIVERY_PRICING).classSurcharges.bulky || 0} onChange={(e) => { const current = config.deliveryPricing || DEFAULT_DELIVERY_PRICING; updateField('deliveryPricing', { ...current, classSurcharges: { ...current.classSurcharges, bulky: Math.max(0, Number(e.target.value)) } }); }} /></label>
                  <label>Надбавка за хрупкий товар, ₽<input type="number" min="0" value={(config.deliveryPricing || DEFAULT_DELIVERY_PRICING).classSurcharges.fragile || 0} onChange={(e) => { const current = config.deliveryPricing || DEFAULT_DELIVERY_PRICING; updateField('deliveryPricing', { ...current, classSurcharges: { ...current.classSurcharges, fragile: Math.max(0, Number(e.target.value)) } }); }} /></label>
                  <div className="delivery-tier-hint">Пример: 3:75 означает скидку 75 ₽ при 3 товарах. Доставка бесплатна от заданной выше суммы.</div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 9: PAYMENTS & GATEWAYS ================= */}
          {tab === 'payments' && (
            <div className="admin-panel">
              <h2>Способы приёма оплаты и подключение эквайринга</h2>
              <p>Настройте платежные системы (ЮKassa, Т-Банк, СБП, Наличные) для автоматического приёма платежей.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '680px', marginTop: '16px' }}>
                {/* 1. Online Card / Bank Cards */}
                <div style={{ background: '#0b0e14', padding: '18px', borderRadius: '14px', border: '1px solid #262f42' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CreditCard size={24} color="#38bdf8" />
                      <div>
                        <strong style={{ fontSize: '15px' }}>Банковские карты онлайн (МИР, Visa, Mastercard)</strong>
                        <div style={{ fontSize: '12px', color: '#8e9bb5' }}>Приём платежей через ЮKassa или Т-Банк Оплату</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.paymentMethods?.onlineCard !== false}
                      onChange={(e) =>
                        updateField('paymentMethods', {
                          ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                          onlineCard: e.target.checked,
                        })
                      }
                      style={{ width: '20px', height: '20px' }}
                    />
                  </label>

                  {config.paymentMethods?.onlineCard !== false && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1c2230', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block', marginBottom: '4px' }}>
                          ЮKassa Shop ID (Магазин):
                        </label>
                        <input
                          type="text"
                          placeholder="Например: 123456"
                          value={config.paymentMethods?.yookassaShopId || ''}
                          onChange={(e) =>
                            updateField('paymentMethods', {
                              ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                              yookassaShopId: e.target.value,
                            })
                          }
                          style={{ width: '100%', height: '38px', background: '#141822', border: '1px solid #262f42', borderRadius: '8px', color: '#fff', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block', marginBottom: '4px' }}>
                          Секретный ключ API:
                        </label>
                        <input
                          type="password"
                          placeholder="live_... или test_..."
                          value={config.paymentMethods?.yookassaSecretKey || ''}
                          onChange={(e) =>
                            updateField('paymentMethods', {
                              ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                              yookassaSecretKey: e.target.value,
                            })
                          }
                          style={{ width: '100%', height: '38px', background: '#141822', border: '1px solid #262f42', borderRadius: '8px', color: '#fff', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. SBP Online */}
                <div style={{ background: '#0b0e14', padding: '18px', borderRadius: '14px', border: '1px solid #262f42' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Tag size={24} color="#f59e0b" />
                      <div>
                        <strong style={{ fontSize: '15px' }}>Система Быстрых Платежей (СБП по QR-коду)</strong>
                        <div style={{ fontSize: '12px', color: '#8e9bb5' }}>Клиент сканирует QR-код и оплачивает без ввода данных карты</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.paymentMethods?.sbpOnline !== false}
                      onChange={(e) =>
                        updateField('paymentMethods', {
                          ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                          sbpOnline: e.target.checked,
                        })
                      }
                      style={{ width: '20px', height: '20px' }}
                    />
                  </label>

                  {config.paymentMethods?.sbpOnline !== false && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1c2230', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block', marginBottom: '4px' }}>
                          Номер телефона для СБП:
                        </label>
                        <input
                          type="text"
                          placeholder="+7 (999) 000-00-00"
                          value={config.paymentMethods?.sbpPhone || config.phone || ''}
                          inputMode="numeric"
                          maxLength={11}
                          onChange={(e) =>
                            updateField('paymentMethods', {
                              ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                              sbpPhone: e.target.value.replace(/\D/g, '').slice(0, 11),
                            })
                          }
                          onBeforeInput={(e) => { const text = (e.nativeEvent as InputEvent).data; if (text && /\D/.test(text)) e.preventDefault(); }}
                          onPaste={(e) => { e.preventDefault(); updateField('paymentMethods', { ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }), sbpPhone: e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11) }); }}
                          onDrop={(e) => e.preventDefault()}
                          style={{ width: '100%', height: '38px', background: '#141822', border: '1px solid #262f42', borderRadius: '8px', color: '#fff', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#8e9bb5', display: 'block', marginBottom: '4px' }}>
                          Банк получателя:
                        </label>
                        <input
                          type="text"
                          placeholder="Т-Банк / Сбер / Альфа"
                          value={config.paymentMethods?.sbpBankName || 'Т-Банк'}
                          onChange={(e) =>
                            updateField('paymentMethods', {
                              ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                              sbpBankName: e.target.value,
                            })
                          }
                          style={{ width: '100%', height: '38px', background: '#141822', border: '1px solid #262f42', borderRadius: '8px', color: '#fff', padding: '0 10px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Cash on delivery */}
                <div style={{ background: '#0b0e14', padding: '18px', borderRadius: '14px', border: '1px solid #262f42' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Truck size={24} color="#10b981" />
                      <div>
                        <strong style={{ fontSize: '15px' }}>Оплата при получении (Наличными или курьеру)</strong>
                        <div style={{ fontSize: '12px', color: '#8e9bb5' }}>Покупатель оплачивает заказ при выдаче или визите</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.paymentMethods?.cashOnDelivery !== false}
                      onChange={(e) =>
                        updateField('paymentMethods', {
                          ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                          cashOnDelivery: e.target.checked,
                        })
                      }
                      style={{ width: '20px', height: '20px' }}
                    />
                  </label>
                </div>

                {/* 4. Sandbox / Test mode toggle */}
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div>
                      <strong style={{ color: '#93c5fd' }}>🧪 Тестовый режим оплаты (Демо-шлюз)</strong>
                      <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                        Позволяет клиентам и вам проверять оформление и оплату без списания реальных рублей.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.paymentMethods?.testMode !== false}
                      onChange={(e) =>
                        updateField('paymentMethods', {
                          ...(config.paymentMethods || { onlineCard: true, sbpOnline: true, cashOnDelivery: true, cardTransfer: true }),
                          testMode: e.target.checked,
                        })
                      }
                      style={{ width: '20px', height: '20px' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 10: SECURITY (PASSWORD MANAGEMENT) ================= */}
          {tab === 'security' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', display: 'grid', placeItems: 'center', color: '#60a5fa' }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>Пароль и безопасность панели</h2>
                  <p style={{ margin: 0, color: '#8e9bb5', fontSize: '13px' }}>
                    Настройки входа хранятся в переменных окружения сервера.
                  </p>
                </div>
              </div>

              <div style={{ background: '#0b0e14', border: '1px solid #262f42', borderRadius: '16px', padding: '24px', maxWidth: '520px', marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', color: '#34d399', fontSize: '13px' }}>
                  <KeyRound size={18} />
                  <span>
                    Пароль сравнивается с bcrypt-хешем. Сессия подписана сервером и хранится в HttpOnly cookie.
                  </span>
                </div>

                <div style={{ marginTop: '16px', fontSize: '12px', color: '#8e9bb5', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid #1c2230' }}>
                  ⚠️ Для запуска задайте <code>AUTH_SECRET</code> и <code>ADMIN_PASSWORD_HASH</code>. После трёх ошибок вход блокируется на час.
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 10: GUIDE & DEPLOYMENT ================= */}
          {tab === 'guide' && (
            <div className="admin-panel guide-container">
              <h2>Руководство по запуску, продаже и хостингу сайта</h2>
              <p>Пошаговая инструкция, как продавать этот шаблон разным клиентам и зарабатывать на внедрении.</p>

              <div className="guide-step-card">
                <div className="guide-step-number">1</div>
                <div className="guide-step-content">
                  <h3>Как подготовить сайт под нового заказчика (Схема работы)</h3>
                  <ul>
                    <li>
                      <strong>Шаг 1:</strong> Включите вверху <strong>«Режим Разработчика»</strong>.
                    </li>
                    <li>
                      <strong>Шаг 2:</strong> Выберите отрасль на вкладке «Готовые ниши» (Магазин, Автосалон, Барбершоп, Спа и т.д.) или выберите тип: <em>Только Магазин с Корзиной</em> или <em>Только Услуги</em>.
                    </li>
                    <li>
                      <strong>Шаг 3:</strong> Нажмите кнопку <strong>«🔒 Зафиксировать и отдать клиенту»</strong>.
                    </li>
                    <li>
                      <strong>Результат:</strong> Вкладка «Готовые ниши» скроется! Покупатель видит только свои товары, заказы, контакты и цвета.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-number">2</div>
                <div className="guide-step-content">
                  <h3>Экспорт, импорт и скачивание исходников (.ZIP)</h3>
                  <div className="guide-tools-grid">
                    <div className="guide-tool-card" style={{ border: '1px solid #2563eb', background: 'rgba(37,99,235,0.06)' }}>
                      <div>
                        <h4>📦 Скачать весь проект (ZIP-архив)</h4>
                        <p>Полный исходный код Next.js 16 + React 19 + Tailwind v4 + все компоненты, админка и база данных.</p>
                      </div>
                      <a
                        href="/project-source.zip"
                        download="universal-booking-site-source.zip"
                        className="admin-primary"
                        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={15} /> Скачать ZIP
                      </a>
                    </div>

                    <div className="guide-tool-card">
                      <div>
                        <h4>📥 Экспорт настроек (JSON)</h4>
                        <p>Сохранить только конфигурацию конкретного клиента в один файл.</p>
                      </div>
                      <button type="button" className="admin-secondary" onClick={exportConfigJson}>
                        <Download size={15} /> Скачать JSON
                      </button>
                    </div>

                    <div className="guide-tool-card">
                      <div>
                        <h4>📤 Импорт настроек (JSON)</h4>
                        <p>Мгновенно развернуть ранее сохраненного клиента из файла.</p>
                      </div>
                      <button type="button" className="admin-secondary" onClick={() => setShowJsonModal(true)}>
                        <Upload size={15} /> Вставить JSON
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-number">3</div>
                <div className="guide-step-content">
                  <h3>Команды для запуска на сервере или локально</h3>
                  <div style={{ background: '#0b0e14', border: '1px solid #262f42', borderRadius: '12px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6, color: '#e2e8f0' }}>
                    <div style={{ color: '#8e9bb5' }}># 1. Установка пакетов:</div>
                    <div style={{ color: '#60a5fa' }}>npm install</div>
                    <div style={{ color: '#8e9bb5', marginTop: '10px' }}># 2. Локальный запуск:</div>
                    <div style={{ color: '#60a5fa' }}>npm run dev</div>
                    <div style={{ color: '#8e9bb5', marginTop: '10px' }}># 3. Сборка для боевого сервера (Production):</div>
                    <div style={{ color: '#34d399' }}>npm run build</div>
                    <div style={{ color: '#34d399' }}>npm start</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* JSON Import Modal */}
      {showJsonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--adm-surface)', border: '1px solid var(--adm-border)', borderRadius: '16px', padding: '24px', maxWidth: '560px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Импорт конфигурации (JSON)</h3>
              <button type="button" onClick={() => setShowJsonModal(false)} style={{ background: 'none', border: 0, color: '#8e9bb5', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <textarea
              style={{ width: '100%', height: '180px', background: '#1c2230', border: '1px solid #2d3748', borderRadius: '10px', color: '#fff', padding: '12px', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box', marginBottom: '16px' }}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"name": "Мой магазин", "products": [...]}'
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="admin-secondary" onClick={() => setShowJsonModal(false)}>
                Отмена
              </button>
              <button type="button" className="admin-primary" onClick={importConfigJson}>
                Применить конфигурацию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

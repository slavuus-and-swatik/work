export type PresetKey =
  | 'shop'
  | 'car_dealership'
  | 'barbershop'
  | 'massage'
  | 'beauty'
  | 'auto'
  | 'custom'
  | 'photo'
  | 'fitness'
  | 'medical'
  | 'tattoo'
  | 'cleaning';

export type ThemeKey =
  | 'navy'
  | 'graphite'
  | 'light'
  | 'emerald'
  | 'amber'
  | 'ruby'
  | 'violet'
  | 'cyan'
  | 'custom';

export const DEFAULT_DELIVERY_PRICING: NonNullable<Config['deliveryPricing']> = {
  freeAtSubtotal: 5000,
  countDiscounts: [{ from: 3, amount: 75 }, { from: 5, amount: 150 }, { from: 8, amount: 250 }],
  subtotalDiscounts: [{ from: 5000, amount: 50 }, { from: 10000, amount: 125 }, { from: 20000, amount: 200 }],
  classSurcharges: { standard: 0, bulky: 250, fragile: 120 },
  weightRatePerKg: 15,
};

export type SiteMode = 'services' | 'shop' | 'hybrid';
export type AdminMode = 'client' | 'developer';

export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // minutes
  icon?: string;
  category?: string;
  inspection?: boolean;
  enabled: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  imageUrl: string;
  category: string;
  badge?: string; // 'Хит' | 'Новинка' | '-20%' | 'Скидка' | 'В наличии'
  inStock: boolean;
  enabled: boolean;
  /** Extensible, product-specific details shown on the product page. */
  productType?: string;
  attributes?: Array<{ label: string; value: string }>;
  galleryImages?: string[];
  stockQuantity?: number;
  popularity?: number;
  createdAt?: string;
  details?: {
    advantages?: string[];
    included?: string[];
    warranty?: string;
    delivery?: string;
    returns?: string;
  };
  weightKg?: number;
  shippingClass?: 'standard' | 'bulky' | 'fragile';
};

export type PaymentMethodsConfig = {
  onlineCard: boolean; // Банковская карта онлайн
  sbpOnline?: boolean; // СБП (Система быстрых платежей)
  cashOnDelivery: boolean; // При получении курьеру / самовывоз
  cardTransfer: boolean; // Перевод на карту / СБП по телефону
  yookassaShopId?: string;
  yookassaSecretKey?: string;
  tbankTerminalKey?: string;
  sbpPhone?: string;
  sbpBankName?: string;
  testMode?: boolean;
};

export type Config = {
  // Business Model & Admin Mode
  siteMode: SiteMode; // 'services' | 'shop' | 'hybrid'
  adminMode: AdminMode; // 'client' hides niche preset picker; 'developer' shows everything
  lockNiche?: boolean; // When true, client cannot switch niche
  
  // Brand & Visuals
  niche: PresetKey;
  nicheLabel: string;
  name: string;
  tagline: string;
  aboutText: string;
  address: string;
  phone: string;
  email?: string;
  telegram?: string;
  whatsapp?: string;
  mapUrl: string;
  heroUrl: string;
  theme: ThemeKey;
  primaryColor?: string;
  accentColor?: string;
  customAccent?: string;
  customBg?: string;

  // Booking settings
  capacityUnit: string;
  posts: number;
  buffer: number;
  mode: 'request' | 'instant';
  open: string;
  close: string;
  workDays: number[];
  closedDates: string[];
  services: Service[];

  // E-Commerce Store settings
  products: Product[];
  deliveryCost: number;
  freeDeliveryThreshold?: number;
  deliveryPricing?: {
    freeAtSubtotal: number;
    countDiscounts: Array<{ from: number; amount: number }>;
    subtotalDiscounts: Array<{ from: number; amount: number }>;
    classSurcharges: Partial<Record<'standard' | 'bulky' | 'fragile', number>>;
    weightRatePerKg: number;
  };
  currency: string;
  paymentMethods: PaymentMethodsConfig;
  cartEnabled: boolean;
  promoCode?: {
    code: string;
    discountPercent: number;
  };

  // Auto specific (if auto niche)
  diameterFactor?: Record<string, number>;
  suvExtra?: number;
  runflatExtra?: number;
};

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

export type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryCost?: number;
  subtotal?: number;
  discount?: number;
  rejectionReason?: string;
  customerAccessToken?: string;
  paymentMethod: 'online' | 'cash' | 'transfer';
  paymentStatus: 'paid' | 'pending';
  status: 'new' | 'processing' | 'completed' | 'cancelled';
  comment?: string;
  createdAt: string;
};

export const presets: Record<PresetKey, Config> = {
  shop: {
    siteMode: 'shop',
    adminMode: 'client',
    lockNiche: false,
    niche: 'shop',
    nicheLabel: 'Интернет-магазин и Витрина товаров',
    name: 'AURA Store',
    tagline: 'Трендовая одежда, премиальные аксессуары и быстрая доставка по всей России.',
    aboutText: 'Капсульные коллекции, натуральные ткани и безупречный крой. Гарантия качества на каждое изделие и примерка перед покупкой.',
    address: 'Москва, ул. Петровка, 15',
    phone: '+7 (999) 700-11-22',
    email: 'orders@aurastore.ru',
    telegram: 'aurastore_shop',
    whatsapp: '+79997001122',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    theme: 'graphite',
    accentColor: '#3b82f6',
    capacityUnit: 'менеджеров / смен',
    posts: 2,
    buffer: 0,
    mode: 'instant',
    open: '10:00',
    close: '22:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    services: [],
    deliveryCost: 350,
    freeDeliveryThreshold: 5000,
    deliveryPricing: DEFAULT_DELIVERY_PRICING,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      sbpOnline: true,
      cashOnDelivery: true,
      cardTransfer: true,
      testMode: true,
      sbpPhone: '+7 (999) 700-11-22',
      sbpBankName: 'Т-Банк / Сбербанк',
    },
    promoCode: {
      code: 'START10',
      discountPercent: 10,
    },
    products: [
      {
        id: 'p_hoodie',
        name: 'Оверсайз худи Heavy Cotton (Графит)',
        description: 'Плотный хлопковый футер 460г/м². Спущенное плечо, двойной капюшон и фирменный минималистичный крой.',
        price: 5400,
        oldPrice: 6900,
        imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
        category: 'Одежда',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
      {
        id: 'p_tshirt',
        name: 'Базовая футболка Premium Fit (Молочный)',
        description: '100% гребенной хлопок высшего качества. Идеальная посадка, сохраняет форму после многочисленных стирок.',
        price: 2600,
        oldPrice: 3200,
        imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
        category: 'Одежда',
        badge: 'Новинка',
        inStock: true,
        enabled: true,
      },
      {
        id: 'p_jacket',
        name: 'Куртка-бомбер с водоотталкивающей пропиткой',
        description: 'Легкий и практичный городской бомбер с металлической молнией YKK и трикотажными манжетами.',
        price: 8900,
        oldPrice: 10500,
        imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
        category: 'Верхняя одежда',
        badge: '-15%',
        inStock: true,
        enabled: true,
      },
      {
        id: 'p_bag',
        name: 'Кожаная кросс-боди сумка Minimalist',
        description: 'Натуральная зернистая кожа, надежная фурнитура, внутренний органайзер для телефона и карт.',
        price: 4900,
        oldPrice: 5900,
        imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        category: 'Аксессуары',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
      {
        id: 'p_cap',
        name: 'Бейсболка с объемной вышивкой',
        description: 'Классический 6-панельный силуэт, регулируемый металлический зажим сзади, дышащий хлопок.',
        price: 1900,
        imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80',
        category: 'Аксессуары',
        badge: 'В наличии',
        inStock: true,
        enabled: true,
      },
      {
        id: 'p_glasses',
        name: 'Солнцезащитные очки в ацетатной оправе',
        description: 'Поляризационные линзы UV400, защита от бликов, чехол и микрофибра в комплекте.',
        price: 3800,
        oldPrice: 4500,
        imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
        category: 'Аксессуары',
        badge: 'Новинка',
        inStock: true,
        enabled: true,
      },
    ],
  },

  car_dealership: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'car_dealership',
    nicheLabel: 'Автосалон, Продажа авто & Детейлинг',
    name: 'AutoPrime Motors',
    tagline: 'Автомобили с проверенным пробегом, бронирование тест-драйва и премиальное дооснащение.',
    aboutText: 'Более 150 проверенных автомобилей в крытом шоуруме. Полная юридическая чистота, диагностика по 120 пунктам, трейд-ин и гарантия 1 год.',
    address: 'Москва, Рублёвское шоссе, 68',
    phone: '+7 (495) 790-20-30',
    email: 'sales@autoprime-motors.ru',
    telegram: 'autoprime_motors',
    whatsapp: '+74957902030',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    theme: 'navy',
    capacityUnit: 'экспертов / постов тест-драйва',
    posts: 3,
    buffer: 15,
    mode: 'request',
    open: '09:00',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    freeDeliveryThreshold: 0,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'cd_testdrive', name: 'Запись на индивидуальный тест-драйв', description: 'Поездка по городу и трассе с менеджером, разбор комплектации и опций', price: 0, duration: 45, icon: 'shield', category: 'Тест-драйв', enabled: true },
      { id: 'cd_tradein', name: 'Оценка авто по программе Trade-In', description: 'Инструментальная диагностика вашего авто за 30 минут с гарантией лучшей цены выкупа', price: 0, duration: 40, icon: 'badge', category: 'Трейд-ин', enabled: true },
      { id: 'cd_diag', name: 'Комплексная диагностика автомобиля перед покупкой', description: 'Замер ЛКП толщиномером, эндоскопия двигателя, проверка электроники и баз', price: 4500, duration: 60, icon: 'sparkles', category: 'Сервис', enabled: true },
      { id: 'cd_ceramic', name: 'Керамическое покрытие кузова (2 слоя)', description: 'Глубокий зеркальный блеск, мощный гидрофоб и защита от дорожных реагентов', price: 29000, duration: 240, icon: 'sparkles', category: 'Детейлинг', inspection: true, enabled: true },
      { id: 'cd_film', name: 'Оклейка зон риска полиуретановой бронепленкой', description: 'Капот, бампер, фары, зеркала и стойки: защита от сколов и гравия', price: 45000, duration: 300, icon: 'shield', category: 'Детейлинг', inspection: true, enabled: true },
    ],
    products: [
      {
        id: 'car_1',
        name: 'Porsche Macan GTS 2.9 (2022) 440 л.с.',
        description: 'Официальный дилерский авто, пробег 24 000 км, без окрасов, максимальная комплектация Sport Chrono.',
        price: 8900000,
        imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
        category: 'Автомобили в наличии',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
      {
        id: 'car_2',
        name: 'BMW M340i xDrive (2023) 387 л.с.',
        description: 'Панорама, лазерные фары Laserlight, проекция на лобовое стекло, цвет Dravit Grey.',
        price: 6450000,
        imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
        category: 'Автомобили в наличии',
        badge: 'Новинка',
        inStock: true,
        enabled: true,
      },
      {
        id: 'prod_chem',
        name: 'Премиальный детейлинг-набор по уходу за кожей и салоном',
        description: 'Очиститель, кондиционер с матовым эффектом, щетка с конским волосом и микрофибры.',
        price: 4900,
        oldPrice: 5900,
        imageUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80',
        category: 'Аксессуары и автохимия',
        badge: 'В наличии',
        inStock: true,
        enabled: true,
      },
    ],
  },

  barbershop: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'barbershop',
    nicheLabel: 'Барбершоп и мужские стрижки',
    name: 'Chop & Blade',
    tagline: 'Премиальные мужские стрижки, уход за бородой и правильная атмосфера.',
    aboutText: 'Мужское пространство, где ценят точную геометрию стрижки, стиль и комфорт. Работаем без суеты и очередей.',
    address: 'Москва, ул. Большая Дмитровка, 12/1',
    phone: '+7 (999) 450-20-10',
    email: 'info@chopblade.ru',
    telegram: 'chopblade_bot',
    whatsapp: '+79994502010',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
    theme: 'graphite',
    capacityUnit: 'кресел / барберов',
    posts: 3,
    buffer: 10,
    mode: 'instant',
    open: '10:00',
    close: '22:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 300,
    freeDeliveryThreshold: 3500,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'b_haircut', name: 'Мужская классическая стрижка', description: 'Мытье головы, подбор формы, стрижка и премиальная укладка', price: 1900, duration: 45, icon: 'scissors', category: 'Стрижки', enabled: true },
      { id: 'b_fade', name: 'Стрижка Fade / Кроп', description: 'Идеальный дымчатый срез с переходом от нуля и текстурирование', price: 2200, duration: 50, icon: 'scissors', category: 'Стрижки', enabled: true },
      { id: 'b_beard', name: 'Моделирование и стрижка бороды', description: 'Геометрия контуров, распаривание, стрижка и уход маслами', price: 1300, duration: 35, icon: 'sparkles', category: 'Борода', enabled: true },
      { id: 'b_combo', name: 'Комплекс: Стрижка + Борода', description: 'Полный образ: стрижка волос, моделирование бороды и стайлинг', price: 2900, duration: 75, icon: 'shield', category: 'Комплексы', enabled: true },
      { id: 'b_shave', name: 'Королевское бритьё опасной бритвой', description: 'Распаривание горячими полотенцами, бритьё, холодный компресс', price: 1700, duration: 40, icon: 'badge', category: 'Бритьё', enabled: true },
      { id: 'b_camo', name: 'Камуфляж седины и спа-уход для лица', description: 'Естественное тонирование волос или бороды и очищение лица', price: 1500, duration: 30, icon: 'heart', category: 'Уход', enabled: true },
    ],
    products: [
      {
        id: 'bp_clay',
        name: 'Матовая глина для укладки волос Matte Clay (100 мл)',
        description: 'Сильная фиксация без блеска. Естественная подвижная текстура с ароматом табака и ванили.',
        price: 1850,
        oldPrice: 2200,
        imageUrl: 'https://images.unsplash.com/photo-1597852074816-d933c7d2b988?auto=format&fit=crop&w=800&q=80',
        category: 'Стайлинг',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
      {
        id: 'bp_oil',
        name: 'Органическое масло для роста и смягчения бороды',
        description: 'Комплекс из 7 натуральных масел с маслом арганы и жожоба. Устраняет зуд и дарит мягкость.',
        price: 1450,
        imageUrl: 'https://images.unsplash.com/photo-1626015486790-27f9191d9045?auto=format&fit=crop&w=800&q=80',
        category: 'Уход за бородой',
        badge: 'Новинка',
        inStock: true,
        enabled: true,
      },
      {
        id: 'bp_shampoo',
        name: 'Освежающий шампунь с маслом чайного дерева и ментолом',
        description: 'Глубокое очищение кожи головы, тонус и здоровый блеск волос на весь день.',
        price: 1600,
        imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80',
        category: 'Шампуни',
        badge: 'В наличии',
        inStock: true,
        enabled: true,
      },
    ],
  },

  massage: {
    siteMode: 'services',
    adminMode: 'client',
    lockNiche: false,
    niche: 'massage',
    nicheLabel: 'Студия массажа и релакса',
    name: 'Гармония & Спа',
    tagline: 'Восстановление сил, снятие мышечных зажимов и глубокий релакс.',
    aboutText: 'Сертифицированные мастера с медицинским образованием. Индивидуальный подбор техник под ваше самочувствие.',
    address: 'Москва, Кутузовский проспект, 24',
    phone: '+7 (999) 820-30-40',
    email: 'relax@garmoniya-spa.ru',
    telegram: 'garmoniya_spa',
    whatsapp: '+79998203040',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
    theme: 'emerald',
    capacityUnit: 'кабинетов / мастеров',
    posts: 2,
    buffer: 15,
    mode: 'request',
    open: '09:00',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 300,
    freeDeliveryThreshold: 3000,
    currency: '₽',
    cartEnabled: false,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'm_relax', name: 'Классический релакс-массаж всего тела', description: 'Мягкое снятие усталости, натуральные аромамасла и расслабление мышц', price: 3200, duration: 60, icon: 'heart', category: 'Релакс', enabled: true },
      { id: 'm_sport', name: 'Спортивный глубокотканный массаж', description: 'Проработка триггерных точек, устранение спазмов и боли в мышцах', price: 3800, duration: 60, icon: 'shield', category: 'Оздоровление', enabled: true },
      { id: 'm_back', name: 'Массаж спины и шейно-воротниковой зоны', description: 'Прицельная работа с осанкой, зажимами в шее и пояснице', price: 2400, duration: 40, icon: 'sparkles', category: 'Оздоровление', enabled: true },
      { id: 'm_lymph', name: 'Лимфодренажный массаж тела', description: 'Устранение отёков, улучшение обмена веществ и лёгкость в теле', price: 3400, duration: 60, icon: 'heart', category: 'Коррекция', enabled: true },
      { id: 'm_face', name: 'Скульптурный массаж лица и декольте', description: 'Безоперационный лифтинг, снятие отёчности и здоровый тонус кожи', price: 2800, duration: 45, icon: 'badge', category: 'Лицо', enabled: true },
      { id: 'm_spa', name: 'Спа-ритуал с горячими камнями (Stone-терапия)', description: 'Прогревание базальтовыми камнями и антистресс-программа', price: 4500, duration: 90, icon: 'heart', category: 'Релакс', enabled: true },
    ],
    products: [
      {
        id: 'mp_cert',
        name: 'Подарочный спа-сертификат на 5 000 ₽',
        description: 'Красивая дизайнерская открытка в бархатном конверте на любые процедуры студии.',
        price: 5000,
        imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
        category: 'Сертификаты',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
    ],
  },

  beauty: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'beauty',
    nicheLabel: 'Салон красоты и бьюти-студия',
    name: 'Aura Studio',
    tagline: 'Эстетика образа, здоровье волос и безупречный ногтевой сервис.',
    aboutText: 'Уютная бьюти-студия с напитками, заботливым сервисом и топ-мастерами.',
    address: 'Москва, Пресненская наб., 8 стр. 1',
    phone: '+7 (999) 777-66-55',
    email: 'booking@aurastudio.ru',
    telegram: 'aura_beauty_studio',
    whatsapp: '+79997776655',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    theme: 'amber',
    capacityUnit: 'мастеров / кресел',
    posts: 3,
    buffer: 10,
    mode: 'instant',
    open: '10:00',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 300,
    freeDeliveryThreshold: 4000,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'b_hair', name: 'Женская модельная стрижка + укладка', description: 'Мытье, восстанавливающий спа-уход, стрижка по форме лица и брашинг', price: 2700, duration: 60, icon: 'scissors', category: 'Волосы', enabled: true },
      { id: 'b_color', name: 'Сложное окрашивание (AirTouch / Balayage)', description: 'Плавный рисунок, бережное осветление и стойкое тонирование', price: 7900, duration: 180, icon: 'sparkles', category: 'Волосы', inspection: true, enabled: true },
      { id: 'b_mani', name: 'Маникюр с выравниванием и гель-лаком', description: 'Снятие, аппаратная обработка кутикулы, идеальный блик и цвет', price: 2400, duration: 90, icon: 'heart', category: 'Ногти', enabled: true },
      { id: 'b_pedi', name: 'Smart-педикюр полный комплекс', description: 'Обработка стоп smart-дисками, пальчики и стойкое покрытие', price: 3200, duration: 80, icon: 'shield', category: 'Ногти', enabled: true },
      { id: 'b_brows', name: 'Архитектура бровей + ламинирование', description: 'Моделирование формы, стойкое окрашивание и долговременная фиксация', price: 2300, duration: 50, icon: 'sparkles', category: 'Брови', enabled: true },
      { id: 'b_care', name: 'Счастье для волос (Глубокое спа-восстановление)', description: 'Многоступенчатая молекулярная терапия для блеска и плотности волос', price: 3500, duration: 60, icon: 'badge', category: 'Волосы', enabled: true },
    ],
    products: [
      {
        id: 'be_serum',
        name: 'Питательная сыворотка для кончиков волос с аргановым маслом',
        description: 'Предотвращает сечение волос, термозащита до 230°C и шелковистый блеск.',
        price: 2400,
        imageUrl: 'https://images.unsplash.com/photo-1608248597359-00994f38758d?auto=format&fit=crop&w=800&q=80',
        category: 'Уход за волосами',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
    ],
  },

  auto: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'auto',
    nicheLabel: 'Автосервис, шиномонтаж и детейлинг',
    name: 'АвтоСлот Сервис',
    tagline: 'Честный автосервис и шиномонтаж. Точное время, понятные цены.',
    aboutText: 'Современное оборудование Hofmann, подъёмники и сертифицированные мастера. Работаем строго по записи без очередей.',
    address: 'Москва, ул. Автомоторная, 7',
    phone: '+7 (999) 123-45-67',
    email: 'info@autoslot.ru',
    telegram: 'autoslot_service',
    whatsapp: '+79991234567',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=1200&q=80',
    theme: 'navy',
    capacityUnit: 'рабочих постов / боксов',
    posts: 2,
    buffer: 10,
    mode: 'request',
    open: '09:00',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 500,
    freeDeliveryThreshold: 8000,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'a_tires', name: 'Сезонная замена 4 колес с балансировкой', description: 'Снятие, монтаж, мойка колес и высокоточная калибровка на стенде', price: 2600, duration: 50, icon: 'wheel', category: 'Шиномонтаж', enabled: true },
      { id: 'a_balance', name: 'Балансировка 4 колес и устранение вибрации', description: 'Высокоточная калибровка дисков и устранение биения на скорости', price: 1600, duration: 35, icon: 'balance', category: 'Шиномонтаж', enabled: true },
      { id: 'a_to', name: 'Плановое техническое обслуживание (ТО)', description: 'Замена моторного масла, масляного, салонного и воздушного фильтров', price: 2400, duration: 50, icon: 'repair', category: 'Сервис', enabled: true },
      { id: 'a_diag', name: 'Комплексная диагностика автомобиля', description: 'Проверка ходовой части, тормозов, компьютерная диагностика блоков', price: 1800, duration: 40, icon: 'storage', category: 'Сервис', enabled: true },
      { id: 'a_detail', name: 'Глубокая химчистка салона с сушкой', description: 'Очистка сидений, ковров, потолка профессиональным торнадором', price: 6500, duration: 180, icon: 'sparkles', category: 'Детейлинг', inspection: true, enabled: true },
      { id: 'a_polish', name: 'Восстановительная полировка кузова + воск', description: 'Устранение паутины, глубокий глянец и гидрофобная защита лака', price: 7900, duration: 240, icon: 'badge', category: 'Детейлинг', inspection: true, enabled: true },
    ],
    products: [
      {
        id: 'auto_oil',
        name: 'Моторное масло Motul 8100 X-cess 5W-40 (4 л)',
        description: '100% синтетическое моторное масло для бензиновых и дизельных двигателей. Официальная поставка.',
        price: 4900,
        imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80',
        category: 'Масла и жидкости',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
      {
        id: 'auto_chem',
        name: 'Гидрофобный полимер-силант для кузова Wet Coat',
        description: 'Быстрая защита кузова при мойке: мгновенный водоотталкивающий эффект до 2 месяцев.',
        price: 1800,
        imageUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80',
        category: 'Автохимия',
        badge: 'В наличии',
        inStock: true,
        enabled: true,
      },
    ],
    diameterFactor: { '13': 0.8, '14': 0.9, '15': 1, '16': 1.15, '17': 1.3, '18': 1.5, '19': 1.7, '20': 1.95, '21': 2.2, '22': 2.5 },
    suvExtra: 500,
    runflatExtra: 800,
  },

  custom: {
    siteMode: 'services',
    adminMode: 'client',
    lockNiche: false,
    niche: 'custom',
    nicheLabel: 'Частный специалист и студия услуг',
    name: 'МастерСлот | Онлайн-приём',
    tagline: 'Персональный подход, удобное расписание и гарантированный результат.',
    aboutText: 'Удобный сервис онлайн-бронирования для записи к частным экспертам, психологам, коучам, юристам и репетиторам.',
    address: 'Москва, Тверская улица, 9',
    phone: '+7 (999) 333-22-11',
    email: 'hello@masterslot.ru',
    telegram: 'masterslot_booking',
    whatsapp: '+79993332211',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    theme: 'navy',
    capacityUnit: 'специалистов',
    posts: 1,
    buffer: 10,
    mode: 'instant',
    open: '09:00',
    close: '20:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    currency: '₽',
    cartEnabled: false,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'c_primary', name: 'Первичная очная консультация / приём', description: 'Полный аудит вопроса, детальный разбор и пошаговый план действий', price: 3500, duration: 60, icon: 'sparkles', category: 'Консультации', enabled: true },
      { id: 'c_online', name: 'Онлайн-консультация (Zoom / Telegram)', description: 'Удобный дистанционный формат с видеосвязью и записью встречи', price: 3000, duration: 60, icon: 'badge', category: 'Консультации', enabled: true },
      { id: 'c_express', name: 'Экспресс-разбор точечного вопроса', description: 'Быстрое решение одной конкретной задачи за полчаса', price: 1900, duration: 30, icon: 'shield', category: 'Экспресс', enabled: true },
      { id: 'c_deep', name: 'Расширенная сессия с практической проработкой', description: 'Глубокая индивидуальная работа и сопровождение до результата', price: 6000, duration: 90, icon: 'heart', category: 'Пакеты', enabled: true },
      { id: 'c_month', name: 'Месячный абонемент на сопровождение (4 сессии)', description: 'Регулярная системная работа с приоритетной записью в календаре', price: 12000, duration: 60, icon: 'badge', category: 'Пакеты', enabled: true },
    ],
    products: [],
  },

  photo: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'photo',
    nicheLabel: 'Фотостудия и видеопродакшн',
    name: 'Lumen Studio',
    tagline: 'Профессиональные съёмочные залы, циклорама и импульсный свет.',
    aboutText: 'Просторная студия с естественным светом, гримёрной зоной, профессиональным оборудованием Profoto и комфортной зоной отдыха.',
    address: 'Москва, ул. Правды, 24 стр. 3',
    phone: '+7 (999) 555-44-33',
    email: 'rent@lumenstudio.ru',
    telegram: 'lumen_studio_rent',
    whatsapp: '+79995554433',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?auto=format&fit=crop&w=1200&q=80',
    theme: 'graphite',
    capacityUnit: 'съёмочных залов',
    posts: 2,
    buffer: 15,
    mode: 'instant',
    open: '09:00',
    close: '23:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'ph_white', name: 'Аренда зала с белой циклорамой (1 час)', description: 'Идеально для лукбуков, каталогов и fashion-съёмок. 3 источника света', price: 2000, duration: 60, icon: 'sparkles', category: 'Аренда', enabled: true },
      { id: 'ph_interior', name: 'Аренда интерьерного зала с мебелью', description: 'Уютный дизайн, дизайнерская мебель, естественный свет из панорамных окон', price: 2200, duration: 60, icon: 'heart', category: 'Аренда', enabled: true },
      { id: 'ph_individual', name: 'Индивидуальная фотосессия «Всё включено»', description: 'Зал + штатный фотограф + 15 фото в авторской ретуши + все исходники', price: 7500, duration: 60, icon: 'badge', category: 'Съёмка', enabled: true },
      { id: 'ph_content', name: 'Съёмка контента для брендов и экспертов', description: 'Создание фото и коротких видео Reels/Shorts на месяц вперёд', price: 9500, duration: 120, icon: 'shield', category: 'Съёмка', enabled: true },
      { id: 'ph_makeup', name: 'Аренда гримёрного места до съёмки (1 час)', description: 'Профессиональное зеркало с нейтральным светом для стилиста и визажиста', price: 500, duration: 60, icon: 'sparkles', category: 'Дополнительно', enabled: true },
    ],
    products: [
      {
        id: 'ph_cert',
        name: 'Подарочный сертификат на фотосессию под ключ',
        description: 'Электронный сертификат с промокодом на 1 час аренды зала и работу фотографа.',
        price: 7500,
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
        category: 'Сертификаты',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
    ],
  },

  fitness: {
    siteMode: 'hybrid',
    adminMode: 'client',
    lockNiche: false,
    niche: 'fitness',
    nicheLabel: 'Фитнес-клуб и персональные тренировки',
    name: 'Pulse Fitness & Yoga',
    tagline: 'Персональный тренинг, функциональные занятия и правильная форма.',
    aboutText: 'Камерный клуб премиум-класса: индивидуальные программы тренировок, современное оборудование и сертифицированные тренеры.',
    address: 'Москва, Ленинградский проспект, 36',
    phone: '+7 (999) 888-11-22',
    email: 'go@pulsefitness.ru',
    telegram: 'pulse_fitness_club',
    whatsapp: '+79998881122',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    theme: 'cyan',
    capacityUnit: 'тренеров / зон',
    posts: 3,
    buffer: 10,
    mode: 'instant',
    open: '07:00',
    close: '23:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 300,
    freeDeliveryThreshold: 3500,
    currency: '₽',
    cartEnabled: true,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'f_personal', name: 'Персональная тренировка 1-на-1 с тренером', description: 'Индивидуальный план под вашу цель (похудение, рельеф, выносливость)', price: 2500, duration: 60, icon: 'shield', category: 'Тренировки', enabled: true },
      { id: 'f_split', name: 'Сплит-тренировка (для двоих)', description: 'Эффективное занятие в паре под руководством персонального наставника', price: 3600, duration: 60, icon: 'heart', category: 'Тренировки', enabled: true },
      { id: 'f_yoga', name: 'Индивидуальная практика Хатха / Аштанга Йоги', description: 'Работа с гибкостью, дыханием, осанкой и снятием стресса', price: 2700, duration: 75, icon: 'sparkles', category: 'Йога и стретчинг', enabled: true },
      { id: 'f_stretch', name: 'Персональный стретчинг и МФР-растяжка', description: 'Глубокая растяжка всех групп мышц, мобильность суставов', price: 2300, duration: 60, icon: 'badge', category: 'Йога и стретчинг', enabled: true },
      { id: 'f_pack10', name: 'Блок из 8 персональных тренировок', description: 'Системный абонемент с контролем питания и замерами прогресса', price: 17500, duration: 60, icon: 'badge', category: 'Абонементы', enabled: true },
    ],
    products: [
      {
        id: 'fit_prot',
        name: 'Изолят сывороточного протеина Whey Isolate (900 г)',
        description: 'Премиальная очистка, 27 г чистого белка на порцию, ноль сахара.',
        price: 3400,
        imageUrl: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=800&q=80',
        category: 'Спортивное питание',
        badge: 'Хит',
        inStock: true,
        enabled: true,
      },
    ],
  },

  medical: {
    siteMode: 'services',
    adminMode: 'client',
    lockNiche: false,
    niche: 'medical',
    nicheLabel: 'Стоматология и медицинская клиника',
    name: 'ДентаЛюкс Клиника',
    tagline: 'Бережная стоматология, передовая диагностика и забота о здоровье.',
    aboutText: 'Современная клиника экспертного уровня: лечение под микроскопом, цифровая 3D-томография и лечение без боли.',
    address: 'Москва, Цветной бульвар, 15 стр. 2',
    phone: '+7 (999) 666-88-99',
    email: 'info@dentalux-clinic.ru',
    telegram: 'dentalux_clinic',
    whatsapp: '+79996668899',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    theme: 'light',
    capacityUnit: 'кабинетов / докторов',
    posts: 3,
    buffer: 15,
    mode: 'request',
    open: '08:30',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    currency: '₽',
    cartEnabled: false,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'med_consult', name: 'Консультация врача-стоматолога + КТ снимок', description: 'Полный осмотр полости рта, 3D-диагностика и составление плана лечения', price: 1500, duration: 40, icon: 'badge', category: 'Диагностика', enabled: true },
      { id: 'med_hygiene', name: 'Комплексная гигиена полости рта (Air-Flow)', description: 'Удаление зубного камня ультразвуком, полировка и фторирование эмали', price: 4200, duration: 60, icon: 'sparkles', category: 'Профилактика', enabled: true },
      { id: 'med_treatment', name: 'Лечение кариеса с эстетической реставрацией', description: 'Бережное удаление пораженных тканей и анатомическая пломба', price: 4900, duration: 60, icon: 'shield', category: 'Лечение', inspection: true, enabled: true },
      { id: 'med_whitening', name: 'Клиническое отбеливание зубов Zoom 4', description: 'Осветление эмали до 8 тонов за один визит без вреда для чувствительности', price: 18000, duration: 90, icon: 'sparkles', category: 'Эстетика', enabled: true },
      { id: 'med_ortho', name: 'Консультация ортодонта (Элайнеры / Брекеты)', description: 'Цифровое сканирование прикуса и план исправления зубов', price: 2000, duration: 45, icon: 'heart', category: 'Ортодонтия', enabled: true },
    ],
    products: [],
  },

  tattoo: {
    siteMode: 'services',
    adminMode: 'client',
    lockNiche: false,
    niche: 'tattoo',
    nicheLabel: 'Тату-студия и пирсинг',
    name: 'Ink & Iron Tattoo',
    tagline: 'Авторские эскизы, стерильность медицинского уровня и уникальный стиль.',
    aboutText: 'Пространство творческих мастеров: татуировки в реализме, графике, традиционном стиле, перекрытие старых работ и пирсинг.',
    address: 'Москва, ул. Покровка, 19',
    phone: '+7 (999) 444-99-88',
    email: 'tattooshop@inkiron.ru',
    telegram: 'inkiron_tattoo',
    whatsapp: '+79994449988',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1200&q=80',
    theme: 'ruby',
    capacityUnit: 'мастеров / боксов',
    posts: 2,
    buffer: 20,
    mode: 'request',
    open: '11:00',
    close: '21:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    currency: '₽',
    cartEnabled: false,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 't_consult', name: 'Консультация мастера + разработка эскиза', description: 'Обсуждение идеи, анатомической посадки и отрисовка эскиза', price: 1500, duration: 45, icon: 'sparkles', category: 'Эскизы', enabled: true },
      { id: 't_mini', name: 'Мини-татуировка (до 5 см)', description: 'Тонкие линии, надписи, минималистичные символы за один сеанс', price: 4000, duration: 60, icon: 'heart', category: 'Тату', enabled: true },
      { id: 't_session', name: 'Сеанс татуировки средней сложности (до 4 ч)', description: 'Детализированная работа по авторскому эскизу с уходовой плёнкой', price: 11000, duration: 240, icon: 'shield', category: 'Тату', inspection: true, enabled: true },
      { id: 't_day', name: 'Полный день работы мастера (до 7 часов)', description: 'Для масштабных проектов: рукав, бедро, спина с перерывом на кофе', price: 19000, duration: 420, icon: 'badge', category: 'Тату', inspection: true, enabled: true },
      { id: 't_pierce', name: 'Профессиональный пирсинг (любая зона)', description: 'Одноразовые стерильные иглы, титановое базовое украшение и консультация', price: 2300, duration: 30, icon: 'sparkles', category: 'Пирсинг', enabled: true },
    ],
    products: [],
  },

  cleaning: {
    siteMode: 'services',
    adminMode: 'client',
    lockNiche: false,
    niche: 'cleaning',
    nicheLabel: 'Клининговая компания и химчистка',
    name: 'Чистый Дом Сервис',
    tagline: 'Генеральная уборка, химчистка мебели и чистота без хлопот.',
    aboutText: 'Профессиональный клининг квартир, коттеджей и офисов немецкой химией Kiehl и техникой Kärcher. Безопасно для детей и питомцев.',
    address: 'Москва, ул. Вавилова, 47',
    phone: '+7 (999) 222-77-66',
    email: 'zakaz@chistydom.ru',
    telegram: 'chistydom_clean',
    whatsapp: '+79992227766',
    mapUrl: 'https://yandex.ru/maps/',
    heroUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    theme: 'violet',
    capacityUnit: 'выездных бригад',
    posts: 3,
    buffer: 30,
    mode: 'request',
    open: '08:00',
    close: '22:00',
    workDays: [1, 2, 3, 4, 5, 6, 0],
    closedDates: [],
    deliveryCost: 0,
    currency: '₽',
    cartEnabled: false,
    paymentMethods: {
      onlineCard: true,
      cashOnDelivery: true,
      cardTransfer: true,
    },
    services: [
      { id: 'cl_support', name: 'Поддерживающая уборка 1-2 комн. квартиры', description: 'Обеспыливание поверхностей, мытье полов, дезинфекция санузла и кухни', price: 3200, duration: 150, icon: 'sparkles', category: 'Квартиры', enabled: true },
      { id: 'cl_general', name: 'Генеральная глубокая уборка квартиры', description: 'Мытье всех шкафов, удаление застарелого жира, известкового налета', price: 6900, duration: 240, icon: 'shield', category: 'Квартиры', inspection: true, enabled: true },
      { id: 'cl_sofa', name: 'Глубокая экстракторная химчистка дивана', description: 'Удаление пятен, запахов и пылевых клещей профессиональным экстрактором', price: 3000, duration: 90, icon: 'heart', category: 'Химчистка', enabled: true },
      { id: 'cl_windows', name: 'Сезонное мытье окон и балконов', description: 'Мойка стекол с двух сторон, рам, подоконников и фурнитуры без разводов', price: 2500, duration: 90, icon: 'sparkles', category: 'Окна', enabled: true },
      { id: 'cl_after', name: 'Уборка после ремонта и строительных работ', description: 'Удаление строительной пыли, краски, цемента и затирки мощным пылесосом', price: 8900, duration: 300, icon: 'badge', category: 'Квартиры', inspection: true, enabled: true },
    ],
    products: [],
  },
};

export const defaultConfig: Config = presets.shop;

export type Booking = {
  id: string;
  serviceId: string;
  serviceName: string;
  wheelSize?: number;
  vehicleType?: string;
  specialist?: string;
  addOns?: string[];
  price: number;
  startsAt: string;
  endsAt: string;
  post: number;
  name: string;
  phone: string;
  status: string;
  cancelToken?: string;
  createdAt: string;
};

export function priceFor(
  config: Config,
  service: Service,
  size?: number,
  vehicle?: string,
  runflat?: boolean
) {
  if (config.niche === 'auto' && size && config.diameterFactor) {
    const factor = config.diameterFactor[String(size)] ?? 1;
    const suv = vehicle === 'suv' ? (config.suvExtra ?? 0) : 0;
    const rf = runflat ? (config.runflatExtra ?? 0) : 0;
    return Math.round((service.price * factor + suv + rf) / 50) * 50;
  }
  return service.price;
}

export function money(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

export function duration(config: Config, service: Service) {
  return service.duration + config.buffer;
}

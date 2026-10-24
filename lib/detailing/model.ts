import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const image = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      /^\/(?!\/)[a-zA-Z0-9/_ .-]+$/.test(v) || /^https:\/\/[^\s]+$/.test(v),
    "Укажите HTTPS-ссылку или загрузите фотографию",
  );
export const detailConfigSchema = z
  .object({
    name: text(70).min(2),
    eyebrow: text(100),
    headline: text(120).min(3),
    description: text(500),
    accent: z.string().regex(/^#[\da-fA-F]{6}$/),
    hero: image,
    logo: z.union([image, z.literal("")]),
    phone: text(30),
    address: text(220),
    city: text(80),
    hoursLabel: text(100),
    telegram: z.union([
      z
        .string()
        .url()
        .regex(/^https:\/\/t\.me\/[a-zA-Z0-9_]+$/),
      z.literal(""),
    ]),
    aboutTitle: text(120),
    aboutText: text(1200),
    services: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
          name: text(80).min(2),
          description: text(350),
          price: z.number().int().min(0).max(10000000),
          duration: z.number().int().min(30).max(600).multipleOf(30),
        }),
      )
      .min(1)
      .max(12)
      .refine(
        (v) => new Set(v.map((s) => s.id)).size === v.length,
        "Услуги должны иметь разные идентификаторы",
      ),
    gallery: z.array(z.object({ image, caption: text(140) })).max(8),
    faqs: z
      .array(z.object({ question: text(180).min(1), answer: text(700).min(1) }))
      .max(8),
    openHour: z.number().int().min(0).max(22),
    closeHour: z.number().int().min(1).max(23),
    workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    capacity: z.number().int().min(1).max(8),
    legalName: text(200),
    privacyText: text(6000),
    demo: z.boolean(),
  })
  .refine(
    (v) => v.closeHour > v.openHour,
    "Время закрытия должно быть позже открытия",
  );
export type DetailConfig = z.infer<typeof detailConfigSchema>;
export type DetailProject = {
  id: string;
  slug: string;
  clientName: string;
  references: string[];
  draft: DetailConfig;
  version: number;
  reviewToken: string | null;
  reviewStatus: string | null;
  reviewVersion: number | null;
  reviewComment: string;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
};
export type DetailReview = {
  token: string;
  projectId: string;
  version: number;
  config: DetailConfig;
  status: "pending" | "approved" | "changes" | "superseded";
  comment: string;
  createdAt: string;
  decidedAt: string | null;
};
export type DetailBooking = {
  id: string;
  projectId: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  duration: number;
  bay: number;
  name: string;
  phone: string;
  car: string;
  comment: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
};
export const defaultDetailConfig: DetailConfig = {
  name: "FORMA",
  eyebrow: "ДЕТЕЙЛИНГ · ЗАЩИТА · ЭСТЕТИКА",
  headline: "Искусство\nсохранять новое.",
  description:
    "Продуманный уход за каждой поверхностью. От деликатной очистки до защиты кузова — выберите то, что нужно вашему автомобилю.",
  accent: "#c9ed72",
  hero: "/detailing-hero.png",
  logo: "",
  phone: "",
  address: "",
  city: "Ваш город",
  hoursLabel: "Ежедневно · 09:00–21:00",
  telegram: "",
  aboutTitle: "Внимание, которое\nвидно в деталях.",
  aboutText:
    "Хороший результат начинается с осмотра. Обсудим состояние автомобиля, подберём работы и согласуем стоимость до начала. После ухода расскажем, как сохранить результат.",
  services: [
    {
      id: "wash",
      name: "Детейлинг-мойка",
      description:
        "Бережная очистка кузова, дисков и труднодоступных мест. Для регулярного ухода.",
      price: 3500,
      duration: 90,
    },
    {
      id: "polish",
      name: "Полировка кузова",
      description:
        "Восстановление глубины цвета и блеска. Объём работ определим после осмотра.",
      price: 18000,
      duration: 240,
    },
    {
      id: "ceramic",
      name: "Керамическая защита",
      description:
        "Защитное покрытие для лакокрасочной поверхности. Состав подбирается под автомобиль.",
      price: 25000,
      duration: 300,
    },
    {
      id: "interior",
      name: "Уход за салоном",
      description:
        "Деликатная очистка ткани, кожи и пластика с учётом особенностей материалов.",
      price: 12000,
      duration: 180,
    },
  ],
  gallery: [],
  faqs: [
    {
      question: "Как узнать точную стоимость?",
      answer:
        "В прайсе указаны начальные цены. Итоговая стоимость зависит от размера и состояния автомобиля. Мастер согласует её с вами после осмотра, до начала работ.",
    },
    {
      question: "Запись подтверждается сразу?",
      answer:
        "После отправки заявки выбранное время резервируется. Администратор свяжется с вами и подтвердит детали визита.",
    },
    {
      question: "Как подготовить автомобиль?",
      answer:
        "Для ухода за салоном заберите личные вещи. Предварительно мыть кузов не нужно.",
    },
  ],
  openHour: 9,
  closeHour: 21,
  workDays: [0, 1, 2, 3, 4, 5, 6],
  capacity: 1,
  legalName: "",
  privacyText: "",
  demo: true,
};
export const projectInputSchema = z.object({
  clientName: text(140).min(2),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(60),
  references: z
    .array(
      z
        .string()
        .url()
        .max(2000)
        .refine((v) => /^https?:\/\//.test(v)),
    )
    .max(10)
    .default([]),
});
export const bookingInputSchema = z.object({
  serviceId: text(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: text(100).min(2),
  phone: z
    .string()
    .regex(/^[78]\d{10}$/, "Введите 11 цифр номера, начиная с 7 или 8"),
  car: text(120).min(2),
  comment: text(700).default(""),
  consent: z.literal(true),
  website: text(200).default(""),
});
export function money(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

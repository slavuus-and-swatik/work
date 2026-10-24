"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  Globe,
  ImagePlus,
  Layers3,
  LogOut,
  Monitor,
  Plus,
  Save,
  Send,
  Settings2,
  Smartphone,
  Trash2,
} from "lucide-react";
import type {
  DetailConfig,
  DetailProject,
  DetailBooking,
} from "@/lib/detailing/model";
import { defaultDetailConfig } from "@/lib/detailing/model";
import DetailingSite from "@/components/detailing/site";
import "@/components/detailing/studio.css";

async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch("/api/detailing/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Не удалось выполнить действие");
  return result;
}
const status = (p: DetailProject) =>
  p.reviewStatus === "approved"
    ? "Согласован"
    : p.reviewStatus === "pending"
      ? "На согласовании"
      : p.reviewStatus === "changes"
        ? "Нужны правки"
        : "Черновик";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ds-field" role="group" aria-label={label}>
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "textarea", "select"].includes(String(child.type))
          ? cloneElement(child as ReactElement<Record<string, unknown>>, {
              "aria-label": label,
            })
          : child,
      )}
    </div>
  );
}

export default function StudioWorkspace() {
  const [ready, setReady] = useState(false),
    [auth, setAuth] = useState(false),
    [password, setPassword] = useState("");
  const [projects, setProjects] = useState<DetailProject[]>([]),
    [selected, setSelected] = useState<DetailProject | null>(null),
    [config, setConfig] = useState<DetailConfig>(defaultDetailConfig);
  const [clientName, setClientName] = useState(""),
    [refs, setRefs] = useState(""),
    [section, setSection] = useState("brand"),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [creating, setCreating] = useState(false),
    [newName, setNewName] = useState(""),
    [slug, setSlug] = useState(""),
    [orders, setOrders] = useState<DetailBooking[]>([]),
    [inviteLink, setInviteLink] = useState("");
  const dirty =
    !!selected &&
    (JSON.stringify(config) !== JSON.stringify(selected.draft) ||
      clientName !== selected.clientName ||
      refs !== selected.references.join("\n"));
  function choose(p: DetailProject) {
    if (
      dirty &&
      !window.confirm(
        "В этом проекте есть несохранённые изменения. Перейти без сохранения?",
      )
    )
      return;
    setSelected(p);
    setConfig(structuredClone(p.draft));
    setClientName(p.clientName);
    setRefs(p.references.join("\n"));
    setError("");
    setNotice("");
    setOrders([]);
    setInviteLink("");
  }
  function accept(p: DetailProject) {
    setProjects((v) => [p, ...v.filter((x) => x.id !== p.id)]);
    setSelected(p);
    setConfig(structuredClone(p.draft));
    setClientName(p.clientName);
    setRefs(p.references.join("\n"));
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    const v = await api("projects");
    setProjects(v.projects);
    if (!selected && v.projects[0]) choose(v.projects[0]);
  }
  useEffect(() => {
    fetch("/api/platform-admin/session")
      .then((r) => r.json())
      .then((v) => setAuth(!!v.authenticated))
      .catch(() => setError("Сервер недоступен"))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (auth) void run(load);
  }, [auth]);
  useEffect(() => {
    if (!auth || !selected || dirty || busy) return;
    let current = true;
    const refresh = async () => {
      try {
        const v = await api(`projects/${selected.id}`);
        if (current) {
          setProjects((xs) =>
            xs.map((x) => (x.id === v.project.id ? v.project : x)),
          );
          if (v.project.updatedAt !== selected.updatedAt) accept(v.project);
        }
      } catch {
        /* Keep the open draft available during a transient network failure. */
      }
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [auth, selected?.id, selected?.updatedAt, dirty, busy]);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  useEffect(() => {
    if (section === "bookings" && selected)
      void run(async () =>
        setOrders((await api(`projects/${selected.id}/bookings`)).bookings),
      );
  }, [section, selected?.id]);
  function set<K extends keyof DetailConfig>(key: K, value: DetailConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }
  async function save() {
    if (!selected) return selected;
    const v = await api(`projects/${selected.id}`, "PATCH", {
      version: selected.version,
      config,
      clientName,
      references: refs
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    accept(v.project);
    return v.project as DetailProject;
  }
  async function action(type: "review" | "publish" | "unpublish") {
    await run(async () => {
      if (!selected) return;
      let p = selected;
      if (dirty) {
        if (type === "publish")
          throw new Error(
            "Сохраните изменения и согласуйте новую версию перед публикацией.",
          );
        p = (await save())!;
      }
      const v = await api(`projects/${p.id}/${type}`, "POST", {
        version: p.version,
      });
      accept(v.project);
      setNotice(
        type === "review"
          ? "Ссылка готова. Скопируйте её и отправьте клиенту."
          : type === "publish"
            ? "Сайт опубликован. Откройте его по ссылке справа."
            : "Сайт снят с публикации.",
      );
    });
  }
  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setNotice("Ссылка скопирована");
    } catch {
      setNotice("Скопируйте адрес из открытой страницы.");
    }
  }
  async function upload(file: File | undefined, onDone: (url: string) => void) {
    if (!file) return;
    await run(async () => {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/detailing/upload", {
        method: "POST",
        body: form,
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      onDone(v.url);
      setNotice("Фото загружено. Сохраните изменения проекта.");
    });
  }
  const textField = (key: keyof DetailConfig, label: string, multi = false) => (
    <Field key={key} label={label}>
      {multi ? (
        <textarea
          value={String(config[key])}
          onChange={(e) => set(key, e.target.value as never)}
          rows={key === "privacyText" ? 8 : 3}
        />
      ) : (
        <input
          value={String(config[key])}
          onChange={(e) => set(key, e.target.value as never)}
        />
      )}
    </Field>
  );
  if (!ready) return <main className="ds ds-loading">Открываем студию…</main>;
  if (!auth)
    return (
      <main className="ds ds-login">
        <section className="ds-login-visual">
          <img src="/detailing-hero.png" alt="Детейлинг автомобиля" />
          <div>
            <span className="ds-wordmark">FORMA / STUDIO</span>
            <h1>
              От первого впечатления
              <br />
              до первого клиента.
            </h1>
            <p>Ваша студия сайтов для автомобильного бизнеса.</p>
          </div>
        </section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await fetch("/api/platform-admin/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const v = await r.json();
              if (!r.ok) throw new Error(v.error);
              setPassword("");
              setAuth(true);
            });
          }}
        >
          <span className="ds-kicker">РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h2>Войти в студию</h2>
          <p>
            Проекты, дизайн и согласования —<br />в одном месте.
          </p>
          <Field label="Пароль команды">
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <button className="ds-btn primary" disabled={busy}>
            {busy ? "Проверяем…" : "Продолжить"}
            <ArrowUpRight size={17} />
          </button>
          {error && (
            <p className="ds-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </main>
    );
  return (
    <main className="ds ds-workspace">
      <aside className="ds-sidebar">
        <a className="ds-wordmark" href="/studio">
          FORMA<span> / </span>STUDIO
        </a>
        <div className="ds-sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <button className="ds-nav active" onClick={() => setSection("brand")}>
          <Layers3 size={17} />
          Проекты<span>{projects.length}</span>
        </button>
        <div className="ds-sidebar-caption ds-projects-title">
          КЛИЕНТЫ
          <button aria-label="Новый проект" onClick={() => setCreating(true)}>
            <Plus size={17} />
          </button>
        </div>
        <div className="ds-project-list">
          {projects.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              className={selected?.id === p.id ? "selected" : ""}
              onClick={() => choose(p)}
            >
              <span className="ds-project-avatar">
                {p.clientName.slice(0, 1)}
              </span>
              <span>
                <strong>{p.clientName}</strong>
                <small>
                  {p.publishedVersion ? "В эфире · " : ""}
                  {status(p)}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="ds-sidebar-bottom">
          <span className="ds-online" />
          Постоянное хранилище
          <button
            aria-label="Выйти из студии"
            onClick={() => {
              if (dirty && !confirm("Выйти без сохранения изменений?")) return;
              void run(async () => {
                await fetch("/api/platform-admin/session", {
                  method: "DELETE",
                });
                setAuth(false);
              });
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="ds-main">
        <header className="ds-toolbar">
          <div>
            <span className="ds-breadcrumb">
              Проекты <span>/</span> {selected?.clientName || "Первый проект"}
            </span>
            <h1>
              {selected?.clientName || "Создайте первый сайт"}
              <span className="ds-status">
                {selected ? status(selected) : "Детейлинг"}
              </span>
            </h1>
          </div>
          <div className="ds-actions">
            <button
              className="ds-btn"
              disabled={busy || !dirty}
              onClick={() =>
                run(async () => {
                  await save();
                  setNotice("Черновик сохранён");
                })
              }
            >
              <Save size={14} />
              {dirty ? "Сохранить" : "Сохранено"}
            </button>
            <button
              className="ds-btn primary"
              disabled={busy || !selected}
              onClick={() => action("review")}
            >
              <Send size={14} />
              На согласование
            </button>
          </div>
        </header>
        <div className="ds-flow">
          <span className="current">
            <i>1</i>Настройка
          </span>
          <b>—</b>
          <span className={selected?.reviewToken ? "current" : ""}>
            <i>2</i>Согласование
          </span>
          <b>—</b>
          <span className={selected?.publishedVersion ? "current" : ""}>
            <i>3</i>Публикация
          </span>
          <small>
            {dirty
              ? "Есть несохранённые изменения"
              : selected
                ? `Версия ${selected.version} · ${selected.publishedVersion ? `в эфире v${selected.publishedVersion}` : "пока не опубликован"}`
                : "Шаблон FORMA / Детейлинг"}
          </small>
        </div>
        {(error || notice) && (
          <div
            role={error ? "alert" : "status"}
            className={error ? "ds-message error" : "ds-message"}
          >
            {error || notice}
          </div>
        )}
        {!selected ? (
          <div className="ds-empty">
            <h2>Первый проект начинается здесь.</h2>
            <p>Готовый шаблон детейлинга. Ваши фотографии, услуги и стиль.</p>
            <button
              className="ds-btn primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} />
              Создать проект
            </button>
            <div className="ds-empty-preview">
              <DetailingSite config={defaultDetailConfig} preview />
            </div>
          </div>
        ) : (
          <div className="ds-editor-layout">
            <section className="ds-canvas-column">
              <div className="ds-canvas-toolbar">
                <span>
                  <span className="ds-online" />
                  Живой предпросмотр
                </span>
                <div className="ds-view-toggle">
                  <button
                    aria-label="Версия для компьютера"
                    aria-pressed={!mobile}
                    onClick={() => setMobile(false)}
                  >
                    <Monitor size={17} />
                  </button>
                  <button
                    aria-label="Версия для телефона"
                    aria-pressed={mobile}
                    onClick={() => setMobile(true)}
                  >
                    <Smartphone size={17} />
                  </button>
                </div>
                <a
                  href={`/studio/preview/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Открыть сохранённый черновик"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <div className="ds-canvas-scroll">
                <div className={`ds-canvas ${mobile ? "mobile" : ""}`}>
                  <DetailingSite config={config} preview />
                </div>
              </div>
            </section>
            <aside className="ds-inspector">
              <div className="ds-inspector-tabs">
                {[
                  ["brand", "Дизайн"],
                  ["services", "Услуги"],
                  ["content", "Контент"],
                  ["launch", "Запуск"],
                  ["bookings", "Заявки"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    aria-selected={section === key}
                    className={section === key ? "active" : ""}
                    onClick={() => setSection(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="ds-inspector-body">
                {section === "brand" && (
                  <>
                    <span className="ds-kicker">ШАБЛОН 01 / ДЕТЕЙЛИНГ</span>
                    <h2>Первое впечатление</h2>
                    <p className="ds-hint">
                      Настройте характер сайта. Изменения сразу видны слева.
                    </p>
                    {textField("name", "Название на сайте")}
                    {textField("eyebrow", "Строка над заголовком")}
                    {textField("headline", "Главный заголовок", true)}
                    {textField("description", "Описание", true)}
                    <Field label="Акцентный цвет">
                      <div className="ds-color">
                        <input
                          type="color"
                          value={config.accent}
                          onChange={(e) => set("accent", e.target.value)}
                        />
                        <span>{config.accent.toUpperCase()}</span>
                        {["#c9ed72", "#c4c5c0", "#dfb77a", "#a3c8e8"].map(
                          (color) => (
                            <button
                              key={color}
                              style={{ background: color }}
                              aria-label={`Цвет ${color}`}
                              onClick={() => set("accent", color)}
                            />
                          ),
                        )}
                      </div>
                    </Field>
                    <Field label="Обложка">
                      <img
                        className="ds-image-preview"
                        src={config.hero}
                        alt="Обложка"
                      />
                      <input
                        value={config.hero}
                        onChange={(e) => set("hero", e.target.value)}
                      />
                      <label className="ds-upload">
                        <ImagePlus size={15} />
                        Загрузить фотографию
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy}
                          onChange={(e) =>
                            upload(e.target.files?.[0], (url) =>
                              set("hero", url),
                            )
                          }
                        />
                      </label>
                    </Field>
                    <Field label="Логотип (необязательно)">
                      <input
                        value={config.logo}
                        placeholder="Ссылка на изображение"
                        onChange={(e) => set("logo", e.target.value)}
                      />
                      <label className="ds-upload">
                        Загрузить логотип
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy}
                          onChange={(e) =>
                            upload(e.target.files?.[0], (url) =>
                              set("logo", url),
                            )
                          }
                        />
                      </label>
                    </Field>
                  </>
                )}
                {section === "services" && (
                  <>
                    <span className="ds-kicker">ПРАЙС И ДЛИТЕЛЬНОСТЬ</span>
                    <h2>Услуги студии</h2>
                    <p className="ds-hint">
                      Начальная цена и длительность влияют на форму записи и
                      свободное время.
                    </p>
                    {config.services.map((s, i) => (
                      <div className="ds-edit-card" key={s.id}>
                        <div className="ds-row">
                          <b>Услуга {i + 1}</b>
                          <button
                            aria-label={`Удалить услугу ${s.name}`}
                            disabled={config.services.length === 1}
                            onClick={() =>
                              set(
                                "services",
                                config.services.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <Field label="Название">
                          <input
                            value={s.name}
                            onChange={(e) =>
                              set(
                                "services",
                                config.services.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Описание">
                          <textarea
                            value={s.description}
                            onChange={(e) =>
                              set(
                                "services",
                                config.services.map((x, j) =>
                                  j === i
                                    ? { ...x, description: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        {s.image && <img className="ds-image-preview" src={s.image} alt={`Фото услуги ${s.name}`} />}
                        <label className="ds-upload">
                          <ImagePlus size={15} />
                          {s.image ? "Заменить фото услуги" : "Добавить фото услуги"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                            onChange={(e) => upload(e.target.files?.[0], (url) =>
                              set("services", config.services.map((x, j) => j === i ? { ...x, image: url } : x)))} />
                        </label>
                        {s.image && <button className="ds-btn" onClick={() => set("services", config.services.map((x, j) => j === i ? { ...x, image: "" } : x))}>Убрать фото</button>}
                        <div className="ds-fields-row">
                          <Field label="Цена от, ₽">
                            <input
                              type="number"
                              min={0}
                              value={s.price}
                              onChange={(e) =>
                                set(
                                  "services",
                                  config.services.map((x, j) =>
                                    j === i
                                      ? { ...x, price: Number(e.target.value) }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Минуты">
                            <input
                              type="number"
                              min={30}
                              max={600}
                              step={30}
                              value={s.duration}
                              onChange={(e) =>
                                set(
                                  "services",
                                  config.services.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          duration: Number(e.target.value),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                    <button
                      className="ds-btn"
                      disabled={config.services.length >= 12}
                      onClick={() =>
                        set("services", [
                          ...config.services,
                          {
                            id: crypto.randomUUID(),
                            name: "Новая услуга",
                            description: "",
                            image: "",
                            price: 0,
                            duration: 60,
                          },
                        ])
                      }
                    >
                      <Plus size={15} />
                      Добавить услугу
                    </button>
                  </>
                )}
                {section === "content" && (
                  <>
                    <h2>История и детали</h2>
                    {textField("aboutTitle", "Заголовок о подходе", true)}
                    {textField("aboutText", "Текст о студии", true)}
                    <h3>Работы</h3>
                    <p className="ds-hint">
                      Добавьте реальные фотографии клиента. Раздел появится
                      после добавления фото.
                    </p>
                    {config.gallery.map((g, i) => (
                      <div className="ds-edit-card" key={i}>
                        <img
                          className="ds-image-preview"
                          src={g.image}
                          alt="Работа"
                        />
                        <Field label="Подпись">
                          <input
                            value={g.caption}
                            onChange={(e) =>
                              set(
                                "gallery",
                                config.gallery.map((x, j) =>
                                  j === i
                                    ? { ...x, caption: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <button
                          className="ds-btn"
                          onClick={() =>
                            set(
                              "gallery",
                              config.gallery.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Удалить фото
                        </button>
                      </div>
                    ))}
                    <label className="ds-upload">
                      <Plus size={15} />
                      Добавить работу
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy || config.gallery.length >= 8}
                        onChange={(e) =>
                          upload(e.target.files?.[0], (url) =>
                            set("gallery", [
                              ...config.gallery,
                              { image: url, caption: "Работа студии" },
                            ]),
                          )
                        }
                      />
                    </label>
                    <h3>Вопросы и ответы</h3>
                    {config.faqs.map((f, i) => (
                      <div className="ds-edit-card" key={i}>
                        <Field label="Вопрос">
                          <input
                            value={f.question}
                            onChange={(e) =>
                              set(
                                "faqs",
                                config.faqs.map((x, j) =>
                                  j === i
                                    ? { ...x, question: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Ответ">
                          <textarea
                            value={f.answer}
                            onChange={(e) =>
                              set(
                                "faqs",
                                config.faqs.map((x, j) =>
                                  j === i
                                    ? { ...x, answer: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <button
                          className="ds-btn"
                          onClick={() =>
                            set(
                              "faqs",
                              config.faqs.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Удалить вопрос
                        </button>
                      </div>
                    ))}
                    <button
                      className="ds-btn"
                      disabled={config.faqs.length >= 8}
                      onClick={() =>
                        set("faqs", [
                          ...config.faqs,
                          { question: "Новый вопрос", answer: "Ответ студии" },
                        ])
                      }
                    >
                      Добавить вопрос
                    </button>
                  </>
                )}
                {section === "launch" && (
                  <>
                    <h2>Готовность к запуску</h2>
                    <Field label="Название проекта (для команды)">
                      <input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </Field>
                    <Field label="Референсы — по ссылке на строку">
                      <textarea
                        value={refs}
                        onChange={(e) => setRefs(e.target.value)}
                      />
                    </Field>
                    {textField("city", "Город")}
                    {textField("address", "Адрес")}
                    {textField("phone", "Телефон")}
                    {textField("telegram", "Telegram: https://t.me/…")}
                    {textField("hoursLabel", "Расписание на сайте")}
                    <h3>Расписание записи · МСК</h3>
                    <div className="ds-fields-row">
                      <Field label="Открытие, час">
                        <input
                          type="number"
                          min={0}
                          max={22}
                          value={config.openHour}
                          onChange={(e) =>
                            set("openHour", Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Закрытие, час">
                        <input
                          type="number"
                          min={1}
                          max={23}
                          value={config.closeHour}
                          onChange={(e) =>
                            set("closeHour", Number(e.target.value))
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Одновременных постов">
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={config.capacity}
                        onChange={(e) =>
                          set("capacity", Number(e.target.value))
                        }
                      />
                    </Field>
                    <div className="ds-days">
                      {["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map(
                        (d, i) => (
                          <button
                            aria-pressed={config.workDays.includes(i)}
                            key={d}
                            className={
                              config.workDays.includes(i) ? "active" : ""
                            }
                            onClick={() =>
                              set(
                                "workDays",
                                config.workDays.includes(i)
                                  ? config.workDays.filter((x) => x !== i)
                                  : [...config.workDays, i],
                              )
                            }
                          >
                            {d}
                          </button>
                        ),
                      )}
                    </div>
                    {textField("legalName", "Оператор: ИП / организация")}
                    {textField(
                      "privacyText",
                      "Условия обработки персональных данных",
                      true,
                    )}
                    <label className="ds-check">
                      <input
                        type="checkbox"
                        checked={config.demo}
                        onChange={(e) => set("demo", e.target.checked)}
                      />
                      Демонстрация — не принимать заявки
                    </label>
                    <p className="ds-hint">
                      Для реальных заявок выключите демонстрацию, заполните
                      контакты и условия обработки данных. Сохраните и
                      согласуйте эту версию.
                    </p>
                    <div className="ds-launch-card">
                      <span className="ds-kicker">СОГЛАСОВАНИЕ</span>
                      {selected.reviewToken ? (
                        <>
                          <p>
                            Версия {selected.reviewVersion} · {status(selected)}
                          </p>
                          {selected.reviewComment && (
                            <blockquote>{selected.reviewComment}</blockquote>
                          )}
                          <a
                            className="ds-btn"
                            href={`/review/${selected.reviewToken}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть как клиент
                            <ExternalLink size={14} />
                          </a>
                          <button
                            className="ds-btn"
                            onClick={() =>
                              copy(`/review/${selected.reviewToken}`)
                            }
                          >
                            <Copy size={14} />
                            Скопировать ссылку
                          </button>
                        </>
                      ) : (
                        <p className="ds-hint">
                          Сохраните проект и нажмите «На согласование».
                        </p>
                      )}
                    </div>
                    <div className="ds-launch-card">
                      <span className="ds-kicker">ПУБЛИКАЦИЯ</span>
                      <p className="ds-hint">Адрес сайта: /s/{selected.slug}</p>
                      <button
                        className="ds-btn primary"
                        disabled={
                          busy || dirty || selected.reviewStatus !== "approved"
                        }
                        onClick={() => action("publish")}
                      >
                        <Globe size={15} />
                        {selected.publishedVersion
                          ? "Обновить сайт"
                          : "Опубликовать сайт"}
                      </button>
                      {selected.publishedVersion && (
                        <>
                          <a
                            className="ds-btn"
                            href={`/s/${selected.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть сайт
                            <ExternalLink size={14} />
                          </a>
                          <button
                            className="ds-btn"
                            onClick={() => copy(`/s/${selected.slug}`)}
                          >
                            Скопировать адрес
                          </button>
                          <button
                            className="ds-btn danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Снять сайт с публикации? Посетители временно не смогут его открыть.",
                                )
                              )
                                void action("unpublish");
                            }}
                          >
                            Снять с публикации
                          </button>
                        </>
                      )}
                    </div>
                    <div className="ds-launch-card">
                      <span className="ds-kicker">КАБИНЕТ КЛИЕНТА</span>
                      <p className="ds-hint">После публикации выдайте отдельный доступ. Клиент задаст свой пароль и сможет менять услуги, цены, фото, тексты, расписание и заявки без доступа к вашей студии.</p>
                      <button className="ds-btn" disabled={busy || !selected.publishedVersion} onClick={() => void run(async () => {
                        const response = await fetch("/api/client?action=invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected.id }) });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error);
                        setInviteLink(window.location.origin + data.path);
                        setNotice("Приглашение создано. Скопируйте ссылку ниже — она действует 7 дней и открывается один раз.");
                      })}>
                        <Copy size={15} /> Создать приглашение
                      </button>
                      {inviteLink && <div className="ds-invite"><input readOnly aria-label="Ссылка приглашения" value={inviteLink} /><button className="ds-btn" onClick={() => void navigator.clipboard.writeText(inviteLink).then(() => setNotice("Приглашение скопировано"))}>Скопировать</button></div>}
                      {selected.publishedVersion && <a className="ds-btn" href={`/client/${selected.slug}`} target="_blank" rel="noreferrer">Открыть вход клиента <ExternalLink size={14} /></a>}
                    </div>
                  </>
                )}
                {section === "bookings" && (
                  <>
                    <div className="ds-row">
                      <h2>Записи клиентов</h2>
                      <button
                        className="ds-btn"
                        disabled={busy}
                        onClick={() =>
                          run(async () =>
                            setOrders(
                              (await api(`projects/${selected.id}/bookings`))
                                .bookings,
                            ),
                          )
                        }
                      >
                        Обновить
                      </button>
                    </div>
                    <p className="ds-hint">
                      Заявки только этого сайта. Время по Москве. Свяжитесь с
                      клиентом перед подтверждением.
                    </p>
                    {!orders.length && (
                      <div className="ds-edit-card">
                        Пока нет заявок. Они появятся после публикации рабочего
                        сайта.
                      </div>
                    )}
                    {orders.map((b) => (
                      <article key={b.id} className="ds-edit-card">
                        <b>
                          {b.date.split("-").reverse().join(".")} · {b.time}
                        </b>
                        <h3>{b.serviceName}</h3>
                        <p>
                          {b.name} · {b.car}
                        </p>
                        <a href={"tel:+" + b.phone}>+{b.phone}</a>
                        <p>{b.comment}</p>
                        <Field label="Статус">
                          <select
                            value={b.status}
                            disabled={busy}
                            onChange={(e) =>
                              run(async () => {
                                const v = await api(
                                  `projects/${selected.id}/bookings`,
                                  "PATCH",
                                  { id: b.id, status: e.target.value },
                                );
                                setOrders((xs) =>
                                  xs.map((x) =>
                                    x.id === b.id ? v.booking : x,
                                  ),
                                );
                              })
                            }
                          >
                            {[
                              ["pending", "Ожидает подтверждения"],
                              ["confirmed", "Подтверждена"],
                              ["completed", "Выполнена"],
                              ["cancelled", "Отменена"],
                            ].map(([k, l]) => (
                              <option key={k} value={k}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </article>
                    ))}
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
      {creating && (
        <div className="ds-modal-backdrop">
          <form
            className="ds-modal"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const v = await api("projects", "POST", {
                  clientName: newName,
                  slug,
                  references: [],
                });
                accept(v.project);
                setCreating(false);
                setNewName("");
                setSlug("");
                setSection("brand");
              });
            }}
          >
            <button
              type="button"
              className="ds-back"
              onClick={() => setCreating(false)}
            >
              <ChevronLeft size={15} />
              Назад
            </button>
            <span className="ds-kicker">НОВЫЙ ПРОЕКТ</span>
            <h2>Дайте ему имя.</h2>
            <p>Начнём с шаблона FORMA для детейлинга.</p>
            <Field label="Название компании">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                minLength={2}
                maxLength={140}
              />
            </Field>
            <Field label="Адрес сайта · латиницей">
              <input
                placeholder="forma-detailing"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={60}
              />
              <small>/s/{slug || "your-studio"}</small>
            </Field>
            {error && <p className="ds-error">{error}</p>}
            <button className="ds-btn primary" disabled={busy}>
              Создать проект
              <ArrowUpRight size={16} />
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

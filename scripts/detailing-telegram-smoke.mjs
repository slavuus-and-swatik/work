import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";
const dir = mkdtempSync(join(tmpdir(), "forma-telegram-qa-"));
const password = randomBytes(16).toString("hex"),
  ownerPassword = randomBytes(16).toString("hex");
const token = "123456789:" + randomBytes(25).toString("base64url");
let mode = "healthy",
  messages = [],
  attempts = [],
  server,
  log = "",
  operatorCookie = "";
const mock = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}"),
    method = req.url.split("/").at(-1);
  res.setHeader("Content-Type", "application/json");
  if (method === "getMe")
    return res.end(
      JSON.stringify({
        ok: true,
        result: { id: 123456789, is_bot: true, username: "forma_fixture_bot" },
      }),
    );
  if (method === "getWebhookInfo")
    return res.end(JSON.stringify({ ok: true, result: { url: "" } }));
  if (method === "getUpdates")
    return res.end(
      JSON.stringify({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              chat: { id: 12345, type: "private", first_name: "Fixture" },
            },
          },
          {
            update_id: 2,
            message: {
              chat: { id: -10012345, type: "supergroup", title: "QA studio" },
            },
          },
        ],
      }),
    );
  if (method === "getChat")
    return res.end(
      JSON.stringify({
        ok: true,
        result: {
          id: Number(body.chat_id),
          type: "supergroup",
          title: "QA studio",
        },
      }),
    );
  if (method === "sendMessage") {
    attempts.push({ at: Date.now(), body, mode });
    if (mode === "fail") {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error_code: 500 }));
    }
    if (mode === "forbidden") {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error_code: 403 }));
    }
    if (mode === "429") {
      mode = "healthy";
      res.statusCode = 429;
      return res.end(
        JSON.stringify({
          ok: false,
          error_code: 429,
          parameters: { retry_after: 1 },
        }),
      );
    }
    messages.push(body);
    return res.end(
      JSON.stringify({ ok: true, result: { message_id: messages.length } }),
    );
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false }));
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const port = Number(process.env.TELEGRAM_QA_PORT || 3423),
  origin = `http://localhost:${port}`;
const env = {
  ...process.env,
  APP_ORIGIN: origin,
  DETAILING_DATA_DIR: dir,
  PLATFORM_AUTH_SECRET: randomBytes(32).toString("hex"),
  PLATFORM_ADMIN_PASSWORD_HASH_B64: Buffer.from(
    hashSync(password, 10),
  ).toString("base64"),
  DETAILING_QA_TELEGRAM: "1",
  DETAILING_TELEGRAM_QA_URL: `http://127.0.0.1:${mock.address().port}`,
  DETAILING_BACKUPS: "off",
};
writeFileSync(
  join(dir, "access.json"),
  JSON.stringify({ password, ownerPassword, token, origin, env }),
  { mode: 0o600 },
);
async function start() {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Fixture start failed");
}
async function stop() {
  if (server?.exitCode === null) {
    const done = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
    await done;
    clearTimeout(timer);
  }
}
async function call(
  path,
  method = "GET",
  body,
  cookie = "",
  expected = 200,
  extra = {},
) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      origin,
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const v = await r.json();
  assert.equal(r.status, expected, JSON.stringify(v));
  return { v, r };
}
const cookieOf = (r) =>
  r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
const agency = (path, method = "GET", body, expected = 200) =>
  call("/api/detailing/" + path, method, body, operatorCookie, expected);
const client = (cookie, action, method = "GET", body, expected = 200) =>
  call("/api/client?action=" + action, method, body, cookie, expected);
async function fixture(slug) {
  let p = (
    await agency(
      "projects",
      "POST",
      { slug, clientName: "FORMA QA", references: [] },
      201,
    )
  ).v.project;
  p = (
    await agency("projects/" + p.id, "PATCH", {
      version: p.version,
      clientName: p.clientName,
      references: [],
      config: {
        ...p.draft,
        demo: false,
        phone: "+7 000 000-00-00",
        address: "QA only",
        legalName: "QA operator",
        privacyText: "QA fixture for notifications; no actual visitor data.",
      },
    })
  ).v.project;
  p = (await agency(`projects/${p.id}/review`, "POST", { version: p.version }))
    .v.project;
  await call("/api/detailing/reviews/" + p.reviewToken, "POST", {
    decision: "approved",
  });
  p = (await agency(`projects/${p.id}/publish`, "POST", { version: p.version }))
    .v.project;
  const invite = (
    await call(
      "/api/client?action=invite",
      "POST",
      { projectId: p.id },
      operatorCookie,
      201,
    )
  ).v.invite;
  const activated = await call("/api/client?action=activate", "POST", {
    slug,
    invite,
    password: ownerPassword,
  });
  return { p, cookie: cookieOf(activated.r) };
}
const database = () => new DatabaseSync(join(dir, "studio.sqlite"));
async function waitFor(fn, label, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Timed out: " + label);
}
try {
  await start();
  operatorCookie = cookieOf(
    (await call("/api/platform-admin/session", "POST", { password })).r,
  );
  const a = await fixture("tg-one"),
    b = await fixture("tg-two");
  const state = async () => (await client(a.cookie, "telegram")).v;
  await client("", "telegram", "GET", undefined, 401);
  await call(
    "/api/client?action=telegram-connect",
    "POST",
    { token, chatId: "-10012345" },
    a.cookie,
    403,
    { origin: "https://evil.invalid" },
  );
  await client(a.cookie, "telegram-chats", "POST", { token: "invalid" }, 400);
  const found = (await client(a.cookie, "telegram-chats", "POST", { token })).v;
  assert.equal(found.chats.length, 2);
  await client(a.cookie, "telegram-connect", "POST", {
    token,
    chatId: "-10012345",
  });
  assert.equal(messages.length, 1);
  assert.equal((await state()).connected, true);
  assert.equal((await client(b.cookie, "telegram")).v.connected, false);
  assert.ok(!JSON.stringify(await state()).includes(token));
  let d = database();
  const stored = d
    .prepare("SELECT data FROM detail_telegram_connections WHERE project_id=?")
    .get(a.p.id).data;
  assert.ok(!stored.includes(token));
  d.close();
  const idempotency = new Map();
  async function book(project, offset = 2) {
    const date = new Date(Date.now() + offset * 86400000)
        .toISOString()
        .slice(0, 10),
      serviceId = project.draft.services[0].id;
    const slots = (
      await call(
        `/api/detailing/sites/${project.slug}/slots?service=${serviceId}&date=${date}`,
      )
    ).v.slots;
    assert.ok(slots.length);
    const body = {
      serviceId,
      date,
      time: slots[0],
      name: "Private Fixture Name",
      phone: "79990000000",
      car: "Private Fixture Car",
      comment: "Private fixture comment",
      consent: true,
      website: "",
      submissionToken: randomBytes(32).toString("hex"),
    };
    const saved = (
      await call(
        `/api/detailing/sites/${project.slug}/bookings`,
        "POST",
        body,
        "",
        201,
      )
    ).v.booking;
    idempotency.set(saved.id, body);
    return saved;
  }
  const one = await book(a.p);
  const firstPayload = idempotency.get(one.id);
  const repeated = (
    await call(
      "/api/detailing/sites/tg-one/bookings",
      "POST",
      firstPayload,
      "",
      201,
    )
  ).v.booking;
  assert.equal(one.id, repeated.id);
  await waitFor(async () => (await state()).sent === 1, "first delivery");
  assert.equal(
    messages.filter((m) => m.text.includes(one.id.slice(0, 8).toUpperCase()))
      .length,
    1,
  );
  const message = messages.at(-1).text;
  for (const privateValue of ["Private Fixture", "79990000000"])
    assert.ok(
      !message.includes(privateValue),
      "PII must remain in authenticated workspace",
    );
  assert.ok(message.includes("/client/tg-one?tab=bookings"));
  await book(b.p);
  assert.equal((await client(b.cookie, "telegram")).v.sent, 0);
  mode = "fail";
  const two = await book(a.p, 3);
  await waitFor(async () => {
    const s = await state();
    return (
      s.pending === 1 &&
      s.jobs.find((j) => j.bookingId === two.id)?.attempts >= 1
    );
  }, "failed attempt retained");
  assert.ok(
    (await client(a.cookie, "bookings")).v.bookings.some(
      (x) => x.id === two.id,
    ),
    "Telegram failure must not roll back saved booking",
  );
  mode = "healthy";
  await waitFor(async () => (await state()).sent === 2, "automatic retry");
  mode = "429";
  const three = await book(a.p, 4);
  await waitFor(async () => (await state()).sent === 3, "Telegram 429 retry");
  assert.equal(
    messages.filter((m) => m.text.includes(three.id.slice(0, 8).toUpperCase()))
      .length,
    1,
  );
  mode = "forbidden";
  const four = await book(a.p, 5);
  await waitFor(
    async () => (await state()).failed === 1,
    "permanent error visible",
  );
  mode = "healthy";
  await client(a.cookie, "telegram-retry", "POST", {});
  await waitFor(async () => (await state()).sent === 4, "manual retry");
  await stop();
  env.DETAILING_TELEGRAM_WORKER = "off";
  await start();
  const five = await book(a.p, 6);
  assert.equal((await state()).pending, 1);
  d = database();
  d.prepare(
    "UPDATE detail_notification_outbox SET state='sending',lease_until=?,attempts=1 WHERE booking_id=?",
  ).run(Date.now() - 1, five.id);
  d.close();
  await stop();
  delete env.DETAILING_TELEGRAM_WORKER;
  await start();
  await waitFor(
    async () => (await state()).sent === 5,
    "expired lease recovered after restart",
  );
  for (const [id] of idempotency)
    assert.ok(
      messages.filter((m) => m.text.includes(id.slice(0, 8).toUpperCase()))
        .length <= 1,
      "Already sent jobs must not resend on restart",
    );
  const updateMode = async (demo) => {
    const p = (await client(a.cookie, "project")).v.project;
    const saved = (
      await client(a.cookie, "project", "PATCH", {
        version: p.version,
        config: { ...p.draft, demo },
      })
    ).v.project;
    await client(a.cookie, "publish", "POST", { version: saved.version });
  };
  await updateMode(true);
  const mismatch = await call(
    "/api/detailing/sites/tg-one/bookings",
    "POST",
    { ...firstPayload, submissionToken: randomBytes(32).toString("hex") },
    "",
    409,
  );
  assert.equal(mismatch.v.code, "SITE_UPDATED");
  const config = (await call("/api/detailing/sites/tg-one/config")).v;
  assert.equal(config.config.demo, true);
  assert.ok(config.version);
  const sandboxDate = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const sandboxSlots = (
    await call(
      `/api/detailing/sites/tg-one/slots?service=${a.p.draft.services[0].id}&date=${sandboxDate}`,
    )
  ).v.slots;
  await call(
    "/api/detailing/sites/tg-one/demo-bookings",
    "POST",
    {
      serviceId: a.p.draft.services[0].id,
      date: sandboxDate,
      time: sandboxSlots[0],
      submissionToken: randomBytes(32).toString("hex"),
    },
    "",
    201,
  );
  assert.equal(
    (await state()).jobs.length,
    5,
    "Sandbox bookings must not notify",
  );
  await updateMode(false);
  assert.equal(
    (await call("/api/detailing/sites/tg-one/config")).v.config.demo,
    false,
  );
  const stale = await call(
    "/api/detailing/sites/tg-one/demo-bookings",
    "POST",
    {
      serviceId: a.p.draft.services[0].id,
      date: sandboxDate,
      time: sandboxSlots[0],
      submissionToken: randomBytes(32).toString("hex"),
    },
    "",
    409,
  );
  assert.equal(stale.v.code, "SITE_UPDATED");
  assert.ok(!stale.v.error.includes("Тестовая"));
  // Failure to persist the outbox must roll back the booking and slot together.
  d = database();
  const before = d
    .prepare("SELECT COUNT(*) AS count FROM detail_bookings WHERE project_id=?")
    .get(a.p.id).count;
  d.exec(
    "CREATE TRIGGER qa_fail_outbox BEFORE INSERT ON detail_notification_outbox BEGIN SELECT RAISE(ABORT,'QA outbox storage failure'); END",
  );
  d.close();
  const failDate = new Date(Date.now() + 9 * 86400000)
    .toISOString()
    .slice(0, 10);
  await call(
    "/api/detailing/sites/tg-one/bookings",
    "POST",
    {
      ...firstPayload,
      date: failDate,
      submissionToken: randomBytes(32).toString("hex"),
    },
    "",
    500,
    { "x-real-ip": "192.0.2.20" },
  );
  d = database();
  assert.equal(
    d
      .prepare(
        "SELECT COUNT(*) AS count FROM detail_bookings WHERE project_id=?",
      )
      .get(a.p.id).count,
    before,
  );
  d.exec("DROP TRIGGER qa_fail_outbox");
  d.close();
  await stop();
  env.DETAILING_TELEGRAM_WORKER = "off";
  await start();
  const six = await book(a.p, 8);
  assert.equal((await state()).pending, 1);
  await client(a.cookie, "telegram-disconnect", "POST", {});
  assert.equal((await state()).connected, false);
  assert.equal((await state()).pending, 0);
  assert.equal(
    (await state()).jobs.find((j) => j.bookingId === six.id).state,
    "cancelled",
  );
  assert.ok(!log.includes(token), "Bot token must never appear in server logs");
  console.log(
    "PASS: Telegram setup/chat discovery, encrypted credentials, project isolation, durable atomic outbox, idempotency, 500/429 retries, manual retry after 403, expired lease/restart recovery, disconnect, no PII in Telegram, published mode refresh and stale-form errors.",
  );
  console.log("Telegram QA fixture:", dir);
  if (process.argv.includes("--keep")) {
    console.log("QA running:", origin);
    await new Promise(() => {});
  }
} catch (error) {
  console.error(error);
  console.error(log.replaceAll(token, "[REDACTED]"));
  process.exitCode = 1;
} finally {
  await stop();
  await new Promise((resolve) => mock.close(resolve));
}

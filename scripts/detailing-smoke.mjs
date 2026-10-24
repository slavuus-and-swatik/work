import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
const dir = mkdtempSync(join(tmpdir(), "detailing-qa-"));
const password = randomBytes(16).toString("hex");
const port = Number(process.env.QA_PORT || 3417),
  origin = `http://localhost:${port}`;
const env = {
  ...process.env,
  DETAILING_DATA_DIR: dir,
  APP_ORIGIN: origin,
  PLATFORM_AUTH_SECRET: randomBytes(32).toString("hex"),
  PLATFORM_ADMIN_PASSWORD_HASH_B64: Buffer.from(
    hashSync(password, 10),
  ).toString("base64"),
};
writeFileSync(
  join(dir, "access.json"),
  JSON.stringify({ password, origin, env }),
  { mode: 0o600 },
);
let server,
  log = "",
  cookies = "";
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
      if ((await fetch(origin + "/api/platform-admin/session")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(log);
}
async function stop() {
  const child = server;
  if (child?.exitCode === null) {
    const done = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await done;
  }
}
async function req(
  path,
  method = "GET",
  body,
  auth = true,
  expected = 200,
  extra = {},
) {
  const res = await fetch(origin + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
      ...(auth ? { cookie: cookies } : {}),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data = await res.json();
  assert.equal(res.status, expected, JSON.stringify(data));
  return data;
}
const api = (p, ...args) => req("/api/detailing/" + p, ...args);
try {
  await start();
  const home = await fetch(origin + '/', { redirect: 'manual' });
  assert.equal(home.status, 307);
  assert.equal(new URL(home.headers.get('location'), origin).pathname, '/studio');
  assert.equal((await fetch(origin + '/api/download-source')).status, 404);
  assert.equal((await fetch(origin + '/admin')).status, 404);
  await api("projects", "GET", undefined, false, 401);
  await req("/api/platform-admin/session", "POST", { password }, false, 403, {
    origin: "https://evil.invalid",
  });
  let response = await fetch(origin + "/api/platform-admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ password }),
  });
  assert.equal(response.status, 200);
  cookies = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const upload = new FormData();
  upload.append('file', new Blob([readFileSync('public/detailing-hero.png')], {type:'image/png'}), 'cover.png');
  const uploaded = await fetch(origin+'/api/detailing/upload', {method:'POST', headers:{origin,cookie:cookies},body:upload});
  assert.equal(uploaded.status,201);
  const asset = (await uploaded.json()).url;
  const photo = await fetch(origin+asset);
  assert.equal(photo.headers.get('content-type'),'image/png');
  assert.ok((await photo.arrayBuffer()).byteLength>1000);
  let p = (
    await api(
      "projects",
      "POST",
      { clientName: "QA Detailing", slug: "qa-detailing", references: [] },
      true,
      201,
    )
  ).project;
  await api(
    `projects/${p.id}/publish`,
    "POST",
    { version: p.version },
    true,
    409,
  );
  p = (await api(`projects/${p.id}/review`, "POST", { version: p.version }))
    .project;
  const first = p.reviewToken;
  await api(
    `reviews/${first}`,
    "POST",
    { decision: "approved", comment: "QA acceptance" },
    false,
  );
  p = (await api(`projects/${p.id}/publish`, "POST", { version: p.version }))
    .project;
  assert.equal((await fetch(origin + "/s/qa-detailing")).status, 200);
  await api(
    "sites/qa-detailing/bookings",
    "POST",
    {
      serviceId: p.draft.services[0].id,
      date: "2026-11-01",
      time: "09:00",
      name: "QA Client",
      phone: "79990000000",
      car: "QA",
      comment: "",
      consent: true,
      website: "",
    },
    false,
    400,
  );
  const config = {
    ...p.draft,
    demo: false,
    headline: "Changed draft",
    phone: "+7 999 000-00-00",
    address: "QA test address",
    legalName: "QA Test operator",
    privacyText:
      "QA fixture only. Consent text for testing the booking workflow without real customer data.",
  };
  p = (
    await api(`projects/${p.id}`, "PATCH", {
      version: p.version,
      clientName: p.clientName,
      references: [],
      config,
    })
  ).project;
  await api(
    `projects/${p.id}`,
    "PATCH",
    {
      version: p.version - 1,
      clientName: p.clientName,
      references: [],
      config,
    },
    true,
    409,
  );
  assert.equal(
    (await api(`reviews/${first}`, "GET", undefined, false)).review.status,
    "superseded",
  );
  await api(`reviews/${first}`, "POST", { decision: "approved" }, false, 409);
  assert.ok(
    !(await (await fetch(origin + "/s/qa-detailing")).text()).includes(
      "Changed draft",
    ),
  );
  await api(
    `projects/${p.id}/publish`,
    "POST",
    { version: p.version },
    true,
    409,
  );
  p = (await api(`projects/${p.id}/review`, "POST", { version: p.version }))
    .project;
  await api(
    `reviews/${p.reviewToken}`,
    "POST",
    { decision: "changes", comment: "Adjust headline" },
    false,
  );
  await api(
    `projects/${p.id}/publish`,
    "POST",
    { version: p.version },
    true,
    409,
  );
  p = (
    await api(`projects/${p.id}`, "PATCH", {
      version: p.version,
      clientName: p.clientName,
      references: [],
      config: { ...config, headline: "Approved headline" },
    })
  ).project;
  p = (await api(`projects/${p.id}/review`, "POST", { version: p.version }))
    .project;
  await api(
    `reviews/${p.reviewToken}`,
    "POST",
    { decision: "approved" },
    false,
  );
  p = (await api(`projects/${p.id}/publish`, "POST", { version: p.version }))
    .project;
  const date = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    service = p.draft.services[0].id;
  const slots = (
    await api(
      `sites/${p.slug}/slots?service=${service}&date=${date}`,
      "GET",
      undefined,
      false,
    )
  ).slots;
  assert.ok(slots.length);
  const booking = {
    serviceId: service,
    date,
    time: slots[0],
    name: "QA Client",
    phone: "79990000000",
    car: "QA vehicle",
    comment: "QA fixture",
    consent: true,
    website: "",
  };
  const raced = await Promise.all(
    [1, 2].map(() =>
      fetch(origin + `/api/detailing/sites/${p.slug}/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(booking),
      }),
    ),
  );
  assert.deepEqual(raced.map((x) => x.status).sort(), [201, 409]);
  let bookings = (await api(`projects/${p.id}/bookings`)).bookings;
  assert.equal(bookings.length, 1);
  const b = bookings[0];
  const other = (
    await api(
      "projects",
      "POST",
      { clientName: "Other QA", slug: "qa-other", references: [] },
      true,
      201,
    )
  ).project;
  await api(
    `projects/${other.id}/bookings`,
    "PATCH",
    { id: b.id, status: "cancelled" },
    true,
    404,
  );
  await stop();
  await start();
  assert.equal((await fetch(origin+asset)).status,200);
  assert.equal((await api(`projects/${p.id}/bookings`)).bookings.length, 1);
  assert.equal(
    (await api(`projects/${p.id}`)).project.publishedVersion,
    p.version,
  );
  await api(`projects/${p.id}/bookings`, "PATCH", {
    id: b.id,
    status: "cancelled",
  });
  assert.ok(
    (
      await api(
        `sites/${p.slug}/slots?service=${service}&date=${date}`,
        "GET",
        undefined,
        false,
      )
    ).slots.includes(booking.time),
  );
  await api(
    `projects/${p.id}/bookings`,
    "PATCH",
    { id: b.id, status: "confirmed" },
    true,
    409,
  );
  await api(`projects/${p.id}/unpublish`, "POST", {});
  assert.equal((await fetch(origin + "/s/" + p.slug)).status, 404);
  console.log(
    "PASS: auth, origin, immutable approval, stale edits, publication, concurrent booking, project isolation, restart persistence, cancellation, unpublish.",
  );
  console.log("QA fixture:", dir);
  if (process.argv.includes("--keep")) {
    console.log("Preview server running:", origin);
    await new Promise(() => {});
  }
} catch (e) {
  console.error(e);
  console.error(log);
  process.exitCode = 1;
} finally {
  await stop();
}

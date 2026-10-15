// ─── A local stand-in for a Supabase project ──────────────────────────────────
// Real Postgres (PGlite) running the real migration with real row-level
// security, behind a small HTTP server that speaks just enough of GoTrue
// (/auth/v1) and PostgREST (/rest/v1) for @supabase/supabase-js. The app under
// test talks to it exactly as it would talk to supabase.co — same client
// library, same requests, same RLS — so these tests exercise the wire too.
import http from "http";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { PGlite } from "@electric-sql/pglite";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.fake-signature`;
const claims = (token) => { try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); } catch { return null; } };
const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set(["profiles", "workout_sessions", "exercise_logs"]);

export async function startFakeSupabase({ port = 0, requireEmailConfirm = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text unique, password text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261015000000_init.sql", import.meta.url), "utf8"));
  await db.exec("grant select, insert, update, delete on all tables in schema public to anon, authenticated;");

  // one connection → serialise every request
  let chain = Promise.resolve();
  const exclusive = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  const stats = { requests: 0, writes: 0, failNext: 0, down: false };
  const refresh = new Map(); // refresh token → user id

  const userJson = (u) => ({
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
    email_confirmed_at: new Date().toISOString(), phone: "", confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.raw_user_meta_data || {},
    identities: [], created_at: new Date(u.created_at || Date.now()).toISOString(), updated_at: new Date().toISOString(),
  });
  const session = (u) => {
    const now = Math.floor(Date.now() / 1000);
    const rt = randomUUID();
    refresh.set(rt, u.id);
    return {
      access_token: jwt({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, exp: now + 3600, iat: now }),
      token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userJson(u),
    };
  };

  async function asRole(sub, fn) {
    return exclusive(async () => {
      await db.exec("reset role");
      await db.exec(sub ? "set role authenticated" : "set role anon");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub || ""]);
      try { return await fn(); } finally { await db.exec("reset role"); }
    });
  }

  const pgError = (e) => {
    const code = e.code || "XX000";
    const status = code === "42501" ? 403 : code.startsWith("23") ? (code === "23505" ? 409 : 400) : code.startsWith("22") ? 400 : 500;
    return [status, { code, message: e.message, details: e.detail || null, hint: e.hint || null }];
  };

  async function rest(method, table, url, headers, body, sub) {
    if (!TABLES.has(table)) return [404, { code: "PGRST205", message: `Could not find the table 'public.${table}'` }];
    const params = url.searchParams;
    const where = [], args = [];
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      if (!IDENT.test(k)) return [400, { code: "PGRST100", message: `bad filter ${k}` }];
      const m = /^eq\.(.*)$/.exec(v);
      if (!m) return [400, { code: "PGRST100", message: `unsupported filter ${v}` }];
      args.push(m[1]); where.push(`${k}::text = $${args.length}`);
    }
    const W = where.length ? ` where ${where.join(" and ")}` : "";
    const prefer = String(headers["prefer"] || "");
    try {
      if (method === "GET") {
        let order = "";
        if (params.get("order")) {
          const [col, dir] = params.get("order").split(".");
          if (!IDENT.test(col)) return [400, { code: "PGRST100", message: "bad order" }];
          order = ` order by ${col} ${dir === "desc" ? "desc" : "asc"}`;
        }
        const limit = params.get("limit") ? ` limit ${+params.get("limit")}` : "";
        const offset = params.get("offset") ? ` offset ${+params.get("offset")}` : "";
        const r = await asRole(sub, () => db.query(`select coalesce(json_agg(x), '[]'::json) as j from (select * from public.${table}${W}${order}${limit}${offset}) x`, args));
        return [200, r.rows[0].j];
      }
      if (method === "POST") {
        stats.writes++;
        const rows = Array.isArray(body) ? body : [body];
        const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        if (!cols.every((c) => IDENT.test(c))) return [400, { code: "PGRST204", message: "bad column" }];
        const oc = params.get("on_conflict");
        let conflict = "";
        if (/resolution=merge-duplicates/.test(prefer)) {
          const target = (oc || "id").split(",").map((s) => s.trim());
          const upd = cols.filter((c) => !target.includes(c));
          conflict = ` on conflict (${target.join(",")}) do ${upd.length ? "update set " + upd.map((c) => `${c} = excluded.${c}`).join(", ") : "nothing"}`;
        }
        const returning = /return=representation/.test(prefer);
        const sql = `with ins as (insert into public.${table} (${cols.join(",")})
          select ${cols.join(",")} from json_populate_recordset(null::public.${table}, $1::json)${conflict} returning *) ` +
          (returning ? "select coalesce(json_agg(ins), '[]'::json) as j from ins" : "select count(*) as j from ins");
        const r = await asRole(sub, () => db.query(sql, [JSON.stringify(rows)]));
        return returning ? [201, r.rows[0].j] : [201, null];
      }
      if (method === "DELETE") {
        stats.writes++;
        if (!where.length) return [400, { code: "21000", message: "DELETE requires a WHERE clause" }];
        await asRole(sub, () => db.query(`delete from public.${table}${W}`, args));
        return [204, null];
      }
      if (method === "PATCH") {
        stats.writes++;
        const cols = Object.keys(body).filter((c) => IDENT.test(c));
        const sets = cols.map((c, i) => `${c} = (json_populate_record(null::public.${table}, $${args.length + 1}::json)).${c}`);
        await asRole(sub, () => db.query(`update public.${table} set ${sets.join(", ")}${W}`, [...args, JSON.stringify(body)]));
        return [204, null];
      }
      return [405, { message: "method not allowed" }];
    } catch (e) {
      return pgError(e);
    }
  }

  async function auth(method, path, url, body, bearer) {
    if (method === "POST" && path === "/signup") {
      const email = String(body.email || "").toLowerCase();
      if (!email.includes("@")) return [400, { code: 400, error_code: "validation_failed", msg: "Unable to validate email address: invalid format" }];
      if (String(body.password || "").length < 6) return [422, { code: 422, error_code: "weak_password", msg: "Password should be at least 6 characters." }];
      const exists = await exclusive(() => db.query("select 1 from auth.users where email = $1", [email]));
      if (exists.rows.length) return [422, { code: 422, error_code: "user_already_exists", msg: "User already registered" }];
      const u = { id: randomUUID(), email, password: body.password, raw_user_meta_data: body.data || {}, created_at: Date.now() };
      await exclusive(() => db.query("insert into auth.users (id, email, password, raw_user_meta_data) values ($1, $2, $3, $4)", [u.id, u.email, u.password, JSON.stringify(u.raw_user_meta_data)]));
      if (requireEmailConfirm) return [200, userJson(u)];
      return [200, session(u)];
    }
    if (method === "POST" && path === "/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const r = await exclusive(() => db.query("select * from auth.users where email = $1", [String(body.email || "").toLowerCase()]));
        const u = r.rows[0];
        if (!u || u.password !== body.password) return [400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }];
        return [200, session(u)];
      }
      if (grant === "refresh_token") {
        const id = refresh.get(body.refresh_token);
        if (!id) return [400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }];
        const r = await exclusive(() => db.query("select * from auth.users where id = $1", [id]));
        return [200, session(r.rows[0])];
      }
    }
    if (method === "GET" && path === "/user") {
      const c = bearer && claims(bearer);
      if (!c?.sub) return [401, { code: 401, msg: "invalid JWT" }];
      const r = await exclusive(() => db.query("select * from auth.users where id = $1", [c.sub]));
      return r.rows[0] ? [200, userJson(r.rows[0])] : [404, { msg: "User not found" }];
    }
    if (method === "POST" && path === "/logout") return [204, null];
    if (method === "GET" && path === "/settings") return [200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: !requireEmailConfirm }];
    return [404, { msg: `no route ${method} ${path}` }];
  }

  const server = http.createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-supabase-api-version, x-retry-count",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-expose-headers": "content-range, x-total-count",
    };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    stats.requests++;
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://localhost");
    const bearer = String(req.headers.authorization || "").replace(/^Bearer /i, "");
    const sub = claims(bearer)?.role === "authenticated" ? claims(bearer).sub : null;
    let out;
    if (stats.down || (stats.failNext > 0 && url.pathname.startsWith("/rest/") && req.method !== "GET" && stats.failNext--)) {
      out = [503, { message: "Service Unavailable (simulated)" }];
    } else if (url.pathname.startsWith("/auth/v1")) {
      out = await auth(req.method, url.pathname.slice(8), url, body, bearer);
    } else if (url.pathname.startsWith("/rest/v1/")) {
      out = await rest(req.method, url.pathname.slice(9), url, req.headers, body, sub);
    } else out = [404, { message: "not found" }];
    const [status, payload] = out;
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(payload == null ? "" : JSON.stringify(payload));
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    anonKey: jwt({ role: "anon", iss: "supabase-fake", exp: 4102444800 }),
    stats,
    db,
    query: (sql, params) => exclusive(() => db.query(sql, params)),
    close: () => new Promise((r) => server.close(r)),
  };
}

// run standalone for manual testing: node tests/fake-supabase.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startFakeSupabase({ port: +process.env.PORT || 54321 });
  console.log(`fake supabase on ${s.url}\nanon key: ${s.anonKey}`);
}

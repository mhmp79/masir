/// Masir PocketBase hooks - compatibility API for the existing frontend.
/// Intended for PocketBase v0.22+ JSVM.
///
/// Provides:
/// - POST /api/auth/request-otp, /api/auth/verify-otp, /api/auth/complete-signup
/// - POST /api/auth/login, /api/auth/reset-password, /api/auth/change-password
/// - GET  /api/me, PUT /api/account/profile
/// - GET  /api/admin/users, POST /api/admin/users, POST /api/admin/users/reset-password
/// - GET  /api/snapshot, POST /api/changes, POST /api/account/clear-data
/// - Advisor/admin link endpoints
/// - GET  /api/health
///
/// Notes:
/// - Realtime WS /api/ws is not implemented as raw WS here; returns 501.
/// - OTP SMS sending is dev-print by default; plug real provider in sendSms().

/* global $app, $apis, $os, $security, routerAdd, onAfterBootstrap */

const CONFIG = {
  jwtSecret: $os.getenv("MASIR_JWT_SECRET") || "change-me",
  jwtTtlSeconds: intEnv("MASIR_JWT_TTL_SECONDS", 7 * 24 * 3600),
  purposeTtlSeconds: intEnv("MASIR_PURPOSE_TOKEN_TTL_SECONDS", 10 * 60),
  otpTtlSeconds: intEnv("MASIR_OTP_TTL_SECONDS", 300),
  otpMaxAttempts: intEnv("MASIR_OTP_MAX_ATTEMPTS", 5),
  otpCooldownSeconds: intEnv("MASIR_OTP_REQUEST_COOLDOWN_SECONDS", 30),
  otpDevPrint: boolEnv("MASIR_OTP_DEV_PRINT", false),
  webOrigin: ($os.getenv("MASIR_WEB_ORIGIN") || "*"),
  adminPhones: parseCsvPhones($os.getenv("MASIR_ADMIN_PHONES") || ""),
};

const OTP_PURPOSES = ["signup", "reset"];
const USER_ROLES = ["student", "advisor", "admin"];
const TABLES = {
  subjects: { singleton: false },
  sessions: { singleton: false },
  activities: { singleton: false },
  classes: { singleton: false },
  sleeps: { singleton: false },
  phones: { singleton: false },
  exams: { singleton: false },
  questions: { singleton: false },
  app_meta: { singleton: false },
  tracker: { singleton: true },
  timer: { singleton: true },
};

function intEnv(name, def) { const n = parseInt($os.getenv(name) || "", 10); return Number.isFinite(n) && n > 0 ? n : def; }
function boolEnv(name, def) { const v = ($os.getenv(name) || "").toLowerCase(); if (!v) return def; return v === "1" || v === "true" || v === "yes" || v === "on"; }
function parseCsvPhones(v) { return String(v).split(",").map(normalizePhone).filter(Boolean); }
function now() { return new Date(); }
function iso(d) { return (d instanceof Date ? d : new Date(d)).toISOString(); }
function json(c, status, body) { c.response().header().set("Content-Type", "application/json"); return c.json(status, body); }
function bad(c, msg, status) { return json(c, status || 400, { ok: false, error: msg }); }
function errMsg(e) { return (e && e.message) ? e.message : String(e); }

function cors(c) {
  const origin = c.request().header.get("Origin") || "";
  const allow = CONFIG.webOrigin.split(",").map(s => s.trim()).filter(Boolean);
  const h = c.response().header();
  if (allow.includes("*")) h.set("Access-Control-Allow-Origin", "*");
  else if (origin && allow.includes(origin)) { h.set("Access-Control-Allow-Origin", origin); h.set("Vary", "Origin"); }
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "600");
}
function optionsOk(c) { cors(c); return c.noContent(204); }

function readBody(c) { try { return c.requestInfo().body || {}; } catch (_) { try { return JSON.parse(toString(c.request().body)); } catch (e) { return {}; } } }
function toString(v){ if (v==null) return ""; if (typeof v === "string") return v; try { return new TextDecoder().decode(v); } catch(_) { return String(v); } }

function normalizePhone(raw) {
  let v = String(raw == null ? "" : raw);
  v = v.replace(/[?-??-?]/g, ch => { const code = ch.charCodeAt(0); return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660); });
  v = v.replace(/[\s\-()+]/g, "");
  if (/^09\d{9}$/.test(v)) v = "+98" + v.slice(1);
  if (/^9\d{9}$/.test(v)) v = "+98" + v;
  if (/^98\d{10}$/.test(v)) v = "+" + v;
  if (!/^\+98\d{10}$/.test(v)) return "";
  return v;
}
function normalizeCode(raw) { const v = String(raw == null ? "" : raw).replace(/[?-??-?]/g, ch => { const code = ch.charCodeAt(0); return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660); }).replace(/\D/g, ""); return /^\d{4,8}$/.test(v) ? v : ""; }
function normalizePurpose(p) { const v = String(p == null ? "" : p).trim().toLowerCase(); return OTP_PURPOSES.includes(v) ? v : ""; }
function isValidPassword(pw) { return typeof pw === "string" && pw.length >= 8 && pw.length <= 1024; }
function safeName(v) { return String(v == null ? "" : v).trim().slice(0, 120); }
function safeProfilePatch(body) {
  const b = body || {};
  const firstName = safeName(b.firstName);
  const lastName = safeName(b.lastName);
  const field = safeName(b.field);
  const grade = safeName(b.grade);
  return { firstName, lastName, field, grade };
}

function hashPassword(password) {
  // PocketBase JSVM exposes bcrypt helpers; use bcrypt for new passwords.
  return $security.hashPassword(password);
}
function verifyPassword(password, hash) {
  if (!hash) return false;
  try { return $security.checkPasswordHash(password, hash); } catch (_) {}
  // Legacy scrypt format from Node backend: scrypt$<saltB64>$<hashB64>
  try {
    if (String(hash).startsWith("scrypt$")) {
      const parts = String(hash).split("$");
      if (parts.length === 3) {
        // JSVM may not have node:crypto scrypt; if unavailable, reject legacy hash.
        // Admin/reset flow can migrate it.
        if (typeof $security.hs256 !== "function") return false;
      }
    }
  } catch (_) {}
  return false;
}

function signJwt(payload, ttlSeconds) {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims = Object.assign({}, payload, { iat: nowSec, exp: nowSec + ttlSeconds });
  return $security.createJWT(claims, CONFIG.jwtSecret);
}
function verifyJwt(token) {
  try { return $security.parseJWT(String(token || ""), CONFIG.jwtSecret); } catch (_) { return null; }
}
function signToken(user) { return signJwt({ sub: String(user.id), phone: user.phone, role: user.role }, CONFIG.jwtTtlSeconds); }
function signPurposeToken(phone, purpose) { return signJwt({ phone, purpose, kind: "purpose" }, CONFIG.purposeTtlSeconds); }
function verifyPurposeToken(token, purpose) {
  const p = verifyJwt(token);
  if (!p || p.kind !== "purpose") return null;
  if (purpose && p.purpose !== purpose) return null;
  if (!OTP_PURPOSES.includes(p.purpose)) return null;
  return p;
}

function authUser(c) {
  const h = c.request().header.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = verifyJwt(m[1].trim());
  if (!payload || !payload.sub) return null;
  const rec = findUserById(String(payload.sub));
  if (!rec) return null;
  return { payload, user: publicUser(rec) };
}
function requireAuth(c) {
  cors(c);
  const a = authUser(c);
  if (!a) { bad(c, "Not signed in (HTTP 401). Sign in again to continue.", 401); return null; }
  return a;
}
function requireAdmin(c) {
  const a = requireAuth(c); if (!a) return null;
  if (a.user.role !== "admin") { bad(c, "admin role required", 403); return null; }
  return a;
}

function col(name) { return $app.findCollectionByNameOrId(name); }
function findUserById(id) { try { return $app.findRecordById("masir_users", id); } catch (_) { return null; } }
function findUserByPhone(phone) {
  try {
    return $app.findFirstRecordByFilter("masir_users", "phone = {:phone}", { phone });
  } catch (_) { return null; }
}
function publicUser(rec) {
  return {
    id: rec.id,
    phone: rec.getString("phone"),
    role: rec.getString("role") || "student",
    displayName: rec.getString("display_name") || "",
    firstName: rec.getString("first_name") || "",
    lastName: rec.getString("last_name") || "",
    field: rec.getString("field") || "",
    grade: rec.getString("grade") || "",
    createdAt: rec.get("created") ? iso(rec.get("created")) : null,
  };
}

function saveRecord(rec) { $app.save(rec); return rec; }
function newRecord(collectionName) { return new Record(col(collectionName)); }

function sendSms(phone, code, purpose) {
  if (CONFIG.otpDevPrint) console.log(`[masir][otp][dev] purpose=${purpose} phone=${phone} code=${code}`);
  // TODO: integrate real SMS provider here.
  return true;
}

function otpHash(phone, purpose, code) {
  return $security.sha256(`${purpose}:${phone}:${code}:${CONFIG.jwtSecret}`);
}

function createOtp(phone, purpose) {
  const nowMs = Date.now();
  // cooldown check
  try {
    const latest = $app.findRecordsByFilter("masir_otp_codes", "phone = {:phone} && purpose = {:purpose}", "-created", 1, 0, { phone, purpose });
    if (latest && latest.length) {
      const created = new Date(latest[0].get("created")).getTime();
      if (nowMs - created < CONFIG.otpCooldownSeconds * 1000) {
        return { ok: false, status: 429, error: "?? ?????? ????? ???. ??? ??? ????.", retryAfter: CONFIG.otpCooldownSeconds };
      }
    }
  } catch (_) {}

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const rec = newRecord("masir_otp_codes");
  rec.set("phone", phone);
  rec.set("purpose", purpose);
  rec.set("code_hash", otpHash(phone, purpose, code));
  rec.set("expires_at", new Date(nowMs + CONFIG.otpTtlSeconds * 1000));
  rec.set("attempts", 0);
  saveRecord(rec);
  sendSms(phone, code, purpose);
  return { ok: true, status: 200, body: { ok: true, expiresIn: CONFIG.otpTtlSeconds, cooldownSeconds: CONFIG.otpCooldownSeconds } };
}

function verifyOtp(phone, purpose, code) {
  let rec;
  try {
    const rows = $app.findRecordsByFilter("masir_otp_codes", "phone = {:phone} && purpose = {:purpose} && consumed_at = ''", "-created", 1, 0, { phone, purpose });
    rec = rows && rows[0];
  } catch (_) {}
  if (!rec) return { status: 400, body: { ok: false, error: "invalid or expired code" } };
  const expiresAt = new Date(rec.get("expires_at")).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { status: 400, body: { ok: false, error: "invalid or expired code" } };
  const attempts = parseInt(rec.get("attempts") || 0, 10) || 0;
  if (attempts >= CONFIG.otpMaxAttempts) return { status: 429, body: { ok: false, error: "too many attempts" } };
  const ok = rec.getString("code_hash") === otpHash(phone, purpose, code);
  if (!ok) {
    rec.set("attempts", attempts + 1);
    saveRecord(rec);
    return { status: 400, body: { ok: false, error: "invalid code", remaining: Math.max(0, CONFIG.otpMaxAttempts - attempts - 1) } };
  }
  rec.set("consumed_at", now());
  rec.set("attempts", attempts + 1);
  saveRecord(rec);
  const user = findUserByPhone(phone);
  return { status: 200, body: { ok: true, token: signPurposeToken(phone, purpose), purpose, expiresIn: CONFIG.purposeTtlSeconds, user: user ? publicUser(user) : null } };
}

function ensureUser(phone, attrs) {
  let rec = findUserByPhone(phone);
  if (!rec) {
    rec = newRecord("masir_users");
    rec.set("phone", phone);
    rec.set("role", CONFIG.adminPhones.includes(phone) ? "admin" : "student");
  }
  const a = attrs || {};
  if (a.displayName !== undefined) rec.set("display_name", safeName(a.displayName));
  if (a.firstName !== undefined) rec.set("first_name", safeName(a.firstName));
  if (a.lastName !== undefined) rec.set("last_name", safeName(a.lastName));
  if (a.field !== undefined) rec.set("field", safeName(a.field));
  if (a.grade !== undefined) rec.set("grade", safeName(a.grade));
  if (a.role !== undefined) rec.set("role", a.role);
  if (a.passwordHash !== undefined) { rec.set("password_hash", a.passwordHash); rec.set("password_updated_at", now()); }
  saveRecord(rec);
  return rec;
}

function roleCanSee(ownerId, user) {
  if (String(ownerId) === String(user.id)) return true;
  if (user.role !== "advisor" && user.role !== "admin") return false;
  try {
    const rows = $app.findRecordsByFilter("masir_advisor_links", "advisor_id = {:a} && student_id = {:s} && status = 'approved'", "-created", 1, 0, { a: String(user.id), s: String(ownerId) });
    return !!(rows && rows.length);
  } catch (_) { return false; }
}
function visibleOwnerIds(user) {
  const ids = [String(user.id)];
  if (user.role === "advisor" || user.role === "admin") {
    try {
      const rows = $app.findRecordsByFilter("masir_advisor_links", "advisor_id = {:a} && status = 'approved'", "-created", 500, 0, { a: String(user.id) });
      for (const r of rows || []) { const sid = r.getString("student_id"); if (sid) ids.push(String(sid)); }
    } catch (_) {}
  }
  return Array.from(new Set(ids));
}


function canWriteOwner(ownerId, user) {
  if (String(ownerId) === String(user.id)) return true;
  if (user.role !== "advisor" && user.role !== "admin") return false;
  return roleCanSee(ownerId, user);
}

function tableCollection(table) { return "masir_" + table; }
function isTable(t) { return !!TABLES[t]; }
function singletonId(table, localId) { return TABLES[table] && TABLES[table].singleton ? table : String(localId || ""); }

function normalizeChange(ch) {
  if (!ch || typeof ch !== "object") throw new Error("Invalid change. Expected a change object.");
  const table = String(ch.table || "").trim();
  if (!isTable(table)) throw new Error("Invalid change. Unknown table or local store.");
  const rawOp = String(ch.op || "upsert").toLowerCase();
  const op = rawOp === "delete" ? "delete" : "upsert";
  let id = ch.id != null ? String(ch.id) : "";
  id = singletonId(table, id);
  if (!id) throw new Error("Invalid change. Missing record id.");
  const clientUpdated = ch.clientUpdated ? new Date(ch.clientUpdated) : (ch.updated ? new Date(ch.updated) : now());
  const updated = ch.updated ? new Date(ch.updated) : now();
  return { table, id, op, clientUpdated: isNaN(clientUpdated) ? now() : clientUpdated, updated: isNaN(updated) ? now() : updated, data: ch.data || null };
}

function rowToData(table, rec) {
  const deleted = !!rec.getBool("deleted");
  const updated = rec.get("updated") ? iso(rec.get("updated")) : iso(now());
  const id = rec.getString("local_id");
  if (deleted) return { id, updated, deleted: true };
  const data = rec.get("data");
  if (data && typeof data === "object" && !Array.isArray(data)) return Object.assign({ id, updated }, data);
  const out = { id, updated };
  const fields = {
    subjects:["name","color","type","field","config","sessions_count","local_order"],
    sessions:["subject","topic","dur_min","date","start_min","done","done_at","activity_id","exam_id","ts","local_order"],
    activities:["subject","topic","minutes","date","start_min","end_min","note","local_order"],
    classes:["subject","total","sessions","local_order"],
    sleeps:["date","end_date","start_min","end_min","nap","local_order"],
    phones:["date","start_min","end_min","subject","note","local_order"],
    exams:["name","date","has_results","total_taraz","subjects","questions_count","local_order"],
    questions:["exam_id","number","subject","topic","status","note","question_text","answer_text","options","tags","starred","figure_ref","note_hidden","ts","local_order"],
    app_meta:["value","local_order"],
    tracker:["correct","wrong","blank","coef"],
    timer:["running","started_at","elapsed_ms","mode"],
  }[table] || [];
  for (const f of fields) { const v = rec.get(f); if (v === null || v === undefined || v === "") continue; out[f] = v; }
  return out;
}

function findDataRecord(table, ownerId, localId) {
  try {
    const rows = $app.findRecordsByFilter(tableCollection(table), "owner_id = {:o} && local_id = {:l}", "-updated", 1, 0, { o: String(ownerId), l: String(localId) });
    return rows && rows[0];
  } catch (_) { return null; }
}

function upsertChange(table, ownerId, localId, op, updated, data, actorId) {
  const rec = newRecord("masir_changes");
  rec.set("owner_id", String(ownerId));
  rec.set("table_name", table);
  rec.set("row_id", String(localId));
  rec.set("op", op);
  rec.set("updated", updated);
  rec.set("data", data);
  rec.set("actor_id", String(actorId || ownerId));
  saveRecord(rec);
}

function applyChange(change, user) {
  const ch = normalizeChange(change);
  const ownerId = String(user.id);
  if (!canWriteOwner(ownerId, user)) return { conflict: { id: ch.id, table: ch.table, error: "forbidden" } };
  const existing = findDataRecord(ch.table, ownerId, ch.id);
  if (existing) {
    const existingUpdated = new Date(existing.get("updated"));
    if (ch.clientUpdated < existingUpdated) return { conflict: { id: ch.id, table: ch.table, serverUpdated: iso(existingUpdated) }, serverRow: existing };
  }
  const rec = existing || newRecord(tableCollection(ch.table));
  rec.set("owner_id", ownerId); rec.set("local_id", ch.id); rec.set("updated", now()); rec.set("deleted", ch.op === "delete");
  rec.set("data", ch.op === "delete" ? { id: ch.id, deleted: true } : Object.assign({ id: ch.id }, ch.data || {}));
  if (ch.data && typeof ch.data === "object") {
    for (const [k,v] of Object.entries(ch.data)) {
      try { rec.set(k, v); } catch (_) {}
      const snake = k.replace(/[A-Z]/g, m => "_" + m.toLowerCase());
      if (snake !== k) { try { rec.set(snake, v); } catch (_) {} }
    }
  }
  saveRecord(rec);
  upsertChange(ch.table, ownerId, ch.id, ch.op, rec.get("updated"), rowToData(ch.table, rec), user.id);
  return { applied: ch.id };
}

function snapshotFor(user, since, limit) {
  const owners = visibleOwnerIds(user);
  const changes = [];
  const lim = Math.max(1, Math.min(5000, parseInt(limit || 500, 10) || 500));
  for (const ownerId of owners) {
    let filter = "owner_id = {:o}";
    const params = { o: String(ownerId) };
    if (since) { filter += " && updated > {:since}"; params.since = since; }
    try {
      for (const table of Object.keys(TABLES)) {
        const rows = $app.findRecordsByFilter(tableCollection(table), filter, "updated", lim, 0, params);
        for (const rec of rows || []) changes.push({ table, id: rec.getString("local_id"), op: rec.getBool("deleted") ? "delete" : "upsert", updated: iso(rec.get("updated")), data: rowToData(table, rec) });
      }
    } catch (e) { console.log("[masir] snapshot error", ownerId, errMsg(e)); }
  }
  changes.sort((a,b)=> String(a.updated).localeCompare(String(b.updated)) || String(a.table).localeCompare(String(b.table)) || String(a.id).localeCompare(String(b.id)));
  const sliced = changes.slice(0, lim);
  const body = { serverTime: iso(now()), changes: sliced };
  if (changes.length > lim) body.nextCursor = sliced[sliced.length - 1].updated;
  return body;
}

routerAdd("GET", "/api/health", (c) => { cors(c); return json(c, 200, { ok: true, serverTime: iso(now()), backend: "pocketbase" }); });
routerAdd("OPTIONS", "/api/*", optionsOk);
routerAdd("GET", "/api/ws", (c) => { cors(c); return json(c, 501, { ok:false, error:"/api/ws raw websocket not implemented in PocketBase hooks; app will sync by snapshot/polling." }); });


// ---- Auth routes ----
routerAdd("POST", "/api/auth/request-otp", (c) => {
  cors(c); const b = readBody(c);
  const phone = normalizePhone(b.phone); const purpose = normalizePurpose(b.purpose || "signup");
  if (!phone) return bad(c, "????? ?????? ??????? ???.");
  if (!purpose) return bad(c, "Invalid OTP purpose.");
  const out = createOtp(phone, purpose);
  return json(c, out.status, out.body || { ok:false, error: out.error, retryAfter: out.retryAfter });
});

routerAdd("POST", "/api/auth/verify-otp", (c) => {
  cors(c); const b = readBody(c);
  const phone = normalizePhone(b.phone); const purpose = normalizePurpose(b.purpose || "signup"); const code = normalizeCode(b.code);
  if (!phone || !purpose || !code) return bad(c, "invalid code");
  const out = verifyOtp(phone, purpose, code);
  return json(c, out.status, out.body);
});

routerAdd("POST", "/api/auth/complete-signup", (c) => {
  cors(c); const b = readBody(c);
  const p = verifyPurposeToken(b.token, "signup"); if (!p) return bad(c, "invalid or expired signup token");
  const phone = normalizePhone(p.phone); if (!phone) return bad(c, "invalid signup token");
  if (!isValidPassword(b.password)) return bad(c, "Password must be at least 8 characters long.");
  const existing = findUserByPhone(phone);
  if (existing && existing.getString("password_hash")) return json(c, 409, { ok:false, error:"an account with this phone already exists" });
  const rec = ensureUser(phone, { passwordHash: hashPassword(String(b.password)), displayName: b.displayName });
  const user = publicUser(rec);
  return json(c, 200, { token: signToken(user), user });
});

routerAdd("POST", "/api/auth/login", (c) => {
  cors(c); const b = readBody(c);
  const phone = normalizePhone(b.phone); const password = String(b.password == null ? "" : b.password);
  if (!phone || !isValidPassword(password)) return json(c, 401, { ok:false, error:"invalid credentials" });
  const rec = findUserByPhone(phone); const hash = rec ? rec.getString("password_hash") : "";
  if (!rec || !hash || !verifyPassword(password, hash)) return json(c, 401, { ok:false, error:"invalid credentials" });
  const user = publicUser(rec); return json(c, 200, { token: signToken(user), user });
});

routerAdd("POST", "/api/auth/reset-password", (c) => {
  cors(c); const b = readBody(c);
  const p = verifyPurposeToken(b.token, "reset"); if (!p) return bad(c, "invalid or expired reset token");
  const phone = normalizePhone(p.phone); if (!phone) return bad(c, "invalid reset token");
  if (!isValidPassword(b.password)) return bad(c, "Password must be at least 8 characters long.");
  const rec = findUserByPhone(phone); if (!rec) return bad(c, "invalid or expired reset token");
  const changedAt = rec.get("password_updated_at") ? Math.floor(new Date(rec.get("password_updated_at")).getTime()/1000) : 0;
  if (changedAt && p.iat && changedAt > p.iat) return bad(c, "invalid or expired reset token");
  rec.set("password_hash", hashPassword(String(b.password))); rec.set("password_updated_at", now()); saveRecord(rec);
  const user = publicUser(rec); return json(c, 200, { token: signToken(user), user });
});

routerAdd("POST", "/api/auth/change-password", (c) => {
  const a = requireAuth(c); if (!a) return;
  const b = readBody(c);
  const current = String(b.currentPassword == null ? "" : b.currentPassword);
  const next = String(b.newPassword == null ? "" : b.newPassword);
  if (!isValidPassword(next)) return bad(c, "Password must be at least 8 characters long.");
  const rec = findUserById(a.user.id); if (!rec) return bad(c, "user not found", 404);
  const hash = rec.getString("password_hash");
  if (!hash || !verifyPassword(current, hash)) return bad(c, "current password is incorrect");
  rec.set("password_hash", hashPassword(next)); rec.set("password_updated_at", now()); saveRecord(rec);
  return json(c, 200, { ok: true });
});

routerAdd("GET", "/api/me", (c) => {
  const a = requireAuth(c); if (!a) return;
  return json(c, 200, { user: a.user, expiresAt: a.payload.exp ? iso(new Date(a.payload.exp * 1000)) : null });
});

routerAdd("PUT", "/api/account/profile", (c) => {
  const a = requireAuth(c); if (!a) return;
  const patch = safeProfilePatch(readBody(c));
  const rec = findUserById(a.user.id); if (!rec) return bad(c, "user not found", 404);
  rec.set("first_name", patch.firstName); rec.set("last_name", patch.lastName); rec.set("field", patch.field); rec.set("grade", patch.grade);
  rec.set("display_name", [patch.firstName, patch.lastName].filter(Boolean).join(" "));
  saveRecord(rec);
  return json(c, 200, { ok: true, user: publicUser(rec) });
});


// ---- Admin/User routes ----
routerAdd("GET", "/api/admin/users", (c) => {
  const a = requireAdmin(c); if (!a) return;
  const limit = Math.max(1, Math.min(500, parseInt(c.queryParam("limit") || "100", 10) || 100));
  let rows = [];
  try { rows = $app.findRecordsByFilter("masir_users", "id != ''", "phone", limit, 0); } catch (_) {}
  return json(c, 200, { users: (rows||[]).map(publicUser) });
});

routerAdd("POST", "/api/admin/users", (c) => {
  const a = requireAdmin(c); if (!a) return;
  const b = readBody(c);
  const phone = normalizePhone(b.phone);
  if (!phone) return bad(c, "invalid phone number");
  const role = String(b.role || (CONFIG.adminPhones.includes(phone) ? "admin" : "student")).trim().toLowerCase();
  if (!USER_ROLES.includes(role)) return bad(c, "role must be student, advisor or admin");
  if (!isValidPassword(b.password)) return bad(c, "Password must be at least 8 characters long.");
  if (findUserByPhone(phone)) return json(c, 409, { ok:false, error:"a user with this phone already exists" });
  const rec = ensureUser(phone, { role, displayName: b.displayName, passwordHash: hashPassword(String(b.password)) });
  return json(c, 200, { user: publicUser(rec) });
});

routerAdd("POST", "/api/admin/users/reset-password", (c) => {
  const a = requireAdmin(c); if (!a) return;
  const b = readBody(c);
  const phone = normalizePhone(b.phone);
  if (!phone) return bad(c, "invalid phone number");
  if (!isValidPassword(b.password)) return bad(c, "Password must be at least 8 characters long.");
  const rec = findUserByPhone(phone);
  if (!rec) return json(c, 404, { ok:false, error:"user not found" });
  rec.set("password_hash", hashPassword(String(b.password))); rec.set("password_updated_at", now()); saveRecord(rec);
  return json(c, 200, { ok: true });
});

routerAdd("POST", "/api/account/clear-data", (c) => {
  const a = requireAuth(c); if (!a) return;
  const ownerId = String(a.user.id);
  const cleared = [];
  for (const table of Object.keys(TABLES)) {
    try {
      const rows = $app.findRecordsByFilter(tableCollection(table), "owner_id = {:o} && deleted = false", "-updated", 5000, 0, { o: ownerId });
      let n = 0;
      for (const rec of rows || []) { rec.set("deleted", true); rec.set("updated", now()); rec.set("data", { id: rec.getString("local_id"), deleted:true }); saveRecord(rec); upsertChange(table, ownerId, rec.getString("local_id"), "delete", rec.get("updated"), rowToData(table, rec), ownerId); n++; }
      if (n) cleared.push({ table, rows: n });
    } catch (e) { console.log("[masir] clear-data", table, errMsg(e)); }
  }
  return json(c, 200, { ok: true, cleared });
});

// ---- Sync routes ----
routerAdd("GET", "/api/snapshot", (c) => {
  const a = requireAuth(c); if (!a) return;
  const since = String(c.queryParam("since") || "").trim();
  const limit = c.queryParam("limit") || "500";
  return json(c, 200, snapshotFor(a.user, since, limit));
});

routerAdd("POST", "/api/changes", (c) => {
  const a = requireAuth(c); if (!a) return;
  const b = readBody(c);
  const changes = b && b.changes;
  if (!Array.isArray(changes)) return bad(c, "changes must be an array");
  if (changes.length > 2000) return json(c, 413, { error: "too many changes in one request" });
  const applied = []; const conflicts = [];
  for (const ch of changes) {
    try {
      const res = applyChange(ch, a.user);
      if (res.applied) applied.push(res.applied);
      if (res.conflict) conflicts.push(res.conflict);
    } catch (e) { conflicts.push({ id: ch && ch.id, table: ch && ch.table, error: "rejected" }); }
  }
  return json(c, 200, { applied, conflicts });
});


// ---- Advisor/Admin link routes ----
function findLinkByCode(code) {
  try { const rows = $app.findRecordsByFilter("masir_advisor_links", "code = {:c} && status = 'pending'", "-created", 1, 0, { c: code }); return rows && rows[0]; } catch (_) { return null; }
}

routerAdd("POST", "/api/advisors/invite", (c) => {
  const a = requireAuth(c); if (!a) return;
  if (a.user.role !== "advisor" && a.user.role !== "admin") return bad(c, "advisor role required", 403);
  // revoke previous pending
  try {
    const pending = $app.findRecordsByFilter("masir_advisor_links", "advisor_id = {:a} && status = 'pending'", "-created", 100, 0, { a: String(a.user.id) });
    for (const r of pending || []) { r.set("status", "revoked"); r.set("updated", now()); saveRecord(r); }
  } catch (_) {}
  const code = $security.randomString(8).toUpperCase();
  const rec = newRecord("masir_advisor_links");
  rec.set("advisor_id", String(a.user.id));
  rec.set("status", "pending");
  rec.set("code", code);
  rec.set("permissions", {});
  saveRecord(rec);
  return json(c, 200, { ok: true, code, expiresIn: 24 * 3600 });
});

routerAdd("POST", "/api/advisors/accept", (c) => {
  const a = requireAuth(c); if (!a) return;
  if (a.user.role !== "student") return bad(c, "student role required", 403);
  const b = readBody(c); const code = String(b.code || "").trim().toUpperCase();
  if (!code) return bad(c, "code is required");
  const rec = findLinkByCode(code);
  if (!rec) return json(c, 400, { ok:false, error:"invalid or expired code" });
  const created = new Date(rec.get("created")).getTime();
  if (Date.now() - created > 24 * 3600 * 1000) return json(c, 400, { ok:false, error:"invalid or expired code" });
  if (String(rec.getString("advisor_id")) === String(a.user.id)) return json(c, 400, { ok:false, error:"invalid or expired code" });
  const existingStudent = rec.getString("student_id");
  if (existingStudent && String(existingStudent) !== String(a.user.id)) return json(c, 400, { ok:false, error:"invalid or expired code" });
  rec.set("student_id", String(a.user.id)); rec.set("status", "approved"); rec.set("approved_at", now()); rec.set("code", ""); saveRecord(rec);
  const advisorRec = findUserById(rec.getString("advisor_id"));
  return json(c, 200, { ok: true, advisor: advisorRec ? publicUser(advisorRec) : { id: rec.getString("advisor_id") } });
});

routerAdd("GET", "/api/advisors/links", (c) => {
  const a = requireAuth(c); if (!a) return;
  const isAdmin = a.user.role === "admin";
  const uid = String(a.user.id);
  let rows = [];
  try {
    const filter = isAdmin ? "id != ''" : "advisor_id = {:u} || student_id = {:u}";
    rows = $app.findRecordsByFilter("masir_advisor_links", filter, "-created", 200, 0, { u: uid });
  } catch (_) {}
  const links = (rows||[]).map(r => {
    const advisor = findUserById(r.getString("advisor_id"));
    const studentId = r.getString("student_id");
    const student = studentId ? findUserById(studentId) : null;
    return {
      id: r.id,
      code: r.getString("status") === "pending" ? r.getString("code") : null,
      status: r.getString("status"),
      createdAt: iso(r.get("created")),
      approvedAt: r.get("approved_at") ? iso(r.get("approved_at")) : null,
      advisor: advisor ? publicUser(advisor) : { id: r.getString("advisor_id") },
      student: student ? publicUser(student) : (studentId ? { id: studentId } : null),
    };
  });
  return json(c, 200, { links });
});

routerAdd("POST", "/api/admin/advisor-links", (c) => {
  const a = requireAdmin(c); if (!a) return;
  const b = readBody(c);
  const advisorPhone = normalizePhone(b.advisor || b.advisorPhone);
  const studentPhone = normalizePhone(b.student || b.studentPhone);
  const advisor = advisorPhone ? findUserByPhone(advisorPhone) : null;
  const student = studentPhone ? findUserByPhone(studentPhone) : null;
  if (!advisor || !student) return json(c, 404, { error: "advisor or student not found" });
  if (advisor.getString("role") !== "advisor") return json(c, 400, { error: "selected user is not an advisor" });
  if (student.getString("role") !== "student") return json(c, 400, { error: "selected user is not a student" });
  let rec;
  try {
    const rows = $app.findRecordsByFilter("masir_advisor_links", "advisor_id = {:a} && student_id = {:s}", "-created", 1, 0, { a: advisor.id, s: student.id });
    rec = rows && rows[0];
  } catch (_) {}
  if (!rec) rec = newRecord("masir_advisor_links");
  rec.set("advisor_id", advisor.id); rec.set("student_id", student.id); rec.set("status", "approved"); rec.set("approved_at", now()); rec.set("code", "");
  saveRecord(rec);
  return json(c, 200, { ok: true, link: { id: rec.id, advisor: publicUser(advisor), student: publicUser(student), status: "approved" } });
});

// Optional bootstrap admin for fresh PocketBase setup.
// Set MASIR_BOOTSTRAP_ADMIN_PHONE and MASIR_BOOTSTRAP_ADMIN_PASSWORD once, restart PB, then remove them.
onAfterBootstrap((e) => {
  try {
    const phone = normalizePhone($os.getenv("MASIR_BOOTSTRAP_ADMIN_PHONE") || "");
    const pw = String($os.getenv("MASIR_BOOTSTRAP_ADMIN_PASSWORD") || "");
    if (!phone || !isValidPassword(pw)) return;
    let rec = findUserByPhone(phone);
    if (!rec) {
      ensureUser(phone, { role: "admin", passwordHash: hashPassword(pw), displayName: "Admin" });
      console.log("[masir] bootstrap admin created", phone);
    } else if (!rec.getString("password_hash")) {
      rec.set("password_hash", hashPassword(pw));
      rec.set("role", "admin");
      rec.set("password_updated_at", now());
      saveRecord(rec);
      console.log("[masir] bootstrap admin password set", phone);
    }
  } catch (err) {
    console.log("[masir] bootstrap admin failed", errMsg(err));
  }
});

console.log("[masir] PocketBase hooks loaded: compatibility API active");

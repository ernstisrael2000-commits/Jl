const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Firebase Admin SDK (service account) ────────────────────────────────────
// Used for server-side verification of admin sessions (the client Firebase
// SDK is only used for sign-in; the server never trusts the client's opinion
// of who is an admin).
let firebaseAdminApp = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
  if (raw.trim()) {
    const serviceAccount = JSON.parse(raw);
    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[Firebase Admin] Initialisé avec le compte de service.");
  } else {
    console.warn(
      "[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY absent — les sessions admin sécurisées sont désactivées."
    );
  }
} catch (e) {
  console.error("[Firebase Admin] Échec d'initialisation:", e.message);
}

const SESSION_COOKIE_NAME = "jl_admin_session";
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 jours

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function setSessionCookie(res, value, maxAgeMs) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// Verifies the session cookie against Firebase Admin and checks the email is
// in ADMIN_EMAILS. Returns the decoded token or null.
async function getAdminSession(req) {
  if (!firebaseAdminApp) return null;
  const cookies = parseCookies(req);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (!sessionCookie) return null;
  try {
    const decoded = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true /* checkRevoked */);
    if (!ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((decoded.email || "").toLowerCase())) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// ── Firebase config (from env vars) ────────────────────────────────────────
// Guard: FIREBASE_API_KEY must be the short web API key (AIzaSy…), NOT a
// service-account JSON blob.  If someone pastes the whole JSON, treat as
// unconfigured so the UI shows the helpful setup warning instead of crashing.
const _rawApiKey = process.env.FIREBASE_API_KEY || "";
const _apiKey = _rawApiKey.trimStart().startsWith("{") ? "" : _rawApiKey;

const FIREBASE_CONFIG = {
  apiKey: _apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};

const ADMIN_EMAILS = [
  "neopayservices509@gmail.com",
  "venelsonliberus11@gmail.com",
];

// ── Data helpers ────────────────────────────────────────────────────────────
function readData(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeData(name, items) {
  fs.writeFileSync(
    path.join(DATA_DIR, `${name}.json`),
    JSON.stringify(items, null, 2)
  );
}

// Initialize data files if missing
["produits", "commandes", "devis", "contacts"].forEach((name) => {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
});

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function jsonRes(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// ── API router ──────────────────────────────────────────────────────────────
async function handleAPI(req, res, urlPath) {
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // GET /api/config  — Firebase config for the frontend
  if (urlPath === "/api/config" && method === "GET") {
    return jsonRes(res, 200, {
      firebase: FIREBASE_CONFIG,
      adminEmails: ADMIN_EMAILS,
      configured: !!FIREBASE_CONFIG.apiKey,
      adminSessionsEnabled: !!firebaseAdminApp,
    });
  }

  // POST /api/session — exchange a Firebase ID token for a secure, httpOnly
  // admin session cookie. Verified server-side via the Firebase Admin SDK,
  // so the client can never fake admin access.
  if (urlPath === "/api/session" && method === "POST") {
    if (!firebaseAdminApp) {
      return jsonRes(res, 503, {
        error: "Compte de service Firebase non configuré sur le serveur.",
      });
    }
    const body = await parseBody(req);
    if (!body.idToken) return jsonRes(res, 400, { error: "idToken manquant" });
    try {
      const decoded = await admin.auth().verifyIdToken(body.idToken);
      const isAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
        (decoded.email || "").toLowerCase()
      );
      if (!isAdmin) {
        return jsonRes(res, 403, { error: "not_admin", isAdmin: false });
      }
      const sessionCookie = await admin
        .auth()
        .createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE_MS });
      setSessionCookie(res, sessionCookie, SESSION_MAX_AGE_MS);
      return jsonRes(res, 200, { ok: true, isAdmin: true, email: decoded.email });
    } catch (e) {
      console.error("[POST /api/session] Échec:", e.code || "", e.message);
      return jsonRes(res, 401, { error: "Jeton invalide ou expiré.", detail: e.message });
    }
  }

  // GET /api/whoami — current admin session, if any
  if (urlPath === "/api/whoami" && method === "GET") {
    const session = await getAdminSession(req);
    if (!session) return jsonRes(res, 401, { error: "not_authenticated" });
    return jsonRes(res, 200, { email: session.email, isAdmin: true });
  }

  // POST /api/logout — clear the admin session cookie
  if (urlPath === "/api/logout" && method === "POST") {
    clearSessionCookie(res);
    return jsonRes(res, 200, { ok: true });
  }

  // ── /api/produits ──────────────────────────────────────────────────────
  // Reading the catalog is public (boutique page); creating/editing/deleting
  // products requires a verified admin session.
  if (urlPath === "/api/produits") {
    if (method === "GET") return jsonRes(res, 200, readData("produits"));
    if (method === "POST") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
      const body = await parseBody(req);
      const items = readData("produits");
      const item = {
        ...body,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      items.push(item);
      writeData("produits", items);
      return jsonRes(res, 201, item);
    }
  }

  const produitMatch = urlPath.match(/^\/api\/produits\/([^/]+)$/);
  if (produitMatch) {
    const id = produitMatch[1];
    if (method === "PUT" || method === "DELETE") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
    }
    if (method === "PUT") {
      const body = await parseBody(req);
      let items = readData("produits");
      items = items.map((p) => (p.id === id ? { ...p, ...body, id } : p));
      writeData("produits", items);
      return jsonRes(res, 200, items.find((p) => p.id === id) || {});
    }
    if (method === "DELETE") {
      let items = readData("produits");
      items = items.filter((p) => p.id !== id);
      writeData("produits", items);
      return jsonRes(res, 200, { ok: true });
    }
  }

  // ── /api/commandes ─────────────────────────────────────────────────────
  // Listing all orders is admin-only (customer data); creating an order from
  // checkout stays public.
  if (urlPath === "/api/commandes") {
    if (method === "GET") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
      return jsonRes(res, 200, readData("commandes"));
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const items = readData("commandes");
      const item = {
        ...body,
        id: `JL-${Date.now()}`,
        statut: "En attente",
        createdAt: new Date().toISOString(),
      };
      items.unshift(item);
      writeData("commandes", items);
      return jsonRes(res, 201, item);
    }
  }

  const commandeMatch = urlPath.match(/^\/api\/commandes\/([^/]+)$/);
  if (commandeMatch) {
    const id = commandeMatch[1];
    if (method === "PUT" || method === "DELETE") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
    }
    if (method === "PUT") {
      const body = await parseBody(req);
      let items = readData("commandes");
      items = items.map((c) => (c.id === id ? { ...c, ...body, id } : c));
      writeData("commandes", items);
      return jsonRes(res, 200, items.find((c) => c.id === id) || {});
    }
    if (method === "DELETE") {
      let items = readData("commandes");
      items = items.filter((c) => c.id !== id);
      writeData("commandes", items);
      return jsonRes(res, 200, { ok: true });
    }
  }

  // ── /api/devis ─────────────────────────────────────────────────────────
  // Listing quote requests is admin-only; submitting a new request from the
  // public devis form stays open.
  if (urlPath === "/api/devis") {
    if (method === "GET") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
      return jsonRes(res, 200, readData("devis"));
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const items = readData("devis");
      const item = {
        ...body,
        id: Date.now().toString(),
        statut: "Nouveau",
        lu: false,
        createdAt: new Date().toISOString(),
      };
      items.unshift(item);
      writeData("devis", items);
      return jsonRes(res, 201, item);
    }
  }

  const devisMatch = urlPath.match(/^\/api\/devis\/([^/]+)$/);
  if (devisMatch) {
    const id = devisMatch[1];
    if (method === "PUT" || method === "DELETE") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
    }
    if (method === "PUT") {
      const body = await parseBody(req);
      let items = readData("devis");
      items = items.map((d) => (d.id === id ? { ...d, ...body, id } : d));
      writeData("devis", items);
      return jsonRes(res, 200, items.find((d) => d.id === id) || {});
    }
    if (method === "DELETE") {
      let items = readData("devis");
      items = items.filter((d) => d.id !== id);
      writeData("devis", items);
      return jsonRes(res, 200, { ok: true });
    }
  }

  // ── /api/contacts ──────────────────────────────────────────────────────
  // Listing contact messages is admin-only; submitting the public contact
  // form stays open.
  if (urlPath === "/api/contacts") {
    if (method === "GET") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
      return jsonRes(res, 200, readData("contacts"));
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const items = readData("contacts");
      const item = {
        ...body,
        id: Date.now().toString(),
        lu: false,
        createdAt: new Date().toISOString(),
      };
      items.unshift(item);
      writeData("contacts", items);
      return jsonRes(res, 201, item);
    }
  }

  const contactMatch = urlPath.match(/^\/api\/contacts\/([^/]+)$/);
  if (contactMatch) {
    const id = contactMatch[1];
    if (method === "PUT" || method === "DELETE") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
    }
    if (method === "PUT") {
      const body = await parseBody(req);
      let items = readData("contacts");
      items = items.map((c) => (c.id === id ? { ...c, ...body, id } : c));
      writeData("contacts", items);
      return jsonRes(res, 200, items.find((c) => c.id === id) || {});
    }
    if (method === "DELETE") {
      let items = readData("contacts");
      items = items.filter((c) => c.id !== id);
      writeData("contacts", items);
      return jsonRes(res, 200, { ok: true });
    }
  }

  return jsonRes(res, 404, { error: "Route introuvable" });
}

// ── Static file server ──────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (urlPath.startsWith("/api/")) {
    handleAPI(req, res, urlPath).catch((err) => {
      jsonRes(res, 500, { error: err.message });
    });
    return;
  }

  // Server-side gate: dashboard.html is only ever served to a verified admin
  // session. This removes the old client-only check, which could hang or be
  // bypassed and left admins stuck on a "Vérification de l'accès" screen.
  if (urlPath === "/dashboard.html") {
    getAdminSession(req).then((session) => {
      if (!session) {
        res.writeHead(302, { Location: "/login.html?next=%2Fdashboard.html" });
        res.end();
        return;
      }
      fs.readFile(path.join(ROOT, "dashboard.html"), (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Erreur serveur");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(data);
      });
    });
    return;
  }

  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, path.normalize(urlPath));
  const relative = path.relative(ROOT, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, "404.html"), (err404, data404) => {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data404 || "404 Not Found");
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Le port ${PORT} est déjà utilisé par un autre processus (probablement une ancienne instance du serveur encore en cours d'arrêt). Réessai dans 1 seconde...`
    );
    setTimeout(() => {
      server.close();
      server.listen(PORT, "0.0.0.0");
    }, 1000);
  } else {
    console.error("Erreur du serveur:", err);
    process.exit(1);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JL & Co design site running on port ${PORT}`);
});

// Arrêt propre : libère le port immédiatement quand le workflow redémarre,
// pour éviter les erreurs EADDRINUSE au prochain démarrage.
function shutdown() {
  server.close(() => process.exit(0));
  // Filet de sécurité si close() traîne (connexions ouvertes)
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

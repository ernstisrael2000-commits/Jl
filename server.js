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

const SESSION_COOKIE_NAME = "jl_session";
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

// Verifies the session cookie against Firebase Admin. Works for ANY signed-in
// user (customer or admin) — this is the single source of truth for "who is
// logged in" across the whole site, replacing the old client-only Firebase
// state checks that were unreliable (popups/webviews/redirect races).
// Returns { email, uid, isAdmin } or null.
async function getSession(req) {
  if (!firebaseAdminApp) return null;
  const cookies = parseCookies(req);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (!sessionCookie) return null;
  try {
    const decoded = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true /* checkRevoked */);
    const isAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
      (decoded.email || "").toLowerCase()
    );
    return { email: decoded.email, uid: decoded.uid, isAdmin };
  } catch {
    return null;
  }
}

// Same as getSession, but only returns a result for verified admins — used to
// gate /dashboard.html and admin-only API routes.
async function getAdminSession(req) {
  const session = await getSession(req);
  return session && session.isAdmin ? session : null;
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

// ── Pay'm Plop plop (mobile money marchand : MonCash, NatCash, Kashpaw) ─────
// Le client_id marchand est un secret serveur — jamais exposé au navigateur.
// Doc : https://plopplop.solutionip.app/paiement-doc
const PLOPPLOP_BASE_URL = "https://plopplop.solutionip.app";
const PLOPPLOP_CLIENT_ID = process.env.PLOPPLOP_CLIENT_ID || "";
if (!PLOPPLOP_CLIENT_ID) {
  console.warn(
    "[Plop plop] PLOPPLOP_CLIENT_ID absent — le moyen de paiement Pay'm Plop plop est désactivé."
  );
}

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
["produits", "commandes", "devis", "contacts", "paiements_plopplop"].forEach((name) => {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
});

// ── Réglages du site (taxe/frais + coordonnées du développeur) ──────────────
// Fichier objet (pas un tableau) : { taxeActive, taxeTaux, taxeLabel, dev }.
// Les coordonnées du développeur sont fixes (fournies par le développeur),
// seule la taxe est modifiable depuis le dashboard admin.
const SETTINGS_FILE = path.join(DATA_DIR, "reglages.json");
const DEFAULT_SETTINGS = {
  taxeActive: true,
  taxeTaux: 20,
  taxeLabel: "Taxes estimées",
  dev: {
    entreprise: "Rena Dev",
    whatsapp: "+50940274789",
    email: "neopayservices509@gmail.com",
  },
};
function readSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    return { ...DEFAULT_SETTINGS, ...raw, dev: { ...DEFAULT_SETTINGS.dev, ...(raw.dev || {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
if (!fs.existsSync(SETTINGS_FILE)) writeSettings(DEFAULT_SETTINGS);

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

  // POST /api/session — exchange a Firebase ID token (from ANY successful
  // sign-in: Google, email/password, or fresh signup) for a secure, httpOnly
  // session cookie. This is the single source of truth for "logged in" across
  // the whole site — the client SDK's own state is never trusted directly.
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
      const sessionCookie = await admin
        .auth()
        .createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE_MS });
      setSessionCookie(res, sessionCookie, SESSION_MAX_AGE_MS);
      return jsonRes(res, 200, { ok: true, isAdmin, email: decoded.email });
    } catch (e) {
      console.error("[POST /api/session] Échec:", e.code || "", e.message);
      return jsonRes(res, 401, { error: "Jeton invalide ou expiré.", detail: e.message });
    }
  }

  // TEMP DEBUG ROUTE — remove after use. Sets a session cookie from a query
  // idToken and redirects, so a screenshot tool (which can't run a real
  // browser OAuth/JS flow) can capture an authenticated page.
  if (urlPath === "/api/_debug_session" && method === "GET") {
    const idToken = new URL(req.url, "http://localhost").searchParams.get("idToken");
    if (!idToken) return jsonRes(res, 400, { error: "idToken manquant" });
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const isAdmin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
        (decoded.email || "").toLowerCase()
      );
      const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
      setSessionCookie(res, sessionCookie, SESSION_MAX_AGE_MS);
      res.writeHead(302, { Location: isAdmin ? "/dashboard.html" : "/" });
      return res.end();
    } catch (e) {
      return jsonRes(res, 401, { error: e.message });
    }
  }

  // GET /api/whoami — current session (any logged-in user), if any
  if (urlPath === "/api/whoami" && method === "GET") {
    const session = await getSession(req);
    if (!session) return jsonRes(res, 401, { error: "not_authenticated" });
    return jsonRes(res, 200, { email: session.email, isAdmin: session.isAdmin });
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
      if (body.prix != null) body.prix = Math.max(0, Math.min(10000, Number(body.prix) || 0));
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
      if (body.prix != null) body.prix = Math.max(0, Math.min(10000, Number(body.prix) || 0));
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

  // ── /api/settings ──────────────────────────────────────────────────────
  // Réglages du site (taxe/frais appliqués au paiement + coordonnées du
  // développeur). Lecture publique (utilisée par panier.html/paiement.html
  // pour calculer la taxe et par le dashboard) ; écriture admin uniquement.
  if (urlPath === "/api/settings") {
    if (method === "GET") return jsonRes(res, 200, readSettings());
    if (method === "PUT") {
      if (!(await getAdminSession(req))) return jsonRes(res, 401, { error: "Accès admin requis." });
      const body = await parseBody(req);
      const current = readSettings();
      const next = { ...current };
      if (body.taxeActive != null) next.taxeActive = !!body.taxeActive;
      if (body.taxeTaux != null) next.taxeTaux = Math.max(0, Math.min(100, Number(body.taxeTaux) || 0));
      if (typeof body.taxeLabel === "string" && body.taxeLabel.trim()) next.taxeLabel = body.taxeLabel.trim();
      writeSettings(next);
      return jsonRes(res, 200, next);
    }
  }

  // ── /api/paiement/plopplop ─────────────────────────────────────────────
  // Crée une transaction Pay'm Plop plop (MonCash/NatCash/Kashpaw) et renvoie
  // l'URL de redirection vers laquelle rediriger le client pour payer.
  if (urlPath === "/api/paiement/plopplop" && method === "POST") {
    if (!PLOPPLOP_CLIENT_ID) {
      return jsonRes(res, 503, {
        error: "Pay'm Plop plop n'est pas configuré sur le serveur (PLOPPLOP_CLIENT_ID manquant).",
      });
    }
    const body = await parseBody(req);
    const montant = Number(body.montant);
    const payment_method = ["moncash", "kashpaw", "natcash", "all"].includes(body.payment_method)
      ? body.payment_method
      : "all";
    if (!montant || montant < 20) {
      return jsonRes(res, 400, { error: "Montant invalide (minimum 20 HTG)." });
    }
    const refference_id = `JLCO-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    try {
      const apiRes = await fetch(`${PLOPPLOP_BASE_URL}/api/paiement-marchand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLOPPLOP_CLIENT_ID,
          refference_id,
          montant,
          payment_method,
        }),
      });
      const data = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !data.status) {
        return jsonRes(res, apiRes.status || 502, {
          error: data.message || "Échec de création de la transaction Pay'm Plop plop.",
        });
      }
      const items = readData("paiements_plopplop");
      items.unshift({
        refference_id,
        transaction_id: data.transaction_id,
        montant,
        payment_method,
        commande: body.commande || null,
        trans_status: "no",
        createdAt: new Date().toISOString(),
      });
      writeData("paiements_plopplop", items);
      return jsonRes(res, 200, {
        ok: true,
        url: data.url,
        transaction_id: data.transaction_id,
        refference_id,
      });
    } catch (e) {
      console.error("[Plop plop] Échec de création de transaction:", e.message);
      return jsonRes(res, 502, { error: "Impossible de contacter Pay'm Plop plop." });
    }
  }

  // GET /api/paiement/plopplop/statut?refference_id=... — vérifie l'état
  // d'une transaction déjà créée (à interroger périodiquement côté client).
  if (urlPath === "/api/paiement/plopplop/statut" && method === "GET") {
    if (!PLOPPLOP_CLIENT_ID) {
      return jsonRes(res, 503, { error: "Pay'm Plop plop n'est pas configuré sur le serveur." });
    }
    const refference_id = new URL(req.url, "http://localhost").searchParams.get("refference_id");
    if (!refference_id) return jsonRes(res, 400, { error: "refference_id manquant" });
    try {
      const apiRes = await fetch(`${PLOPPLOP_BASE_URL}/api/paiement-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: PLOPPLOP_CLIENT_ID, refference_id }),
      });
      const data = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !data.status) {
        return jsonRes(res, apiRes.status || 502, {
          error: data.message || "Échec de vérification de la transaction.",
        });
      }
      const items = readData("paiements_plopplop");
      const updated = items.map((p) =>
        p.refference_id === refference_id ? { ...p, trans_status: data.trans_status } : p
      );
      writeData("paiements_plopplop", updated);
      return jsonRes(res, 200, {
        trans_status: data.trans_status,
        montant: data.montant,
        method: data.method,
      });
    } catch (e) {
      console.error("[Plop plop] Échec de vérification:", e.message);
      return jsonRes(res, 502, { error: "Impossible de contacter Pay'm Plop plop." });
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

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Firebase config (from env vars) ────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || "",
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
    });
  }

  // ── /api/produits ──────────────────────────────────────────────────────
  if (urlPath === "/api/produits") {
    if (method === "GET") return jsonRes(res, 200, readData("produits"));
    if (method === "POST") {
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
  if (urlPath === "/api/commandes") {
    if (method === "GET") return jsonRes(res, 200, readData("commandes"));
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
  if (urlPath === "/api/devis") {
    if (method === "GET") return jsonRes(res, 200, readData("devis"));
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
  if (urlPath === "/api/contacts") {
    if (method === "GET") return jsonRes(res, 200, readData("contacts"));
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JL & Co design site running on port ${PORT}`);
});

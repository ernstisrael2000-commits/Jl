/**
 * JL & Co — Module d'authentification partagé
 * Chargé sur toutes les pages. Gère :
 *   - Initialisation Firebase
 *   - État de connexion (client ou admin)
 *   - Mise à jour du nav (desktop + burger)
 *   - Vue portail sur la homepage
 *   - Guards sur les boutons d'action
 */
(function () {
  'use strict';

  var FIREBASE_APP_CDN  = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
  var FIREBASE_AUTH_CDN = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js';

  var _auth        = null;
  var _currentUser = null;
  var _adminEmails = [];
  var _ready       = false;

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  function loadScript(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  function isAdmin(user) {
    if (!user) return false;
    return _adminEmails.map(function(e){ return e.toLowerCase(); })
                       .indexOf(user.email.toLowerCase()) > -1;
  }

  function displayName(user) {
    if (!user) return '';
    return (user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0]);
  }

  function getNext() {
    var p = new URLSearchParams(window.location.search);
    return p.get('next') || '/';
  }

  /* ─── Nav — desktop ────────────────────────────────────────────────────── */
  function updateDesktopNav(user) {
    var waBtn = document.getElementById('nav-whatsapp');
    if (!waBtn) return;

    var container = document.getElementById('_jl_auth_desktop');
    if (!container) {
      container = document.createElement('div');
      container.id = '_jl_auth_desktop';
      // Only visible alongside the desktop nav (lg and up)
      container.className = 'hidden lg:flex items-center';
      waBtn.parentNode.insertBefore(container, waBtn);
    }

    if (user) {
      var name  = displayName(user);
      var initl = name[0].toUpperCase();
      var adm   = isAdmin(user);
      container.innerHTML =
        '<div class="flex items-center gap-2">' +
          (adm ? '<a href="/dashboard.html" class="px-3 py-1.5 bg-jl-yellow text-jl-dark text-xs font-bold rounded-full hover:scale-105 transition-transform">⚙ Admin</a>' : '') +
          '<div class="relative group">' +
            '<button class="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border-2 border-jl-yellow/40 hover:border-jl-yellow transition-all text-sm font-bold text-jl-dark">' +
              '<span class="w-8 h-8 rounded-full bg-jl-dark text-jl-yellow flex items-center justify-center font-black text-sm">' + initl + '</span>' +
              name +
            '</button>' +
            '<div class="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-2xl py-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">' +
              '<div class="px-4 py-2 text-xs text-slate-400 border-b border-slate-100 truncate">' + user.email + '</div>' +
              (adm ? '<a href="/dashboard.html" class="flex items-center gap-2 px-4 py-2.5 text-sm text-jl-dark hover:bg-slate-50 font-bold"><span>⚙</span>Tableau de bord</a>' : '') +
              '<a href="/devis.html" class="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><span>📋</span>Demander un devis</a>' +
              '<button onclick="window.JLAuth.signOut()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><span>🚪</span>Déconnexion</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    } else {
      container.innerHTML =
        '<a href="/login.html" class="flex items-center gap-2 px-5 py-2 bg-jl-dark text-white text-sm font-bold rounded-full hover:bg-slate-800 transition-all">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>' +
          'Connexion' +
        '</a>';
    }
  }

  /* ─── Nav — mobile burger ───────────────────────────────────────────────── */
  function updateMobileNav(user) {
    var panel = document.getElementById('mobile-menu-panel');
    if (!panel) return;

    var item = document.getElementById('_jl_auth_mobile');
    if (!item) {
      item = document.createElement('div');
      item.id = '_jl_auth_mobile';
      // insert before the last child div (WhatsApp section)
      var children = panel.children;
      var lastDiv = null;
      for (var i = children.length - 1; i >= 0; i--) {
        if (children[i].tagName === 'DIV') { lastDiv = children[i]; break; }
      }
      if (lastDiv) panel.insertBefore(item, lastDiv);
      else panel.appendChild(item);
    }

    if (user) {
      var name  = displayName(user);
      var initl = name[0].toUpperCase();
      var adm   = isAdmin(user);
      item.innerHTML =
        '<div class="border-t border-b border-slate-100">' +
          '<div class="px-6 py-3 flex items-center gap-3 bg-slate-50">' +
            '<span class="w-9 h-9 rounded-full bg-jl-dark text-jl-yellow flex items-center justify-center font-black">' + initl + '</span>' +
            '<div><div class="font-bold text-jl-dark text-sm">' + name + '</div><div class="text-xs text-slate-400 truncate max-w-[180px]">' + user.email + '</div></div>' +
          '</div>' +
          (adm ? '<a href="/dashboard.html" class="flex items-center gap-2 py-3 px-6 font-bold text-jl-dark hover:bg-jl-yellow/10 border-t border-slate-100"><span>⚙</span>Tableau de bord admin</a>' : '') +
          '<a href="/devis.html" class="flex items-center gap-2 py-3 px-6 text-slate-700 hover:bg-slate-50 border-t border-slate-100"><span>📋</span>Mes devis</a>' +
          '<button onclick="window.JLAuth.signOut()" class="w-full flex items-center gap-2 py-3 px-6 text-red-600 hover:bg-red-50 border-t border-slate-100"><span>🚪</span>Déconnexion</button>' +
        '</div>';
    } else {
      item.innerHTML =
        '<a href="/login.html" class="flex items-center gap-2 py-3 px-6 font-bold text-jl-dark hover:bg-jl-yellow/10 border-t border-slate-100">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>' +
          'Connexion' +
        '</a>';
    }
  }

  /* ─── Homepage portal view ──────────────────────────────────────────────── */
  function updateHomepage(user) {
    var hero   = document.getElementById('hero-section');
    var portal = document.getElementById('portal-section');
    if (!hero && !portal) return; // not homepage

    var stats = document.getElementById('hero-stats');
    if (user) {
      if (hero)   hero.style.display   = 'none';
      if (stats)  stats.style.display  = 'none';
      if (portal) {
        portal.style.display = '';
        var nameEl = document.getElementById('portal-username');
        if (nameEl) nameEl.textContent = displayName(user);
        var adminLink = document.getElementById('portal-admin-link');
        if (adminLink) adminLink.style.display = isAdmin(user) ? '' : 'none';
      }
    } else {
      if (hero)   hero.style.display   = '';
      if (stats)  stats.style.display  = '';
      if (portal) portal.style.display = 'none';
    }
  }

  /* ─── Auth guards ───────────────────────────────────────────────────────── */
  function guardLink(el) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      if (!_currentUser) {
        e.preventDefault();
        e.stopPropagation();
        var href = el.getAttribute('href') || window.location.href;
        window.location.href = '/login.html?next=' + encodeURIComponent(href);
      }
    });
  }

  function setupGuards() {
    // Links that require auth
    ['hero-devis-btn','cta-devis-footer','hero-shop-btn','cta-shop-footer',
     'cta-services-footer-quote'].forEach(function(id){ guardLink(document.getElementById(id)); });

    // Add-to-cart buttons (capture phase, runs before existing handler)
    document.querySelectorAll('[id^="add-to-cart-"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (!_currentUser) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
        }
      }, true);
    });

    // Panier / paiement pages — guard on load once auth resolves
    var page = window.location.pathname;
    var guarded = ['/panier.html', '/paiement.html'];
    if (guarded.some(function(p){ return page.endsWith(p); })) {
      var TIMEOUT = 4000;
      var timer = setTimeout(function () {
        if (!_ready && !_currentUser) {
          window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
        }
      }, TIMEOUT);
      document.addEventListener('jlauth:ready', function () {
        clearTimeout(timer);
        if (!_currentUser) {
          window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
        }
      }, { once: true });
    }
  }

  /* ─── Core init ─────────────────────────────────────────────────────────── */
  async function init() {
    var cfg;
    try {
      cfg = await fetch('/api/config').then(function(r){ return r.json(); });
      _adminEmails = cfg.adminEmails || [];
    } catch(e) {
      console.warn('[JLAuth] config fetch failed'); return;
    }

    // Always render logged-out nav first so there's no flash
    updateDesktopNav(null);
    updateMobileNav(null);
    updateHomepage(null);

    if (!cfg.configured || !cfg.firebase.apiKey) {
      _ready = true;
      document.dispatchEvent(new CustomEvent('jlauth:ready', { detail: { user: null } }));
      return;
    }

    await loadScript(FIREBASE_APP_CDN);
    await loadScript(FIREBASE_AUTH_CDN);

    try {
      // Avoid double-init if login.html already initialized Firebase
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg.firebase);
      _auth = firebase.auth(app);
      _auth.onAuthStateChanged(function (user) {
        _currentUser = user;
        _ready = true;
        updateDesktopNav(user);
        updateMobileNav(user);
        updateHomepage(user);
        document.dispatchEvent(new CustomEvent('jlauth:ready', { detail: { user: user } }));
      });
    } catch(e) {
      console.warn('[JLAuth] Firebase init error:', e);
      _ready = true;
      document.dispatchEvent(new CustomEvent('jlauth:ready', { detail: { user: null } }));
    }
  }

  /* ─── Public API ────────────────────────────────────────────────────────── */
  window.JLAuth = {
    get user()  { return _currentUser; },
    get ready() { return _ready; },
    isAdmin:     isAdmin,
    requireAuth: function () {
      if (!_currentUser) {
        window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
        return false;
      }
      return true;
    },
    signOut: function () {
      if (_auth) _auth.signOut().then(function(){ window.location.href = '/'; });
      else window.location.href = '/';
    },
  };

  /* ─── Boot ──────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ init(); setupGuards(); });
  } else {
    init(); setupGuards();
  }
})();

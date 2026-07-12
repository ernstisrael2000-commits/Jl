/**
 * JL & Co — Module d'authentification partagé
 * Chargé sur toutes les pages. Gère :
 *   - État de connexion (basé sur la session serveur, jamais sur le SDK client)
 *   - Mise à jour du nav (desktop + burger)
 *   - Vue portail sur la homepage
 *   - Guards sur les boutons d'action
 *
 * Architecture : après connexion sur /login.html, le serveur émet un cookie de
 * session httpOnly vérifié par le SDK Admin Firebase. Cette page (et toutes
 * les autres) ne fait plus jamais confiance à l'état local du SDK client
 * (onAuthStateChanged) — trop fragile face aux popups bloquées, aux
 * navigateurs intégrés (WhatsApp, Instagram…) et aux redirections OAuth.
 * La seule source de vérité est GET /api/whoami, qui lit ce cookie côté
 * serveur.
 */
(function () {
  'use strict';

  var _currentUser = null; // { email, isAdmin } | null
  var _ready       = false;

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  function isAdmin(user) {
    return !!(user && user.isAdmin);
  }

  function displayName(user) {
    if (!user) return '';
    return user.email.split('@')[0];
  }

  /* ─── Nav — desktop ────────────────────────────────────────────────────── */
  function updateDesktopNav(user) {
    // Pages can opt in to a dedicated slot (id="nav-account-slot") when their
    // header doesn't have a WhatsApp button to anchor on (e.g. boutique.html's
    // own header design). Falls back to inserting before #nav-whatsapp on the
    // pages that share the standard site header.
    var slot = document.getElementById('nav-account-slot');
    var waBtn = document.getElementById('nav-whatsapp');
    if (!slot && !waBtn) return;

    var container = document.getElementById('_jl_auth_desktop');
    if (!container) {
      container = document.createElement('div');
      container.id = '_jl_auth_desktop';
      if (slot) {
        // The slot's own classes control visibility/layout for that page.
        slot.appendChild(container);
      } else {
        // Only visible alongside the desktop nav (lg and up)
        container.className = 'hidden lg:flex items-center';
        waBtn.parentNode.insertBefore(container, waBtn);
      }
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

  /* ─── Homepage ──────────────────────────────────────────────────────────── */
  // The homepage is the same marketing page for every visitor, logged in or
  // not — the site is multipage by design, so login only changes the nav
  // (account button, admin link), never which page/section is shown.
  function updateHomepage(user) { /* intentionally a no-op */ }

  /* ─── Auth guards ───────────────────────────────────────────────────────── */
  function setupGuards() {
    // Browsing (viewing the shop, requesting a quote, reading services…) is
    // always open to everyone — a login wall on simple navigation links
    // breaks the site's multipage browsing experience. Only real account
    // actions (checkout) require a session; see the panier/paiement guard
    // below.

    // Panier / paiement pages — guard on load once auth resolves
    var page = window.location.pathname;
    var guarded = ['/panier.html', '/paiement.html'];
    if (guarded.some(function(p){ return page.endsWith(p); })) {
      if (_ready && !_currentUser) {
        window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
      } else if (!_ready) {
        document.addEventListener('jlauth:ready', function () {
          if (!_currentUser) {
            window.location.href = '/login.html?next=' + encodeURIComponent(window.location.href);
          }
        }, { once: true });
      }
    }
  }

  /* ─── Core init ─────────────────────────────────────────────────────────── */
  async function init() {
    // Always render logged-out nav first so there's no flash
    updateDesktopNav(null);
    updateMobileNav(null);
    updateHomepage(null);

    try {
      var resp = await fetch('/api/whoami', { credentials: 'include' });
      _currentUser = resp.ok ? await resp.json() : null;
    } catch (e) {
      console.warn('[JLAuth] whoami fetch failed:', e);
      _currentUser = null;
    }

    _ready = true;
    updateDesktopNav(_currentUser);
    updateMobileNav(_currentUser);
    updateHomepage(_currentUser);
    document.dispatchEvent(new CustomEvent('jlauth:ready', { detail: { user: _currentUser } }));
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
      fetch('/api/logout', { method: 'POST', credentials: 'include' })
        .catch(function () {})
        .then(function () { window.location.href = '/'; });
    },
  };

  /* ─── Boot ──────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ init(); setupGuards(); });
  } else {
    init(); setupGuards();
  }
})();

/**
 * JL & Co — Panier partagé (localStorage)
 * Utilisé par boutique.html (ajout), panier.html (affichage/édition) et
 * paiement.html (résumé + montant réel envoyé à Pay'm Plop plop).
 * Une seule source de vérité : la clé localStorage ci-dessous.
 */
(function () {
  'use strict';

  var KEY = 'jlco_cart_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }

  function save(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent('jlcart:change', { detail: { cart: cart } }));
    return cart;
  }

  function add(product) {
    var cart = load();
    var existing = cart.find(function (i) { return i.id === product.id; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        nom: product.nom,
        prix: Number(product.prix) || 0,
        image: product.image || '',
        categorie: product.categorie || '',
        qty: 1,
      });
    }
    return save(cart);
  }

  function setQty(id, qty) {
    var cart = load()
      .map(function (i) { return i.id === id ? Object.assign({}, i, { qty: qty }) : i; })
      .filter(function (i) { return i.qty > 0; });
    return save(cart);
  }

  function remove(id) {
    return save(load().filter(function (i) { return i.id !== id; }));
  }

  function clear() {
    return save([]);
  }

  function count(cart) {
    cart = cart || load();
    return cart.reduce(function (s, i) { return s + i.qty; }, 0);
  }

  function subtotal(cart) {
    cart = cart || load();
    return cart.reduce(function (s, i) { return s + i.qty * i.prix; }, 0);
  }

  window.JLCart = { KEY: KEY, load: load, save: save, add: add, setQty: setQty, remove: remove, clear: clear, count: count, subtotal: subtotal };
})();

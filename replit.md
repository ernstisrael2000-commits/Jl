# JL & Co — Maquettes du site web

## Vue d'ensemble
Ce projet contient les maquettes UI/UX complètes (design statique, sans backend) du futur site web de **JL & Co**, une entreprise spécialisée dans les solutions énergétiques, électriques et mécaniques (installation/réparation de systèmes photovoltaïques, génératrices, services automobiles, boutique en ligne).

Le design a été fourni par l'utilisateur sous forme d'export HTML (10 pages) et a été rendu fonctionnel : les expressions JS embarquées ont été évaluées en HTML statique, les liens de navigation ont été connectés entre les pages, et toutes les images cassées (Unsplash) ont été remplacées par des images générées localement.

## Identité visuelle
- Bleu foncé (`#1a3a52`) : technologie / professionnalisme
- Jaune solaire (`#FFD700`) : énergie / puissance
- Blanc : simplicité / modernité
- Police : Clash Grotesk (titres) + Satoshi (texte)

## Pages
| Fichier | Page |
|---|---|
| `public/index.html` | Accueil |
| `public/services.html` | Services |
| `public/devis.html` | Demande de devis |
| `public/boutique.html` | Boutique (catalogue) |
| `public/panier.html` | Panier |
| `public/paiement.html` | Paiement |
| `public/confirmation.html` | Confirmation de commande |
| `public/apropos.html` | À propos |
| `public/contact.html` | Contact |
| `public/dashboard.html` | Dashboard administrateur |

## Comment ça marche
- C'est un site **statique** servi par `server.js` (serveur HTTP Node minimal, aucune dépendance) sur le port 5000.
- Les boutons "Ajouter au panier", le formulaire de contact et le bouton de paiement ont un comportement JS basique côté client (pas de vraie logique métier/backend — c'est un design, pas une application fonctionnelle).
- Le workflow **Start application** lance `node server.js`.

## Régénérer les pages depuis le design original
Si le fichier d'export original (`design_export/*.html`) change, relancez :
```
node tools/render-designs.js   # évalue les expressions JS embarquées -> HTML statique
node tools/wire-links.js       # reconnecte la navigation, WhatsApp, formulaires
node tools/localize-images.js  # remplace les images Unsplash cassées par des images locales
```
Le résultat est écrit dans `public/`.

## Notes techniques
- Le site utilise Tailwind CDN avec des couleurs personnalisées (`jl-dark`, `jl-yellow`) définies via `tailwind.config` juste après le script CDN dans chaque page HTML — nécessaire pour que ces classes (ex. `bg-jl-dark/95`) fonctionnent.
- Les images de la page d'accueil (`hero-solar.jpg`, `commercial-solar.jpg`, `residential-solar.jpg`, `hotel-hybrid.jpg`, `auto-workshop.jpg`) sont générées et présentes dans `public/images/`.
- D'autres pages (boutique, à propos, services) référencent encore des images manquantes (`product-*.jpg`, `team-photo.jpg`, `services-header.jpg`) — non traité, car hors du périmètre demandé (page d'accueil uniquement).

## Authentification (Firebase)
- Connexion client (tous les utilisateurs) : Firebase Authentication (Google via `signInWithRedirect` — pas de popup, peu fiable sur mobile — + Email/Mot de passe), configuré via les secrets `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`. Le serveur expose cette config publique (clé API web, non sensible) via `GET /api/config`.
- Accès admin (dashboard) : **vérifié côté serveur** avec le Firebase Admin SDK (secret `FIREBASE_SERVICE_ACCOUNT_KEY`, JSON du compte de service). Après connexion, le client échange son ID token Firebase contre un cookie de session `httpOnly` (`POST /api/session`), que `server.js` seul peut créer/valider — le client ne décide jamais lui-même qu'il est admin.
- `GET /dashboard.html` est bloqué au niveau serveur : sans session admin valide, redirection 302 vers `/login.html` avant même d'envoyer le HTML.
- Les endpoints qui exposent des données clients (`GET /api/commandes`, `/api/devis`, `/api/contacts`) et les mutations (`POST/PUT/DELETE` sur produits, commandes, devis, contacts) exigent la même session admin. Les endpoints publics (catalogue, soumission de devis/contact/commande) restent ouverts.
- Les comptes admin sont définis en dur dans `server.js` (`ADMIN_EMAILS`) — tout autre compte est un client normal.
- Dans la console Firebase du projet, les fournisseurs **Google** et **Email/Mot de passe** doivent être activés sous Authentication → Sign-in method.

## À personnaliser avant mise en production
- Numéro WhatsApp/téléphone réel (actuellement un placeholder dans `tools/wire-links.js`)
- Adresse et email de contact réels
- Carte Google Maps (actuellement centrée sur Port-au-Prince, Haïti à titre générique)

## Préférences utilisateur
- Demande initiale en français ; garder les textes du site en français.
- Le site doit rester un **design/maquette**, pas une application e-commerce fonctionnelle (pas de vrai paiement, pas de vrai backend) — sauf demande explicite contraire.

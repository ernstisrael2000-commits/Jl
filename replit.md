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

## À personnaliser avant mise en production
- Numéro WhatsApp/téléphone réel (actuellement un placeholder dans `tools/wire-links.js`)
- Adresse et email de contact réels
- Carte Google Maps (actuellement centrée sur Port-au-Prince, Haïti à titre générique)

## Préférences utilisateur
- Demande initiale en français ; garder les textes du site en français.
- Le site doit rester un **design/maquette**, pas une application e-commerce fonctionnelle (pas de vrai paiement, pas de vrai backend) — sauf demande explicite contraire.

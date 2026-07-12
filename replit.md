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
- C'est un site **statique** servi par `server.js` (serveur HTTP Node, dépendance unique `firebase-admin`) sur le port 5000.
- Les boutons "Ajouter au panier", le formulaire de contact et le bouton de paiement ont un comportement JS basique côté client (pas de vraie logique métier/backend — c'est un design, pas une application fonctionnelle).
- Le workflow **Start application** lance `npm start` (= `node server.js`), après un `npm install` initial pour récupérer `firebase-admin`.
- Les secrets Firebase (`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY`) sont configurés — la connexion/inscription et le dashboard admin sont actifs. Vérifier dans la console Firebase que les fournisseurs **Google** et **Email/Mot de passe** sont bien activés (Authentication → Sign-in method).

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

## Authentification (Firebase + sessions serveur)
Architecture reconstruite pour ne plus jamais dépendre de l'état local du SDK client (fragile face aux popups bloquées, navigateurs intégrés WhatsApp/Instagram, redirections OAuth) :

- **Connexion/inscription (client)** — `public/login.html` propose 3 méthodes : Google (`signInWithRedirect`, jamais de popup), et un formulaire Email/Mot de passe avec onglets **Se connecter** / **Créer un compte** (`createUserWithEmailAndPassword` pour les nouveaux visiteurs — avant, seuls les comptes déjà existants pouvaient se connecter par email). Un lien "Mot de passe oublié" (`sendPasswordResetEmail`) permet aussi à un compte créé via Google d'ajouter un mot de passe. Config via les secrets `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`, exposés (non sensibles) via `GET /api/config`.
- **Session (serveur, seule source de vérité)** — après N'IMPORTE QUELLE connexion réussie (Google, connexion email, ou inscription), le client échange son ID token Firebase contre un cookie `httpOnly` (`POST /api/session`), vérifié par le Firebase Admin SDK (secret `FIREBASE_SERVICE_ACCOUNT_KEY`). `GET /api/whoami` lit ce cookie et renvoie `{email, isAdmin}` — c'est la seule chose que `public/auth.js` (nav, garde-fous) et `dashboard.html` consultent désormais ; le SDK client n'est plus jamais interrogé après la connexion.
- **Admin** — `isAdmin` est calculé côté serveur en comparant l'email de la session à `ADMIN_EMAILS` (en dur dans `server.js`) ; le client ne décide jamais lui-même qu'il est admin.
- `GET /dashboard.html` est bloqué au niveau serveur : sans session admin valide, redirection 302 vers `/login.html` avant même d'envoyer le HTML.
- Les endpoints qui exposent des données clients (`GET /api/commandes`, `/api/devis`, `/api/contacts`) et les mutations (`POST/PUT/DELETE` sur produits, commandes, devis, contacts) exigent une session admin. Les endpoints publics (catalogue, soumission de devis/contact/commande) restent ouverts.
- Détection des navigateurs intégrés (WhatsApp, Instagram, Messenger…) sur `login.html` : Google y bloque volontairement l'OAuth, donc un avertissement s'affiche pour rediriger vers email/mot de passe.
- Dans la console Firebase du projet, les fournisseurs **Google** et **Email/Mot de passe** doivent être activés sous Authentication → Sign-in method.

## Paiement Pay'm Plop plop (MonCash / NatCash / Kashpaw)
Sur `public/paiement.html`, un 3e moyen de paiement « Pay'm Plop plop » a été ajouté à côté de Carte Bancaire / PayPal (ces deux derniers restent des maquettes non fonctionnelles). Contrairement au reste du site, celui-ci est **réellement fonctionnel** :
- Doc API : https://plopplop.solutionip.app/paiement-doc
- Secret serveur `PLOPPLOP_CLIENT_ID` (identifiant marchand `pp_...`) — jamais exposé au client.
- `POST /api/paiement/plopplop` (server.js) crée la transaction (endpoint `/api/paiement-marchand`), enregistre la tentative dans `data/paiements_plopplop.json`, renvoie l'URL de paiement (MonCash/NatCash/Kashpaw) à ouvrir dans un nouvel onglet.
- `GET /api/paiement/plopplop/statut?refference_id=...` interroge `/api/paiement-verify` — le client sur `paiement.html` poll cet endpoint toutes les 4s après ouverture du paiement et redirige vers `confirmation.html` dès que `trans_status` passe à `ok`.
- ⚠️ Pay'm Plop plop facture en **HTG** (minimum 20 HTG) alors que le reste du site affiche des prix en **€** — le montant total affiché est envoyé tel quel en HTG pour l'instant ; une vraie conversion de devise reste à faire si le site passe en production avec ce moyen de paiement.

## À personnaliser avant mise en production
- Numéro WhatsApp/téléphone réel (actuellement un placeholder dans `tools/wire-links.js`)
- Adresse et email de contact réels
- Carte Google Maps (actuellement centrée sur Port-au-Prince, Haïti à titre générique)

## Préférences utilisateur
- Demande initiale en français ; garder les textes du site en français.
- Le site doit rester un **design/maquette**, pas une application e-commerce fonctionnelle (pas de vrai paiement, pas de vrai backend) — sauf demande explicite contraire.

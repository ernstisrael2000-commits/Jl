---
name: Firebase auth session architecture
description: Why and how to move Firebase-authenticated sites from client-only auth state to server-verified httpOnly session cookies.
---

Relying purely on the Firebase client SDK's local auth state (`onAuthStateChanged`, popup sign-in, redirect result timing) to gate pages or decide admin access is fragile in practice: popups are blocked on many mobile browsers, `signInWithRedirect`/`getRedirectResult` can race or get lost across page loads, and embedded webviews break the flow entirely (see the in-app-browser OAuth note).

**Why:** a client-only check left admins stuck on a永久 "verifying access" loading state, and regular users had no way to create a new account at all if email/password sign-up wasn't implemented and Google sign-in failed.

**How to apply:** when a site needs reliable "who is logged in / who is admin" gating:
1. Keep the Firebase client SDK only for the sign-in/sign-up transaction itself (to obtain an ID token) — via Google redirect, email/password sign-in, or `createUserWithEmailAndPassword` for new accounts.
2. Immediately exchange that ID token for a first-party `httpOnly` session cookie via a server endpoint that verifies it with the Firebase Admin SDK (`verifyIdToken` + `createSessionCookie`).
3. Make every other page and API route trust *only* that server-verified cookie (e.g. a `GET /api/whoami`-style endpoint) — never re-consult the client SDK's local state after the initial login.
4. Gate sensitive pages (like an admin dashboard) at the static-file-serving layer on the server, redirecting before the HTML is even sent, rather than gating client-side after the page loads.
5. Compute role/admin status server-side from the verified session's email against an allowlist — the client must never assert its own admin status.

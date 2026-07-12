---
name: JL & Co auth loading / nav account button gotchas
description: Why the admin dashboard "Vérification de l'accès" screen hung forever, and why the account/login button silently fails to appear on some pages.
---

## Redundant client-side gating causes infinite loading
`dashboard.html` is gated **server-side** (`server.js` checks the admin session
cookie and 302-redirects non-admins to `/login.html` before the HTML is even
sent). A leftover client-side `#auth-loading` overlay + `/api/whoami` check +
timeout/redirect logic was fully redundant and was the actual cause of the
page appearing to hang forever for the user.

**Why:** once a page is verified server-side before the HTML is served, any
client-side "verify access again, show a spinner until it resolves" logic is
dead weight that can only ever break — if the module script throws for any
reason before reaching the code that hides the overlay, the page is stuck
displaying a permanent spinner even though access was already valid.

**How to apply:** for any page in this app that is already gated server-side,
do not add a client-side loading/redirect gate on top. Fetch `/api/whoami`
only if you need to *display* user info (email/avatar), never to decide
whether to show the page.

## Account/login button requires a page-specific anchor
`public/auth.js`'s `updateDesktopNav()` injects the login/account button by
looking for `#nav-whatsapp` and inserting itself before it. Any page whose
header doesn't include that exact id (e.g. `boutique.html`, which has its own
custom Material-3-style header instead of the shared jl-dark/jl-yellow header)
silently gets **no** account button at all — no error, it just no-ops.

**Why:** the function returns early if it can't find its anchor, so a page
with a different header design breaks the "same account button everywhere"
expectation without any visible error.

**How to apply:** any new/custom header design added to this site must either
reuse `#nav-whatsapp`, or include a `<div id="nav-account-slot">` (supported
fallback anchor added to `updateDesktopNav`) so `auth.js` still has somewhere
to inject the account/login UI. Same applies to `#mobile-menu-panel` for the
mobile menu injection.

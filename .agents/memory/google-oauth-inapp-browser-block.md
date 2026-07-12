---
name: Google OAuth in-app browser block
description: Google blocks OAuth sign-in inside embedded webviews (WhatsApp, Instagram, Messenger, etc); how to detect and work around it.
---

Google's OAuth policy explicitly disallows sign-in flows (`disallowed_useragent`) when the request comes from a known embedded/in-app browser — e.g. links opened inside WhatsApp, Instagram, Facebook Messenger, TikTok, Line. The user gets silently bounced back to the sign-in page with no useful error, which looks like a bug in the app but is enforced entirely by Google, with no client-side code fix possible.

**Why:** a site's "Connexion avec Google" button can appear completely broken for a subset of users, while working fine in a real browser — this cost significant debugging time before the actual cause (embedded webview) was identified.

**How to apply:** detect common in-app browser user-agent substrings (`FBAN`, `FBAV`, `Instagram`, `Line/`, `WhatsApp`, `MicroMessenger`, `Messenger`, `TikTok`, `; wv)`) client-side and show a clear warning telling the user to open the link in a real browser (Chrome/Safari) instead of trying Google sign-in. Always offer a non-Google fallback (email/password sign-in and sign-up) so affected users aren't fully blocked.

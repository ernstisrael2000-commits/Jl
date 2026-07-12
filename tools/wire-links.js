// Wires up real navigation between the exported design pages.
//
// The original export mixes two authoring styles:
//  1. Plain `href="#"` placeholders tagged with an `id` (page 01, and page-
//     specific CTAs on the other pages) — resolved via `idLinks` below.
//  2. petite-vue bindings (`:href="someKey"`, `:class="activeItem === '...' ? a : b"`,
//     `{{ mustache }}`) used for the shared header/footer on pages 02-09.
//     petite-vue is never actually mounted in the export, so these bindings
//     are otherwise inert — this script resolves them to real static
//     attributes/text so the pages work without any client-side framework.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public");

const WHATSAPP_NUMBER = "50937257586";
const PHONE_DISPLAY = "+509 3659 2772";
const PHONE_TEL = "tel:+50936592772";
const EMAIL = "Venelsonliberus11@gmail.com";
const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Bonjour JL & Co, je souhaite en savoir plus sur vos services."
)}`;

// Resolves the petite-vue `:href="key"` bindings used in the shared header/footer.
const vueKeyLinks = {
  homeHref: "index.html",
  servicesHref: "services.html",
  boutiqueHref: "boutique.html",
  aboutHref: "apropos.html",
  contactHref: "contact.html",
  devisHref: "devis.html",
  whatsappHref: WA_LINK,
  shopHref: "boutique.html",
  solarHref: "services.html",
  maintenanceHref: "services.html",
  generatorHref: "services.html",
  diagnosticHref: "services.html",
  projectsHref: "index.html",
  facebookHref: "#",
  linkedinHref: "#",
  instagramHref: "#",
  legalHref: "#",
  privacyHref: "#",
};

// Resolves plain `id="..." href="#"` (or stray draft-preview URLs) placeholders.
const idLinks = {
  "nav-home": "index.html",
  "nav-logo": "index.html",
  "nav-services": "services.html",
  "nav-boutique": "boutique.html",
  "nav-about": "apropos.html",
  "nav-contact": "contact.html",
  "nav-devis": "devis.html",
  "nav-whatsapp": WA_LINK,
  "hero-devis-btn": "devis.html",
  "hero-shop-btn": "boutique.html",
  "hero-wa-btn": WA_LINK,
  "cta-devis-footer": "devis.html",
  "cta-shop-footer": "boutique.html",
  "services-all-link": "services.html",
  "cta-repair": "devis.html",
  "cta-solar": "devis.html",
  "cta-sub-auto": "devis.html",
  "cta-sub-generator": "devis.html",
  "cta-sub-shop": "boutique.html",
  "cta-services-footer-quote": "devis.html",
  "cta-services-footer-wa": WA_LINK,
  "breadcrumb-home": "index.html",
  "cat-all": "boutique.html",
  "cat-sol": "boutique.html",
  "cat-bat": "boutique.html",
  "cat-ond": "boutique.html",
  "cat-mpp": "boutique.html",
  "cat-gen": "boutique.html",
  "cat-acc": "boutique.html",
  "cart-button-top": "panier.html",
  "cart-back-btn": "boutique.html",
  "checkout-btn": "paiement.html",
  "about-contact-btn": "contact.html",
  "about-wa-btn": WA_LINK,
  "contact-email-link": `mailto:${EMAIL}`,
  "contact-phone-link": PHONE_TEL,
  "wa-float-btn": WA_LINK,
  "whatsapp-widget": WA_LINK,
  "cta-pay-now": "confirmation.html",
  // Dashboard sidebar sections stay on the single admin page (no separate
  // routes exist for them) — clicking toggles the active section via JS below.
  "side-dash": "#",
  "side-products": "#",
  "side-inventory": "#",
  "side-orders": "#",
  "side-clients": "#",
  "side-quotes": "#",
  "side-analytics": "#",
  "side-settings": "#",
};

// Which nav item should render "active" (bold/highlighted) on each page.
const activeItemByFile = {
  "index.html": "home",
  "services.html": "services",
  "devis.html": "devis",
  "boutique.html": "boutique",
  "panier.html": "boutique",
  "apropos.html": "about",
  "contact.html": "contact",
  "paiement.html": "boutique",
  "confirmation.html": "boutique",
};

function fixIdLinks(html) {
  for (const [id, href] of Object.entries(idLinks)) {
    // id="x" ... href="anything" (any attribute order, same tag)
    const idFirst = new RegExp(`(id="${id}"[^>]*?)href="[^"]*"`, "g");
    html = html.replace(idFirst, `$1href="${href}"`);
    const hrefFirst = new RegExp(`href="[^"]*"([^>]*?id="${id}")`, "g");
    html = html.replace(hrefFirst, `href="${href}"$1`);
  }
  return html;
}

function fixVueBindings(html, file) {
  const activeItem = activeItemByFile[file] || "";

  // `:href="key"` -> real `href="value"`.
  html = html.replace(/:href="([a-zA-Z0-9]+)"/g, (match, key) => {
    if (key in vueKeyLinks) return `href="${vueKeyLinks[key]}"`;
    return 'href="#"';
  });

  // `:class="activeItem === 'x' ? 'A' : 'B'"` -> resolved literal class list,
  // merged into the element's static `class="..."` attribute.
  html = html.replace(
    /class="([^"]*)"(\s+):class="activeItem === '([a-zA-Z-]+)' \? '([^']*)' : '([^']*)'"/g,
    (match, staticClass, ws, item, whenActive, whenInactive) => {
      const resolved = activeItem === item ? whenActive : whenInactive;
      return `class="${staticClass} ${resolved}"`;
    }
  );

  // Mustache placeholders used in the footer.
  html = html
    .replaceAll("{{ phoneValue }}", PHONE_DISPLAY)
    .replaceAll("{{ emailValue }}", EMAIL)
    .replaceAll("{{ copyrightYear }}", "2026");

  // Drop the now-unused petite-vue scope attributes and script tag.
  html = html.replace(/\s+v-scope="[^"]*"/g, "");
  html = html.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/petite-vue[^"]*"[^>]*><\/script>\s*/g,
    ""
  );

  return html;
}

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(dir, file), "utf8");

  html = fixVueBindings(html, file);
  html = fixIdLinks(html);

  // Display placeholders consistently.
  html = html.replaceAll("+123 456 789", PHONE_DISPLAY);
  html = html.replaceAll("+33 1 23 45 67 89", PHONE_DISPLAY);
  html = html.replaceAll('href="tel:+33123456789"', `href="${PHONE_TEL}"`);
  html = html.replaceAll("Siège Social JL & Co", "Port-au-Prince, Haïti");
  html = html.replaceAll(
    "123 Avenue de l'Énergie,<br>75000 Paris, France",
    "Route de Delmas,<br>Port-au-Prince, Haïti"
  );

  // Add lightweight interactivity: cart buttons give feedback, forms show a
  // friendly confirmation instead of submitting, and the dashboard sidebar
  // toggles an active section (this is a static design, there is no backend).
  // Guarded by a sentinel so repeated builds stay idempotent.
  const SENTINEL = "<!-- jlco-behavior-script -->";
  if (!html.includes(SENTINEL)) {
    const behaviorScript = `
${SENTINEL}
<script>
document.querySelectorAll('[id^="add-to-cart-"]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    var original = btn.textContent;
    btn.textContent = 'Ajouté ✓';
    btn.classList.add('opacity-75');
    setTimeout(function () { btn.textContent = original; btn.classList.remove('opacity-75'); }, 1200);
  });
});
document.querySelectorAll('#contact-form, #contact-submit-btn').forEach(function (el) {
  el.addEventListener('submit', function (e) { e.preventDefault(); alert('Merci ! Votre message a bien été envoyé. Notre équipe vous répondra sous 24h.'); el.reset && el.reset(); });
});
var payBtn = document.getElementById('cta-pay-now');
if (payBtn) { payBtn.addEventListener('click', function (e) { e.preventDefault(); window.location.href = 'confirmation.html'; }); }
document.querySelectorAll('[id^="side-"]').forEach(function (link) {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelectorAll('[id^="side-"]').forEach(function (l) { l.classList.remove('bg-jl-yellow', 'text-jl-dark'); l.classList.add('text-white'); });
    link.classList.remove('text-white');
    link.classList.add('bg-jl-yellow', 'text-jl-dark');
  });
});
</script>
</body>`;
    html = html.replace("</body>", behaviorScript);
  }

  fs.writeFileSync(path.join(dir, file), html);
  console.log(`Wired ${file}`);
}

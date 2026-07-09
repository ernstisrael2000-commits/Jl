// Renames the freshly rendered design export files (public/01-....html, etc.)
// to their final route names (public/index.html, public/services.html, ...).
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public");

const renameMap = {
  "01-jl-co-page-d-accueil-premium.html": "index.html",
  "02-services-jl-co-solutions-nerg-tiques.html": "services.html",
  "03-demander-un-devis-jl-co.html": "devis.html",
  "04-boutique-jl-co-catalogue-nerg-tique.html": "boutique.html",
  "05-jl-co-panier-professionnel.html": "panier.html",
  "06-propos-jl-co-solutions-nerg-tiques.html": "apropos.html",
  "07-contactez-jl-co-expertise-nerg-tique.html": "contact.html",
  "08-jl-co-paiement-s-curis.html": "paiement.html",
  "09-jl-co-confirmation-de-commande.html": "confirmation.html",
  "10-dashboard-administrateur-jl-co.html": "dashboard.html",
};

for (const [from, to] of Object.entries(renameMap)) {
  const src = path.join(dir, from);
  if (fs.existsSync(src)) {
    fs.renameSync(src, path.join(dir, to));
    console.log(`Renamed ${from} -> ${to}`);
  }
}

// Polices et icônes du back-office, chargées seulement quand un écran de
// l'équipe s'ouvre (import à effet de bord dans Layout et LoginPage) : le site
// public ne télécharge plus ces feuilles de style bloquantes.
const STYLESHEETS = [
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.49.0/dist/tabler-icons.min.css",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@400;500;600;700;800&display=swap",
];

if (typeof document !== "undefined") {
  for (const href of STYLESHEETS) {
    if (!document.head.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }
}
